import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

async function createUser(firstName = 'Mario', lastName = 'Rossi') {
    return UserModel.create({
        firstName,
        lastName,
        email: `ex-users-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        isActive: true
    });
}

async function createSessionFor(userId: string, slug?: string) {
    if (slug) {
        const role = await RoleModel.create({
            name: slug,
            slug,
            scope: 'platform',
            permissions: ['manage']
        });
        await UserRoleModel.create({ userId, roleId: role._id, isActive: true });
    }

    const sessionToken = generateSessionToken();
    await SessionModel.create({
        userId,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: getSessionExpiryDate(),
        lastActivityAt: new Date()
    });

    return `sid=${sessionToken}`;
}

async function createEvent() {
    return EventModel.create({
        name: 'Sagra Portafogli',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC',
        exchangeRate: 2
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Integration: clienti del banco cambio (elenco, collegamento, correzione)', () => {
    it('espone nell\'elenco la sintesi degli accrediti per cliente', async () => {
        app = createTestApp();
        const event = await createEvent();
        const cookie = await createSessionFor((await createUser())._id.toString(), 'exchange-admin');

        const wallet = await EventUserModel.create({ eventId: event._id, userId: null, balance: 30 });

        /* Un accredito del banco (top-up), un addebito (purchase) e il rimborso
         * di un ordine annullato (refund con direction credit): solo il primo
         * e' un accredito. */
        await EventUserTransactionModel.create({
            eventUserId: wallet._id,
            eventId: event._id,
            userId: null,
            type: 'top-up',
            direction: 'credit',
            amount: 50,
            balanceAfter: 50,
            occurredAt: new Date('2026-06-01T10:00:00Z')
        });
        await EventUserTransactionModel.create({
            eventUserId: wallet._id,
            eventId: event._id,
            userId: null,
            type: 'purchase',
            direction: 'debit',
            amount: 20,
            balanceAfter: 30,
            occurredAt: new Date('2026-06-01T11:00:00Z')
        });
        await EventUserTransactionModel.create({
            eventUserId: wallet._id,
            eventId: event._id,
            userId: null,
            type: 'refund',
            direction: 'credit',
            amount: 10,
            balanceAfter: 40,
            occurredAt: new Date('2026-06-01T12:00:00Z')
        });

        const res = await request(app)
            .get(`/api/exchange/${event._id}/users`)
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        const item = res.body.items.find((i: { id: string }) => i.id === wallet._id.toString());
        expect(item.creditsCount).toBe(1);
        expect(item.creditsTotal).toBe(50);
        expect(item.creditsLastAt).toBe('2026-06-01T10:00:00.000Z');
    });

    it('un cliente mai accreditato ha la sintesi a zero', async () => {
        app = createTestApp();
        const event = await createEvent();
        const cookie = await createSessionFor((await createUser())._id.toString(), 'exchange-admin');

        const res = await request(app)
            .get(`/api/exchange/${event._id}/users`)
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        for (const item of res.body.items) {
            expect(item.creditsCount).toBe(0);
            expect(item.creditsTotal).toBe(0);
            expect(item.creditsLastAt).toBeNull();
        }
    });

    it('collega un utente registrato al portafoglio dell\'evento (QR personale)', async () => {
        app = createTestApp();
        const event = await createEvent();
        const cookie = await createSessionFor((await createUser('Cassa', 'Tester'))._id.toString(), 'exchange-admin');
        const customer = await createUser();

        const res = await request(app)
            .post(`/api/exchange/${event._id}/users/link`)
            .set('Cookie', cookie)
            .send({ userId: customer._id.toString() });

        expect(res.status).toBe(201);
        expect(res.body.alreadyLinked).toBe(false);
        expect(res.body.item.userId).toBe(customer._id.toString());
        expect(res.body.item.email).toBe(customer.email);
        expect(res.body.item.balance).toBe(0);
        expect(res.body.item.isAnonymous).toBe(false);

        const wallets = await EventUserModel.find({ eventId: event._id, userId: customer._id });
        expect(wallets).toHaveLength(1);
    });

    it('ricallegare lo stesso utente non crea un doppione', async () => {
        app = createTestApp();
        const event = await createEvent();
        const cookie = await createSessionFor((await createUser('Cassa', 'Tester'))._id.toString(), 'exchange-admin');
        const customer = await createUser();

        await request(app)
            .post(`/api/exchange/${event._id}/users/link`)
            .set('Cookie', cookie)
            .send({ userId: customer._id.toString() });

        const again = await request(app)
            .post(`/api/exchange/${event._id}/users/link`)
            .set('Cookie', cookie)
            .send({ userId: customer._id.toString() });

        expect(again.status).toBe(200);
        expect(again.body.alreadyLinked).toBe(true);

        const wallets = await EventUserModel.find({ eventId: event._id, userId: customer._id });
        expect(wallets).toHaveLength(1);
    });

    it('collega: 400 con userId malformato e 404 con utente inesistente', async () => {
        app = createTestApp();
        const event = await createEvent();
        const cookie = await createSessionFor((await createUser('Cassa', 'Tester'))._id.toString(), 'exchange-admin');

        const bad = await request(app)
            .post(`/api/exchange/${event._id}/users/link`)
            .set('Cookie', cookie)
            .send({ userId: 'non-e-un-id' });
        expect(bad.status).toBe(400);

        const missing = await request(app)
            .post(`/api/exchange/${event._id}/users/link`)
            .set('Cookie', cookie)
            .send({ userId: '507f1f77bcf86cd799439011' });
        expect(missing.status).toBe(404);
    });

    it('correzione del saldo: accredito senza movimento di denaro', async () => {
        app = createTestApp();
        const event = await createEvent();
        const cookie = await createSessionFor((await createUser('Cassa', 'Tester'))._id.toString(), 'exchange-admin');

        const wallet = await EventUserModel.create({ eventId: event._id, userId: null, balance: 0 });

        const res = await request(app)
            .post(`/api/exchange/${event._id}/users/${wallet._id}/adjustment`)
            .set('Cookie', cookie)
            .send({ direction: 'credit', amount: 15, description: 'Correzione accredito' });

        expect(res.status).toBe(201);
        expect(res.body.newBalance).toBe(15);
        expect(res.body.transaction.type).toBe('adjustment');
        expect(res.body.transaction.direction).toBe('credit');
        /* Nessun movimento di cassa: la correzione non tocca i contanti. */
        expect(res.body.transaction.cashRegisterId).toBeNull();
        expect(res.body.transaction.realAmount).toBeNull();

        const updated = await EventUserModel.findById(wallet._id);
        expect(updated!.balance).toBe(15);
    });

    it('correzione del saldo: addebito oltre il saldo respinto, wallet di altro evento 404', async () => {
        app = createTestApp();
        const event = await createEvent();
        const otherEvent = await createEvent();
        const cookie = await createSessionFor((await createUser('Cassa', 'Tester'))._id.toString(), 'exchange-admin');

        const wallet = await EventUserModel.create({ eventId: event._id, userId: null, balance: 5 });
        const foreign = await EventUserModel.create({ eventId: otherEvent._id, userId: null, balance: 50 });

        const tooMuch = await request(app)
            .post(`/api/exchange/${event._id}/users/${wallet._id}/adjustment`)
            .set('Cookie', cookie)
            .send({ direction: 'debit', amount: 10 });
        expect(tooMuch.status).toBe(400);

        const wrongEvent = await request(app)
            .post(`/api/exchange/${event._id}/users/${foreign._id}/adjustment`)
            .set('Cookie', cookie)
            .send({ direction: 'credit', amount: 10 });
        expect(wrongEvent.status).toBe(404);

        const badDirection = await request(app)
            .post(`/api/exchange/${event._id}/users/${wallet._id}/adjustment`)
            .set('Cookie', cookie)
            .send({ direction: 'up', amount: 10 });
        expect(badDirection.status).toBe(400);

        const badAmount = await request(app)
            .post(`/api/exchange/${event._id}/users/${wallet._id}/adjustment`)
            .set('Cookie', cookie)
            .send({ direction: 'credit', amount: 0 });
        expect(badAmount.status).toBe(400);
    });

    it('senza ruolo exchange-admin le operazioni sui clienti sono vietate', async () => {
        app = createTestApp();
        const event = await createEvent();
        const cookie = await createSessionFor((await createUser('Senza', 'Ruoli'))._id.toString());
        const customer = await createUser();

        const list = await request(app)
            .get(`/api/exchange/${event._id}/users`)
            .set('Cookie', cookie);
        expect(list.status).toBe(403);

        const link = await request(app)
            .post(`/api/exchange/${event._id}/users/link`)
            .set('Cookie', cookie)
            .send({ userId: customer._id.toString() });
        expect(link.status).toBe(403);
    });
});
