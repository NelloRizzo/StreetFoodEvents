import * as argon2 from 'argon2';
import type { Express } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { EventModel } from '../../models/event.model';
import { OrderModel } from '../../models/order.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { StandModel } from '../../models/stand.model';
import { StandSettlementModel } from '../../models/stand-settlement.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession() {
    const user = await UserModel.create({
        firstName: 'Exchange',
        lastName: 'Tester',
        email: `settlement-${Date.now()}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        isActive: true
    });

    const sessionToken = generateSessionToken();
    await SessionModel.create({
        userId: user._id,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: getSessionExpiryDate(),
        lastActivityAt: new Date()
    });

    return { user, sessionToken };
}

async function setupSettlementEnvironment() {
    app = createTestApp();
    const { user, sessionToken } = await createAuthSession();

    const event = await EventModel.create({
        name: 'Settlement Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC',
        exchangeRate: 2,
        cashPaymentsEnabled: true
    });

    const exchangeAdminRole = await RoleModel.create({
        name: 'Exchange Admin',
        scope: 'event',
        slug: 'exchange-admin',
        permissions: ['exchanges:read', 'exchanges:create', 'payments:read', 'payments:create', 'payments:refund'],
        isSystem: true,
        isActive: true
    });

    await UserRoleModel.create({
        userId: user._id,
        roleId: exchangeAdminRole._id,
        eventId: event._id,
        isActive: true
    });

    const stand1 = await StandModel.create({ name: 'Stand Alpha', eventIds: [event._id] });
    const stand2 = await StandModel.create({ name: 'Stand Beta', eventIds: [event._id] });
    const otherStand = await StandModel.create({ name: 'Stand Other' });

    const paidOrder = (standId: Types.ObjectId, creditAmountUsed: number) =>
        OrderModel.create({
            eventId: event._id,
            standId,
            orderNumber: 1,
            userId: user._id,
            items: [
                {
                    eventProductId: new Types.ObjectId(),
                    productId: new Types.ObjectId(),
                    productName: 'P',
                    stationId: new Types.ObjectId(),
                    stationName: 'S',
                    quantity: 1,
                    unitPrice: 10,
                    subtotal: 10
                }
            ],
            total: 10,
            creditAmountUsed,
            paymentStatus: 'paid',
            status: 'completed'
        });

    return {
        user,
        sessionToken,
        event,
        stand1,
        stand2,
        otherStand,
        paidOrder
    };
}

describe('Integration — Stand Settlements', () => {
    it('rejects unauthenticated requests', async () => {
        const env = await setupSettlementEnvironment();

        const res = await request(app).get(`/api/exchange/${env.event._id}/settlements/summary`);
        expect(res.status).toBe(401);
    });

    it('rejects users without exchange-admin role', async () => {
        const env = await setupSettlementEnvironment();
        const { sessionToken: noRoleToken } = await createAuthSession();

        const res = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements/summary`)
            .set('Cookie', `sid=${noRoleToken}`);
        expect(res.status).toBe(403);
    });

    it('summary returns earned credits per stand from paid orders', async () => {
        const env = await setupSettlementEnvironment();

        await env.paidOrder(env.stand1._id, 100);
        await env.paidOrder(env.stand2._id, 50);
        await env.paidOrder(env.otherStand._id, 500);

        const res = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements/summary`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.exchangeRate).toBe(2);
        expect(res.body.currencyName).toBe('TC');

        const stand1 = res.body.stands.find((s: { standId: string }) => s.standId === env.stand1._id.toString());
        const stand2 = res.body.stands.find((s: { standId: string }) => s.standId === env.stand2._id.toString());
        const other = res.body.stands.find((s: { standId: string }) => s.standId === env.otherStand._id.toString());

        expect(stand1).toBeDefined();
        expect(stand1.earnedCredits).toBe(100);
        expect(stand1.settledCredits).toBe(0);

        expect(stand2).toBeDefined();
        expect(stand2.earnedCredits).toBe(50);

        expect(other).toBeUndefined();
    });

    it('creates settlement with 0% fee and exchange rate applied', async () => {
        const env = await setupSettlementEnvironment();
        await env.paidOrder(env.stand1._id, 100);

        const res = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 100, feePercent: 0 });

        expect(res.status).toBe(201);
        expect(res.body.item.standName).toBe('Stand Alpha');
        expect(res.body.item.amount).toBe(100);
        expect(res.body.item.exchangeRate).toBe(2);
        expect(res.body.item.grossEuro).toBe(50);
        expect(res.body.item.feeEuro).toBe(0);
        expect(res.body.item.payoutEuro).toBe(50);
    });

    it('creates settlement with fee percentage retained by manager', async () => {
        const env = await setupSettlementEnvironment();
        await env.paidOrder(env.stand1._id, 100);

        const res = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 100, feePercent: 10, description: 'fine serata' });

        expect(res.status).toBe(201);
        expect(res.body.item.grossEuro).toBe(50);
        expect(res.body.item.feeEuro).toBe(5);
        expect(res.body.item.payoutEuro).toBe(45);
        expect(res.body.item.description).toBe('fine serata');
    });

    it('applies the event fee band when the client does not send a fee percentage', async () => {
        const env = await setupSettlementEnvironment();
        /* Fasce: fino a 40 EUR lordi 5%, fino a 100 EUR 10%, oltre (senza tetto) 20% */
        await EventModel.updateOne(
            { _id: env.event._id },
            {
                $set: {
                    feeBands: [
                        { maxAmount: 40, feePercent: 5, feeFlat: 0 },
                        { maxAmount: 100, feePercent: 10, feeFlat: 0 },
                        { maxAmount: 0, feePercent: 20, feeFlat: 0 }
                    ]
                }
            }
        );

        /* 100 crediti / rate 2 = 50 EUR lordi -> fascia "fino a 100" = 10% */
        const mid = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 100 });
        expect(mid.status).toBe(201);
        expect(mid.body.item.feePercent).toBe(10);
        expect(mid.body.item.feeSource).toBe('band');
        expect(mid.body.item.grossEuro).toBe(50);
        expect(mid.body.item.feeEuro).toBe(5);
        expect(mid.body.item.payoutEuro).toBe(45);

        /* 400 crediti / rate 2 = 200 EUR lordi -> oltre l'ultimo tetto = 20% */
        const over = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 400 });
        expect(over.status).toBe(201);
        expect(over.body.item.feePercent).toBe(20);
        expect(over.body.item.grossEuro).toBe(200);
        expect(over.body.item.feeEuro).toBe(40);

        /* Un valore inviato dal client vince sempre sulla fascia (eccezione one-off). */
        const forced = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 100, feePercent: 0 });
        expect(forced.status).toBe(201);
        expect(forced.body.item.feePercent).toBe(0);
        expect(forced.body.item.feeEuro).toBe(0);
    });

    it('the stand fee override wins over the event bands and adds the flat quota', async () => {
        const env = await setupSettlementEnvironment();
        await EventModel.updateOne(
            { _id: env.event._id },
            { $set: { feeBands: [{ maxAmount: 0, feePercent: 20, feeFlat: 0 }] } }
        );
        /* Override dello stand per l'evento: 5% + 3 EUR fissi */
        await StandModel.updateOne(
            { _id: env.stand1._id },
            {
                $set: {
                    numbers: [{ eventId: env.event._id, number: 1, showOnMap: true, feePercent: 5, feeFlat: 3 }]
                }
            }
        );

        const res = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 100 });
        expect(res.status).toBe(201);
        expect(res.body.item.feeSource).toBe('stand');
        expect(res.body.item.feePercent).toBe(5);
        expect(res.body.item.feeFlat).toBe(3);
        /* lordo 50: 50*5% = 2.50 + 3 fissi = 5.50 */
        expect(res.body.item.feeEuro).toBe(5.5);
        expect(res.body.item.payoutEuro).toBe(44.5);

        /* La quota fissa non puo' azzerare il payout: la trattenuta e' limitata al lordo. */
        await StandModel.updateOne(
            { _id: env.stand1._id },
            {
                $set: {
                    numbers: [{ eventId: env.event._id, number: 1, showOnMap: true, feePercent: 0, feeFlat: 500 }]
                }
            }
        );
        const capped = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 100 });
        expect(capped.status).toBe(201);
        expect(capped.body.item.feeEuro).toBe(50);
        expect(capped.body.item.payoutEuro).toBe(0);
    });

    it('no fee configured means no deduction', async () => {
        const plain = await setupSettlementEnvironment();
        const none = await request(app)
            .post(`/api/exchange/${plain.event._id}/settlements`)
            .set('Cookie', `sid=${plain.sessionToken}`)
            .send({ standId: plain.stand1._id.toString(), amount: 100 });
        expect(none.status).toBe(201);
        expect(none.body.item.feeSource).toBe('none');
        expect(none.body.item.feePercent).toBe(0);
        expect(none.body.item.feeFlat).toBe(0);
        expect(none.body.item.feeEuro).toBe(0);
    });

    it('no fee is applied to debits or to settlements already in euro', async () => {
        const env = await setupSettlementEnvironment();
        await EventModel.updateOne(
            { _id: env.event._id },
            { $set: { feeBands: [{ maxAmount: 0, feePercent: 20, feeFlat: 10 }] } }
        );

        const debit = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 100, direction: 'debit' });
        expect(debit.status).toBe(201);
        expect(debit.body.item.feePercent).toBe(0);
        expect(debit.body.item.feeFlat).toBe(0);
        expect(debit.body.item.feeSource).toBe('none');
        expect(debit.body.item.feeEuro).toBe(0);

        const inEuro = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 50, unit: 'euro' });
        expect(inEuro.status).toBe(201);
        expect(inEuro.body.item.feePercent).toBe(0);
        expect(inEuro.body.item.feeEuro).toBe(0);
        expect(inEuro.body.item.payoutEuro).toBe(50);
    });

    it('accepts amount even when not matching earned credits (informational report)', async () => {
        const env = await setupSettlementEnvironment();

        const res = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 200, feePercent: 0 });

        expect(res.status).toBe(201);
        expect(res.body.item.payoutEuro).toBe(100);
    });

    it('validates inputs and stand membership', async () => {
        const env = await setupSettlementEnvironment();

        const noStand = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.otherStand._id.toString(), amount: 10 });
        expect(noStand.status).toBe(404);

        const noAmount = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 0 });
        expect(noAmount.status).toBe(400);

        const badFee = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 10, feePercent: 101 });
        expect(badFee.status).toBe(400);
    });

    it('lists settlements with totals and performed-by name', async () => {
        const env = await setupSettlementEnvironment();

        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 100, feePercent: 10 });
        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand2._id.toString(), amount: 40, feePercent: 0 });

        const res = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(2);
        expect(res.body.totals.settledCredits).toBe(140);
        expect(res.body.totals.payoutEuro).toBe(65);
        expect(res.body.totals.count).toBe(2);
        expect(res.body.items[0].performedByName).toBe('Exchange Tester');
        const stand1Item = res.body.items.find((i: { standId: string }) => i.standId === env.stand1._id.toString());
        expect(stand1Item.payoutEuro).toBe(45);
        expect(res.body.pagination.totalPages).toBe(1);

        const filtered = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements?standId=${env.stand1._id}`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(filtered.status).toBe(200);
        expect(filtered.body.items).toHaveLength(1);
        expect(filtered.body.items[0].standId).toBe(env.stand1._id.toString());
    });

    it('summary reflects settled credits after settlement', async () => {
        const env = await setupSettlementEnvironment();
        await env.paidOrder(env.stand1._id, 100);

        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 30, feePercent: 0 });

        const res = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements/summary`)
            .set('Cookie', `sid=${env.sessionToken}`);

        const stand1 = res.body.stands.find((s: { standId: string }) => s.standId === env.stand1._id.toString());
        expect(stand1.earnedCredits).toBe(100);
        expect(stand1.settledCredits).toBe(30);
        expect(await StandSettlementModel.countDocuments()).toBe(1);
    });

    it('report aggregates settlements per stand with euro totals', async () => {
        const env = await setupSettlementEnvironment();
        await env.paidOrder(env.stand1._id, 100);

        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 100, feePercent: 10 });
        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand2._id.toString(), amount: 40, feePercent: 0 });

        const res = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements/report`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.eventName).toBe('Settlement Event');
        expect(res.body.exchangeRate).toBe(2);
        expect(res.body.currencyName).toBe('TC');

        const stand1 = res.body.stands.find((s: { standId: string }) => s.standId === env.stand1._id.toString());
        expect(stand1).toBeDefined();
        expect(stand1.settlementCount).toBe(1);
        expect(stand1.settledCredits).toBe(100);
        expect(stand1.earnedCredits).toBe(100);
        expect(stand1.grossEuro).toBe(50);
        expect(stand1.feeEuro).toBe(5);
        expect(stand1.payoutEuro).toBe(45);
        expect(stand1.toReturnCredits).toBe(0);

        const stand2 = res.body.stands.find((s: { standId: string }) => s.standId === env.stand2._id.toString());
        expect(stand2).toBeDefined();
        expect(stand2.payoutEuro).toBe(20);

        expect(res.body.totals.settlementCount).toBe(2);
        expect(res.body.totals.settledCredits).toBe(140);
        expect(res.body.totals.grossEuro).toBe(70);
        expect(res.body.totals.feeEuro).toBe(5);
        expect(res.body.totals.payoutEuro).toBe(65);
    });

    it('report filters settlements by date range', async () => {
        const env = await setupSettlementEnvironment();

        await StandSettlementModel.create({
            eventId: env.event._id,
            standId: env.stand1._id,
            standName: 'Stand Alpha',
            amount: 100,
            exchangeRate: 2,
            feePercent: 0,
            grossEuro: 50,
            feeEuro: 0,
            payoutEuro: 50,
            occurredAt: new Date('2026-06-01T10:00:00Z')
        });
        await StandSettlementModel.create({
            eventId: env.event._id,
            standId: env.stand1._id,
            standName: 'Stand Alpha',
            amount: 40,
            exchangeRate: 2,
            feePercent: 0,
            grossEuro: 20,
            feeEuro: 0,
            payoutEuro: 20,
            occurredAt: new Date('2026-06-05T10:00:00Z')
        });

        const res = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements/report?from=2026-06-01&to=2026-06-02`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.totals.settlementCount).toBe(1);
        expect(res.body.totals.settledCredits).toBe(100);
        expect(res.body.totals.payoutEuro).toBe(50);
    });

    it('report returns empty aggregates when no settlements exist', async () => {
        const env = await setupSettlementEnvironment();

        const res = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements/report`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.stands).toEqual([]);
        expect(res.body.totals.settlementCount).toBe(0);
        expect(res.body.totals.settledCredits).toBe(0);
        expect(res.body.totals.payoutEuro).toBe(0);
    });

    it('creates debit (credit load) with no euro payout and fee ignored', async () => {
        const env = await setupSettlementEnvironment();

        const res = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 50, feePercent: 50, direction: 'debit', description: 'anticipo' });

        expect(res.status).toBe(201);
        expect(res.body.item.direction).toBe('debit');
        expect(res.body.item.amount).toBe(50);
        expect(res.body.item.feePercent).toBe(0);
        expect(res.body.item.grossEuro).toBe(0);
        expect(res.body.item.feeEuro).toBe(0);
        expect(res.body.item.payoutEuro).toBe(0);
        expect(res.body.item.description).toBe('anticipo');
    });

    it('summary tracks loaded credits to return (dare - avere)', async () => {
        const env = await setupSettlementEnvironment();
        await env.paidOrder(env.stand1._id, 100);

        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 50, direction: 'debit' });
        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 20, feePercent: 0 });

        const res = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements/summary`)
            .set('Cookie', `sid=${env.sessionToken}`);

        const stand1 = res.body.stands.find((s: { standId: string }) => s.standId === env.stand1._id.toString());
        expect(stand1.earnedCredits).toBe(100);
        expect(stand1.loadedCredits).toBe(50);
        expect(stand1.settledCredits).toBe(20);
        expect(stand1.toReturnCredits).toBe(30);
    });

    it('report splits loaded and settled credits per stand', async () => {
        const env = await setupSettlementEnvironment();
        await env.paidOrder(env.stand1._id, 100);

        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 50, direction: 'debit' });
        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 30, feePercent: 10 });

        const res = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements/report`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);
        const stand1 = res.body.stands.find((s: { standId: string }) => s.standId === env.stand1._id.toString());
        expect(stand1.loadedCredits).toBe(50);
        expect(stand1.settledCredits).toBe(30);
        expect(stand1.loadCount).toBe(1);
        expect(stand1.settlementCount).toBe(1);
        expect(stand1.toReturnCredits).toBe(20);
        expect(stand1.grossEuro).toBe(15);
        expect(stand1.feeEuro).toBe(1.5);
        expect(stand1.payoutEuro).toBe(13.5);

        expect(res.body.totals.loadedCredits).toBe(50);
        expect(res.body.totals.settledCredits).toBe(30);
        expect(res.body.totals.toReturnCredits).toBe(20);
        expect(res.body.totals.loadCount).toBe(1);
        expect(res.body.totals.settlementCount).toBe(1);
        expect(res.body.totals.payoutEuro).toBe(13.5);
    });

    it('list filters by direction and splits totals', async () => {
        const env = await setupSettlementEnvironment();

        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 50, direction: 'debit' });
        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 30, feePercent: 0 });

        const res = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements?direction=debit`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].direction).toBe('debit');
        expect(res.body.totals.loadedCredits).toBe(50);
        expect(res.body.totals.settledCredits).toBe(0);
        expect(res.body.totals.payoutEuro).toBe(0);
        expect(res.body.totals.count).toBe(1);

        const all = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(all.body.totals.loadedCredits).toBe(50);
        expect(all.body.totals.settledCredits).toBe(30);
        expect(all.body.totals.payoutEuro).toBe(15);
        expect(all.body.totals.count).toBe(2);
    });

    it('creates AVERE settlement directly in euro without conversion or fee', async () => {
        const env = await setupSettlementEnvironment();

        const res = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 30, unit: 'euro', feePercent: 50 });

        expect(res.status).toBe(201);
        expect(res.body.item.unit).toBe('euro');
        expect(res.body.item.amount).toBe(30);
        expect(res.body.item.grossEuro).toBe(30);
        expect(res.body.item.feeEuro).toBe(0);
        expect(res.body.item.feePercent).toBe(0);
        expect(res.body.item.payoutEuro).toBe(30);
    });

    it('rejects euro settlements with denomination counts', async () => {
        const env = await setupSettlementEnvironment();

        const res = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({
                standId: env.stand1._id.toString(),
                amount: 30,
                unit: 'euro',
                denominations: [{ label: '5 TC', value: 5, count: 6 }]
            });

        expect(res.status).toBe(400);
    });

    it('creates DARE entry in euro as receivable with no cash movement', async () => {
        const env = await setupSettlementEnvironment();

        const res = await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 25, unit: 'euro', direction: 'debit' });

        expect(res.status).toBe(201);
        expect(res.body.item.unit).toBe('euro');
        expect(res.body.item.direction).toBe('debit');
        expect(res.body.item.amount).toBe(25);
        expect(res.body.item.grossEuro).toBe(0);
        expect(res.body.item.feeEuro).toBe(0);
        expect(res.body.item.payoutEuro).toBe(0);
    });

    it('summary and list split credits vs euro entries', async () => {
        const env = await setupSettlementEnvironment();

        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 50, direction: 'debit' });
        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 20, feePercent: 0 });
        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 15, unit: 'euro' });
        await request(app)
            .post(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ standId: env.stand1._id.toString(), amount: 7, unit: 'euro', direction: 'debit' });

        const sum = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements/summary`)
            .set('Cookie', `sid=${env.sessionToken}`);
        const stand1 = sum.body.stands.find((s: { standId: string }) => s.standId === env.stand1._id.toString());
        expect(stand1.loadedCredits).toBe(50);
        expect(stand1.settledCredits).toBe(20);
        expect(stand1.loadedEuro).toBe(7);
        expect(stand1.settledEuro).toBe(15);

        const list = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(list.body.totals.loadedCredits).toBe(50);
        expect(list.body.totals.settledCredits).toBe(20);
        expect(list.body.totals.loadedEuro).toBe(7);
        expect(list.body.totals.settledEuro).toBe(15);
        expect(list.body.totals.payoutEuro).toBe(25);

        const report = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements/report`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(report.status).toBe(200);
        const repStand = report.body.stands.find((s: { standId: string }) => s.standId === env.stand1._id.toString());
        expect(repStand.loadedEuro).toBe(7);
        expect(repStand.settledEuro).toBe(15);
        expect(repStand.grossEuro).toBe(25);
        expect(repStand.payoutEuro).toBe(25);
        expect(report.body.totals.loadedEuro).toBe(7);
        expect(report.body.totals.settledEuro).toBe(15);
    });

    it('treats legacy records without unit as credits', async () => {
        const env = await setupSettlementEnvironment();

        await StandSettlementModel.collection.insertOne({
            eventId: env.event._id,
            standId: env.stand1._id,
            standName: 'Stand Alpha',
            amount: 40,
            exchangeRate: 2,
            feePercent: 0,
            grossEuro: 20,
            feeEuro: 0,
            payoutEuro: 20,
            occurredAt: new Date()
        });

        const sum = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements/summary`)
            .set('Cookie', `sid=${env.sessionToken}`);
        const stand1 = sum.body.stands.find((s: { standId: string }) => s.standId === env.stand1._id.toString());
        expect(stand1.settledCredits).toBe(40);
        expect(stand1.settledEuro).toBe(0);

        const list = await request(app)
            .get(`/api/exchange/${env.event._id}/settlements`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(list.body.items[0].unit).toBe('credits');
        expect(list.body.totals.settledCredits).toBe(40);
        expect(list.body.totals.settledEuro).toBe(0);
    });
});
