import * as argon2 from 'argon2';
import type { Express } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/email.service', () => ({
    isEmailConfigured: () => false,
    sendPhotoEmail: vi.fn(),
    sendPhotosEmail: vi.fn()
}));

import { CashRegisterModel } from '../../models/cash-register.model';
import { CashRegisterMovementModel } from '../../models/cash-register-movement.model';
import { CashRequestModel } from '../../models/cash-request.model';
import { EventModel } from '../../models/event.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import { generateSessionToken, getSessionExpiryDate, hashSessionToken } from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createExchangeAdmin() {
    const user = await UserModel.create({
        firstName: 'Cassa',
        lastName: 'Master',
        email: `oreq-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        isActive: true
    });

    const role = await RoleModel.create({
        name: 'exchange-admin',
        slug: 'exchange-admin',
        scope: 'platform',
        permissions: ['manage']
    });
    await UserRoleModel.create({ userId: user._id, roleId: role._id, isActive: true });

    const sessionToken = generateSessionToken();
    await SessionModel.create({
        userId: user._id,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: getSessionExpiryDate(),
        lastActivityAt: new Date()
    });

    return { cookie: `sid=${sessionToken}`, user };
}

async function createEvent() {
    return EventModel.create({
        name: 'Sagra Richieste',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC',
        exchangeRate: 2
    });
}

async function openRegister(eventId: string, name = 'Cassa 1') {
    return CashRegisterModel.create({
        eventId,
        name,
        status: 'open',
        openedByUserId: new Types.ObjectId(),
        openedAt: new Date()
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Integration: richieste alla cassa master', () => {
    it('crea una richiesta euro e la elenca con nome cassa e operatore', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie, user } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        const created = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'euro', amountEuro: 50, note: ' serve subito' });

        expect(created.status).toBe(201);
        expect(created.body.duplicate).toBe(false);
        expect(created.body.item.kind).toBe('euro');
        expect(created.body.item.amountEuro).toBe(50);
        expect(created.body.item.amountCredits).toBeNull();
        expect(created.body.item.note).toBe('serve subito');
        expect(created.body.item.status).toBe('pending');
        expect(created.body.item.cashRegisterName).toBe('Cassa 1');
        expect(created.body.item.requestedByName).toContain('Master');
        expect(created.body.item.requestedByUserId).toBe(user._id.toString());

        const list = await request(app)
            .get(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie);
        expect(list.status).toBe(200);
        expect(list.body.items).toHaveLength(1);
        expect(list.body.pendingCount).toBe(1);
        expect(list.body.currencyName).toBe('TC');
    });

    it('richiesta senza importi: generica, la master decide quanto consegnare', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        const res = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'both' });

        expect(res.status).toBe(201);
        expect(res.body.item.kind).toBe('both');
        expect(res.body.item.amountEuro).toBeNull();
        expect(res.body.item.amountCredits).toBeNull();
    });

    it('deduplica: seconda richiesta aperta stessa cassa e valuta restituisce 200 duplicate', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        const first = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'euro', amountEuro: 20 });
        expect(first.status).toBe(201);

        const second = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'euro', amountEuro: 20, isAutomatic: true });
        expect(second.status).toBe(200);
        expect(second.body.duplicate).toBe(true);
        expect(second.body.item.id).toBe(first.body.item.id);

        expect(await CashRequestModel.countDocuments({ eventId: event._id })).toBe(1);
    });

    it('both ed euro sono valute diverse: nessun dedup', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'euro' });
        const both = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'both' });

        expect(both.status).toBe(201);
        expect(await CashRequestModel.countDocuments({ eventId: event._id })).toBe(2);
    });

    it('dopo la consegna una nuova richiesta della stessa cassa torna a crearsi', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        const first = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'euro' });
        await request(app)
            .patch(`/api/exchange/${event._id}/cash-requests/${first.body.item.id}`)
            .set('Cookie', cookie)
            .send({ status: 'delivered', deliveredEuro: 100 });

        const again = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'euro' });
        expect(again.status).toBe(201);
        expect(again.body.duplicate).toBe(false);
    });

    it('preso in carico e poi consegna: registra i movimenti in ingresso nella cassa', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        const created = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'euro', amountEuro: 30 });

        const ack = await request(app)
            .patch(`/api/exchange/${event._id}/cash-requests/${created.body.item.id}`)
            .set('Cookie', cookie)
            .send({ status: 'acknowledged' });
        expect(ack.status).toBe(200);
        expect(ack.body.item.status).toBe('acknowledged');
        expect(ack.body.item.acknowledgedAt).toBeTruthy();

        const delivered = await request(app)
            .patch(`/api/exchange/${event._id}/cash-requests/${created.body.item.id}`)
            .set('Cookie', cookie)
            .send({ status: 'delivered', deliveredEuro: 75 });
        expect(delivered.status).toBe(200);
        expect(delivered.body.item.status).toBe('delivered');
        expect(delivered.body.item.deliveredEuro).toBe(75);
        expect(delivered.body.movementsCreated).toBe(1);

        const movements = await CashRegisterMovementModel.find({
            eventId: event._id,
            cashRegisterId: register._id
        });
        expect(movements).toHaveLength(1);
        expect(movements[0]?.currency).toBe('euro');
        expect(movements[0]?.direction).toBe('in');
        expect(movements[0]?.amount).toBe(75);
    });

    it('consegna both: puo consegnare euro e crediti insieme', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        const created = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'both' });

        const delivered = await request(app)
            .patch(`/api/exchange/${event._id}/cash-requests/${created.body.item.id}`)
            .set('Cookie', cookie)
            .send({ status: 'delivered', deliveredEuro: 200, deliveredCredits: 500 });
        expect(delivered.status).toBe(200);
        expect(delivered.body.movementsCreated).toBe(2);
        expect(delivered.body.item.deliveredEuro).toBe(200);
        expect(delivered.body.item.deliveredCredits).toBe(500);

        const movements = await CashRegisterMovementModel.find({ cashRegisterId: register._id });
        expect(movements.map((m) => m.currency).sort()).toEqual(['credits', 'euro']);
    });

    it('consegna both senza importi non registra una consegna vuota (400)', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        const created = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'both' });

        const res = await request(app)
            .patch(`/api/exchange/${event._id}/cash-requests/${created.body.item.id}`)
            .set('Cookie', cookie)
            .send({ status: 'delivered', deliveredEuro: 0, deliveredCredits: 0 });
        expect(res.status).toBe(400);
    });

    it('richiesta solo crediti non accetta deliveredEuro e richiede la valuta giusta', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        const created = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'credits', amountCredits: 100 });

        const wrongCurrency = await request(app)
            .patch(`/api/exchange/${event._id}/cash-requests/${created.body.item.id}`)
            .set('Cookie', cookie)
            .send({ status: 'delivered', deliveredEuro: 10, deliveredCredits: 100 });
        expect(wrongCurrency.status).toBe(400);

        const missing = await request(app)
            .patch(`/api/exchange/${event._id}/cash-requests/${created.body.item.id}`)
            .set('Cookie', cookie)
            .send({ status: 'delivered' });
        expect(missing.status).toBe(400);
    });

    it('richiesta annullata non e piu modificabile e non genera movimenti', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        const created = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'euro' });

        const cancelled = await request(app)
            .patch(`/api/exchange/${event._id}/cash-requests/${created.body.item.id}`)
            .set('Cookie', cookie)
            .send({ status: 'cancelled' });
        expect(cancelled.status).toBe(200);
        expect(cancelled.body.item.status).toBe('cancelled');

        const redeliver = await request(app)
            .patch(`/api/exchange/${event._id}/cash-requests/${created.body.item.id}`)
            .set('Cookie', cookie)
            .send({ status: 'delivered', deliveredEuro: 10 });
        expect(redeliver.status).toBe(400);

        expect(await CashRegisterMovementModel.countDocuments({ eventId: event._id })).toBe(0);
    });

    it('pending non e uno stato ammesso come target', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        const created = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'euro' });

        const res = await request(app)
            .patch(`/api/exchange/${event._id}/cash-requests/${created.body.item.id}`)
            .set('Cookie', cookie)
            .send({ status: 'pending' });
        expect(res.status).toBe(400);
    });

    it('filtri per cassa, per stato e per periodo; pendingCount conta solo le aperte', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const cassaA = await openRegister(event._id.toString(), 'Cassa A');
        const cassaB = await openRegister(event._id.toString(), 'Cassa B');

        const a = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: cassaA._id.toString(), kind: 'euro' });
        await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: cassaB._id.toString(), kind: 'credits' });
        await request(app)
            .patch(`/api/exchange/${event._id}/cash-requests/${a.body.item.id}`)
            .set('Cookie', cookie)
            .send({ status: 'delivered', deliveredEuro: 10 });

        const all = await request(app)
            .get(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie);
        expect(all.body.items).toHaveLength(2);
        expect(all.body.pendingCount).toBe(1);

        const byRegister = await request(app)
            .get(`/api/exchange/${event._id}/cash-requests?cashRegisterId=${cassaB._id}`)
            .set('Cookie', cookie);
        expect(byRegister.body.items).toHaveLength(1);
        expect(byRegister.body.items[0].cashRegisterName).toBe('Cassa B');

        const pending = await request(app)
            .get(`/api/exchange/${event._id}/cash-requests?status=pending`)
            .set('Cookie', cookie);
        expect(pending.body.items).toHaveLength(1);

        const deliveredOnly = await request(app)
            .get(`/api/exchange/${event._id}/cash-requests?status=delivered`)
            .set('Cookie', cookie);
        expect(deliveredOnly.body.items).toHaveLength(1);
        expect(deliveredOnly.body.items[0].status).toBe('delivered');

        const future = await request(app)
            .get(`/api/exchange/${event._id}/cash-requests?from=${new Date(Date.now() + 60000).toISOString()}`)
            .set('Cookie', cookie);
        expect(future.body.items).toHaveLength(0);
    });

    it('filtro stato non valido restituisce 400', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();

        const res = await request(app)
            .get(`/api/exchange/${event._id}/cash-requests?status=bogus`)
            .set('Cookie', cookie);
        expect(res.status).toBe(400);
    });

    it('cassa chiusa: richiesta non ammessa (400)', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());
        register.status = 'closed';
        register.closedAt = new Date();
        await register.save();

        const res = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'euro' });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('Cassa chiusa');
    });

    it('cassa di un altro evento restituisce 404', async () => {
        app = createTestApp();
        const event = await createEvent();
        const other = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const foreign = await openRegister(other._id.toString());

        const res = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: foreign._id.toString(), kind: 'euro' });
        expect(res.status).toBe(404);
    });

    it('importi misti, incoerenti col kind o negativi restituiscono 400', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        const mixed = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({
                cashRegisterId: register._id.toString(),
                kind: 'both',
                amountEuro: 10,
                amountCredits: 10
            });
        expect(mixed.status).toBe(400);

        const wrong = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'credits', amountEuro: 10 });
        expect(wrong.status).toBe(400);

        const negative = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'euro', amountEuro: -5 });
        expect(negative.status).toBe(400);
    });

    it('kind non valido o cassa mancante restituiscono 400', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString());

        const badKind = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ cashRegisterId: register._id.toString(), kind: 'dollari' });
        expect(badKind.status).toBe(400);

        const noRegister = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .set('Cookie', cookie)
            .send({ kind: 'euro' });
        expect(noRegister.status).toBe(400);
    });

    it('richiesta inesistente o di un altro evento: 404, id non valido: 400', async () => {
        app = createTestApp();
        const event = await createEvent();
        const other = await createEvent();
        const { cookie } = await createExchangeAdmin();

        const badId = await request(app)
            .patch(`/api/exchange/${event._id}/cash-requests/not-an-id`)
            .set('Cookie', cookie)
            .send({ status: 'cancelled' });
        expect(badId.status).toBe(400);

        const foreign = await request(app)
            .patch(`/api/exchange/${other._id}/cash-requests/${new Types.ObjectId()}`)
            .set('Cookie', cookie)
            .send({ status: 'cancelled' });
        expect(foreign.status).toBe(404);
    });

    it('401 senza sessione su list e create', async () => {
        app = createTestApp();
        const event = await createEvent();
        await openRegister(event._id.toString());

        const list = await request(app).get(`/api/exchange/${event._id}/cash-requests`);
        expect(list.status).toBe(401);

        const create = await request(app)
            .post(`/api/exchange/${event._id}/cash-requests`)
            .send({ kind: 'euro' });
        expect(create.status).toBe(401);
    });

    it('PATCH imposta e azzera lowThreshold senza toccare il nome', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const register = await openRegister(event._id.toString(), 'Banco Nord');

        const set = await request(app)
            .patch(`/api/exchange/${event._id}/cash-registers/${register._id}`)
            .set('Cookie', cookie)
            .send({ lowThreshold: { euro: 100, credits: 50 } });
        expect(set.status).toBe(200);
        expect(set.body.item.lowThreshold).toEqual({ euro: 100, credits: 50 });
        expect(set.body.item.name).toBe('Banco Nord');

        const balance = await request(app)
            .get(`/api/exchange/${event._id}/cash-registers/${register._id}/balance`)
            .set('Cookie', cookie);
        expect(balance.body.lowThreshold).toEqual({ euro: 100, credits: 50 });

        const report = await request(app)
            .get(`/api/exchange/${event._id}/cash-registers/report`)
            .set('Cookie', cookie);
        expect(report.body.items[0].lowThreshold).toEqual({ euro: 100, credits: 50 });

        const onlyEuro = await request(app)
            .patch(`/api/exchange/${event._id}/cash-registers/${register._id}`)
            .set('Cookie', cookie)
            .send({ lowThreshold: { euro: 200, credits: '' } });
        expect(onlyEuro.status).toBe(200);
        expect(onlyEuro.body.item.lowThreshold).toEqual({ euro: 200, credits: null });

        const cleared = await request(app)
            .patch(`/api/exchange/${event._id}/cash-registers/${register._id}`)
            .set('Cookie', cookie)
            .send({ lowThreshold: { euro: null, credits: null } });
        expect(cleared.status).toBe(200);
        expect(cleared.body.item.lowThreshold).toEqual({ euro: null, credits: null });
    });

    it('rinomina ancora funziona e il 409 name_taken resta invariato', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const first = await openRegister(event._id.toString(), 'Cassa 1');
        await openRegister(event._id.toString(), 'Cassa 2');

        const renamed = await request(app)
            .patch(`/api/exchange/${event._id}/cash-registers/${first._id}`)
            .set('Cookie', cookie)
            .send({ name: 'Banco Sud' });
        expect(renamed.status).toBe(200);
        expect(renamed.body.item.name).toBe('Banco Sud');
        expect(renamed.body.item.lowThreshold).toEqual({ euro: null, credits: null });

        const taken = await request(app)
            .patch(`/api/exchange/${event._id}/cash-registers/${first._id}`)
            .set('Cookie', cookie)
            .send({ name: 'Cassa 2' });
        expect(taken.status).toBe(409);
        expect(taken.body.code).toBe('name_taken');

        const empty = await request(app)
            .patch(`/api/exchange/${event._id}/cash-registers/${first._id}`)
            .set('Cookie', cookie)
            .send({});
        expect(empty.status).toBe(400);

        const bad = await request(app)
            .patch(`/api/exchange/${event._id}/cash-registers/${first._id}`)
            .set('Cookie', cookie)
            .send({ lowThreshold: { euro: -10 } });
        expect(bad.status).toBe(400);
    });
});
