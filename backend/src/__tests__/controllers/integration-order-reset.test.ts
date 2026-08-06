import * as argon2 from 'argon2';
import type { Express } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { CounterModel } from '../../models/counter.model';
import { EventModel } from '../../models/event.model';
import { EventUserModel } from '../../models/event-user.model';
import { EventUserTransactionModel } from '../../models/event-user-transaction.model';
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
        firstName: 'Reset',
        lastName: 'Tester',
        email: `reset-${Date.now()}@test.com`,
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

async function setupResetEnvironment() {
    app = createTestApp();
    const { user, sessionToken } = await createAuthSession();

    const platformAdminRole = await RoleModel.create({
        name: 'Platform Admin',
        scope: 'platform',
        slug: 'platform-admin',
        permissions: [],
        isSystem: true,
        isActive: true
    });

    await UserRoleModel.create({
        userId: user._id,
        roleId: platformAdminRole._id,
        isActive: true
    });

    const event = await EventModel.create({
        name: 'Reset Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC',
        exchangeRate: 2,
        cashPaymentsEnabled: true,
        cashRegisterResetAt: new Date('2026-06-02')
    });

    const stand = await StandModel.create({ name: 'Stand Reset', eventIds: [event._id] });
    const otherStand = await StandModel.create({ name: 'Stand Other' });

    await CounterModel.create({ standId: stand._id, seq: 7 });
    await CounterModel.create({ standId: otherStand._id, seq: 3 });

    const eventUser = await EventUserModel.create({
        eventId: event._id,
        userId: user._id,
        balance: 150
    });

    await EventUserTransactionModel.create({
        eventUserId: eventUser._id,
        eventId: event._id,
        userId: user._id,
        type: 'top-up',
        direction: 'credit',
        amount: 200,
        balanceAfter: 200,
        referenceType: 'cambio',
        performedByUserId: user._id
    });

    await EventUserTransactionModel.create({
        eventUserId: eventUser._id,
        eventId: event._id,
        userId: user._id,
        type: 'purchase',
        direction: 'debit',
        amount: 50,
        balanceAfter: 150,
        performedByUserId: user._id
    });

    await OrderModel.create({
        eventId: event._id,
        standId: stand._id,
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
        creditAmountUsed: 10,
        paymentStatus: 'paid',
        status: 'completed'
    });

    await StandSettlementModel.create({
        eventId: event._id,
        standId: stand._id,
        standName: 'Stand Reset',
        amount: 100,
        exchangeRate: 2,
        feePercent: 0,
        grossEuro: 50,
        feeEuro: 0,
        payoutEuro: 50,
        performedByUserId: user._id,
        occurredAt: new Date()
    });

    return {
        user,
        sessionToken,
        event,
        stand,
        otherStand,
        eventUser
    };
}

describe('Integration — Reset event orders', () => {
    it('rejects unauthenticated requests', async () => {
        const env = await setupResetEnvironment();

        const res = await request(app).post(`/api/orders/event/${env.event._id}/reset`);
        expect(res.status).toBe(401);
    });

    it('rejects users without platform-admin role', async () => {
        const env = await setupResetEnvironment();
        const { sessionToken: noRoleToken } = await createAuthSession();

        const res = await request(app)
            .post(`/api/orders/event/${env.event._id}/reset`)
            .set('Cookie', `sid=${noRoleToken}`);
        expect(res.status).toBe(403);
    });

    it('deletes orders, transactions, settlements, resets wallets, counters and register reset date', async () => {
        const env = await setupResetEnvironment();

        const res = await request(app)
            .post(`/api/orders/event/${env.event._id}/reset`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('1 ordini');

        expect(await OrderModel.countDocuments({ eventId: env.event._id })).toBe(0);
        expect(await EventUserTransactionModel.countDocuments({ eventId: env.event._id })).toBe(0);
        expect(await StandSettlementModel.countDocuments({ eventId: env.event._id })).toBe(0);
        expect(await CounterModel.countDocuments({ standId: env.stand._id })).toBe(0);

        const wallet = await EventUserModel.findById(env.eventUser._id);
        expect(wallet).not.toBeNull();
        expect(wallet!.balance).toBe(0);

        const refreshedEvent = await EventModel.findById(env.event._id);
        expect(refreshedEvent!.cashRegisterResetAt).toBeNull();

        const otherCounter = await CounterModel.findOne({ standId: env.otherStand._id });
        expect(otherCounter).not.toBeNull();
    });
});
