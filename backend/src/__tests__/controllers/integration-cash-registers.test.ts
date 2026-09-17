import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/email.service', () => ({
    isEmailConfigured: () => false,
    sendPhotoEmail: vi.fn(),
    sendPhotosEmail: vi.fn()
}));

import { CashRegisterModel } from '../../models/cash-register.model';
import { CashRegisterMovementModel } from '../../models/cash-register-movement.model';
import { EventModel } from '../../models/event.model';
import { EventUserModel } from '../../models/event-user.model';
import { EventUserTransactionModel } from '../../models/event-user-transaction.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createExchangeAdmin() {
    const user = await UserModel.create({
        firstName: 'Cassa',
        lastName: 'Tester',
        email: `obex-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`,
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

    return { cookie: `sid=${sessionToken}` };
}

async function createEvent() {
    return EventModel.create({
        name: 'Sagra Casse',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC',
        exchangeRate: 2
    });
}

async function createAnonymousWallet(eventId: string) {
    return EventUserModel.create({ eventId, userId: null, balance: 0 });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Integration: cash registers (multi-cassa)', () => {
    it('opens a cassa, auto-names it Cassa 1 and lists it', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();

        const open = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie)
            .send({})
            ;
        expect(open.status).toBe(201);
        expect(open.body.item.name).toBe('Cassa 1');
        expect(open.body.item.status).toBe('open');

        const list = await request(app)
            .get(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie);
        expect(list.status).toBe(200);
        expect(list.body.items).toHaveLength(1);
        expect(list.body.items[0].name).toBe('Cassa 1');
    });

    it('rejects a duplicate open name with 409 name_taken', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();

        await request(app)
            .post(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie)
            .send({ name: 'Banco A' });

        const dup = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie)
            .send({ name: 'banco a ' });
        expect(dup.status).toBe(409);
        expect(dup.body.code).toBe('name_taken');
    });

    it('force-closes the duplicate and reopens on the current machine', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();

        const first = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie)
            .send({ name: 'Banco A' });
        const firstId = first.body.item.id;

        const forced = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie)
            .send({ name: 'Banco A', force: true, cashRegisterToClose: firstId });
        expect(forced.status).toBe(201);
        expect(forced.body.closedDuplicate.status).toBe('closed');
        expect(forced.body.item.id).not.toBe(firstId);

        const closed = await CashRegisterModel.findById(firstId);
        expect(closed!.status).toBe('closed');
        expect(closed!.closedAt).not.toBeNull();
    });

    it('renames a cassa and rejects collisions', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();

        const a = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie)
            .send({ name: 'Banco A' });
        const b = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie)
            .send({ name: 'Banco B' });

        const clash = await request(app)
            .patch(`/api/exchange/${event._id}/cash-registers/${b.body.item.id}`)
            .set('Cookie', cookie)
            .send({ name: 'Banco A' });
        expect(clash.status).toBe(409);

        const ok = await request(app)
            .patch(`/api/exchange/${event._id}/cash-registers/${b.body.item.id}`)
            .set('Cookie', cookie)
            .send({ name: 'Banco C' });
        expect(ok.status).toBe(200);
        expect(ok.body.item.name).toBe('Banco C');

        expect(a.body.item.id).toBeDefined();
    });

    it('closes a cassa and forbids operations on it', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const wallet = await createAnonymousWallet(event._id.toString());

        const open = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie)
            .send({ name: 'Banco A' });
        const id = open.body.item.id;

        const close = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers/${id}/close`)
            .set('Cookie', cookie);
        expect(close.status).toBe(200);
        expect(close.body.item.status).toBe('closed');

        const topUp = await request(app)
            .post(`/api/exchange/${event._id}/top-up`)
            .set('Cookie', cookie)
            .send({ eventUserId: wallet._id.toString(), amount: 10, cashRegisterId: id });
        expect(topUp.status).toBe(400);

        const closedAgain = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers/${id}/close`)
            .set('Cookie', cookie);
        expect(closedAgain.status).toBe(400);
    });

    it('attributes top-ups, refunds and float to the cassa balance', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const wallet = await createAnonymousWallet(event._id.toString());

        const open = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie)
            .send({ name: 'Banco A' });
        const id = open.body.item.id;

        await request(app)
            .post(`/api/exchange/${event._id}/top-up`)
            .set('Cookie', cookie)
            .send({ eventUserId: wallet._id.toString(), amount: 50, cashRegisterId: id });

        await request(app)
            .post(`/api/exchange/${event._id}/refund`)
            .set('Cookie', cookie)
            .send({ eventUserId: wallet._id.toString(), amount: 10, cashRegisterId: id });

        const float = await request(app)
            .post(`/api/exchange/${event._id}/cash-float`)
            .set('Cookie', cookie)
            .send({ euro: 200, credits: 300, cashRegisterId: id });
        expect(float.status).toBe(200);

        await request(app)
            .post(`/api/exchange/${event._id}/cash-movements`)
            .set('Cookie', cookie)
            .send({ currency: 'euro', direction: 'out', amount: 50, cashRegisterId: id });

        const bal = await request(app)
            .get(`/api/exchange/${event._id}/cash-registers/${id}/balance`)
            .set('Cookie', cookie);
        expect(bal.status).toBe(200);
        expect(bal.body.cashFloat).toMatchObject({ euro: 200, credits: 300 });
        expect(bal.body.topUp).toBe(100);
        expect(bal.body.refund).toBe(10);
        expect(bal.body.topUpCount).toBe(1);
        expect(bal.body.refundCount).toBe(1);
        expect(bal.body.euroContent).toBe(200 + 50 - 5 - 50);
        expect(bal.body.creditsContent).toBe(300 - 100 + 10);
    });

    it('attributes movements to a specific cassa', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();

        const a = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie)
            .send({ name: 'Banco A' });
        const b = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie)
            .send({ name: 'Banco B' });

        await request(app)
            .post(`/api/exchange/${event._id}/cash-movements`)
            .set('Cookie', cookie)
            .send({ currency: 'euro', direction: 'in', amount: 10, cashRegisterId: a.body.item.id });

        const movements = await CashRegisterMovementModel.find({ eventId: event._id });
        expect(movements).toHaveLength(1);
        expect(movements[0]!.cashRegisterId?.toString()).toBe(a.body.item.id);

        const balB = await request(app)
            .get(`/api/exchange/${event._id}/cash-registers/${b.body.item.id}/balance`)
            .set('Cookie', cookie);
        expect(balB.body.euroContent).toBe(0);
        expect(balB.body.cashMovements).toEqual({ euroIn: 0, euroOut: 0, creditsIn: 0, creditsOut: 0 });
    });

    it('computes the master report with configurable since counts', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const wallet = await createAnonymousWallet(event._id.toString());

        const open = await request(app)
            .post(`/api/exchange/${event._id}/cash-registers`)
            .set('Cookie', cookie)
            .send({ name: 'Banco A' });
        const id = open.body.item.id;

        const from = new Date();
        await request(app)
            .post(`/api/exchange/${event._id}/top-up`)
            .set('Cookie', cookie)
            .send({ eventUserId: wallet._id.toString(), amount: 20, cashRegisterId: id });

        const fromIso = from.toISOString();
        const report = await request(app)
            .get(`/api/exchange/${event._id}/cash-registers/report?from=${encodeURIComponent(fromIso)}`)
            .set('Cookie', cookie);
        expect(report.status).toBe(200);
        expect(report.body.items).toHaveLength(1);
        expect(report.body.items[0].sinceTopUpCount).toBe(1);
        expect(report.body.totals.sinceTotalCount).toBe(1);
        expect(report.body.totals.euroContent).toBe(20);
        expect(report.body.totals.creditsContent).toBe(-40);

        const future = new Date(Date.now() + 60_000).toISOString();
        const reportBefore = await request(app)
            .get(`/api/exchange/${event._id}/cash-registers/report?from=${encodeURIComponent(future)}`)
            .set('Cookie', cookie);
        expect(reportBefore.body.items[0].sinceTopUpCount).toBe(0);
    });

    it('legacy exchanges (without cashRegisterId) keep working', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const wallet = await createAnonymousWallet(event._id.toString());

        const bal = await request(app)
            .get(`/api/exchange/${event._id}/balance`)
            .set('Cookie', cookie);
        expect(bal.status).toBe(200);

        await request(app)
            .post(`/api/exchange/${event._id}/top-up`)
            .set('Cookie', cookie)
            .send({ eventUserId: wallet._id.toString(), amount: 30 });
        const txn = await EventUserTransactionModel.findOne({ eventId: event._id, type: 'top-up' });
        expect(txn!.cashRegisterId).toBeNull();
    });
});