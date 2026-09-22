import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/cloudinary', () => ({
    cloudinary: {
        upload: { stream: vi.fn() },
        api: { delete_resources: vi.fn() }
    }
}));

vi.mock('@/services/cloudinary-upload.service', () => ({
    deleteImage: vi.fn().mockResolvedValue(undefined),
    uploadImage: vi.fn(),
    uploadImages: vi.fn()
}));

import { Types } from 'mongoose';

import { EventModel } from '../../models/event.model';
import { EventProductModel } from '../../models/event-product.model';
import { EventUserModel } from '../../models/event-user.model';
import { EventUserTransactionModel } from '../../models/event-user-transaction.model';
import { OrderModel } from '../../models/order.model';
import { ProductModel } from '../../models/product.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { StandModel } from '../../models/stand.model';
import { StationModel } from '../../models/station.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createUser(emailSuffix: string, firstName: string) {
    return UserModel.create({
        firstName,
        lastName: 'Tester',
        email: `${emailSuffix}-${Date.now()}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        isActive: true
    });
}

async function createSession(userId: Types.ObjectId) {
    const sessionToken = generateSessionToken();
    await SessionModel.create({
        userId,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: getSessionExpiryDate(),
        lastActivityAt: new Date()
    });
    return sessionToken;
}

async function createPlatformAdmin(userId: Types.ObjectId) {
    const platformAdminRole = await RoleModel.create({
        name: 'Platform Admin',
        scope: 'platform',
        slug: 'platform-admin',
        permissions: [],
        isSystem: true,
        isActive: true
    });
    await UserRoleModel.create({
        userId,
        roleId: platformAdminRole._id,
        isActive: true
    });
}

async function setupEnvironment() {
    app = createTestApp();

    const adminUser = await createUser('visitors-admin', 'Visitors');
    const adminSession = await createSession(adminUser._id);
    await createPlatformAdmin(adminUser._id);

    const plainUser = await createUser('visitors-plain', 'Plain');
    const plainSession = await createSession(plainUser._id);

    const event = await EventModel.create({
        name: 'Visitors Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-30'),
        currencyName: 'TC',
        cashPaymentsEnabled: true
    });

    const stand1 = await StandModel.create({
        name: 'Stand One',
        eventIds: [event._id],
        numbers: [{ eventId: event._id, number: 1 }]
    });
    const stand2 = await StandModel.create({
        name: 'Stand Two',
        eventIds: [event._id],
        numbers: [{ eventId: event._id, number: 2 }]
    });
    const standNoData = await StandModel.create({
        name: 'Stand No Data',
        eventIds: [event._id],
        numbers: [{ eventId: event._id, number: 3 }]
    });

    const station1 = await StationModel.create({ standId: stand1._id, name: 'Station One' });
    const station2 = await StationModel.create({ standId: stand2._id, name: 'Station Two' });

    const productDrink = await ProductModel.create({ name: 'Bevanda', price: 3 });
    const productBurger = await ProductModel.create({ name: 'Panino', price: 8 });
    const productPlain = await ProductModel.create({ name: 'Prodotto senza categoria', price: 5 });

    const epDrink = await EventProductModel.create({
        eventId: event._id,
        standId: stand1._id,
        productId: productDrink._id,
        stationIds: [station1._id],
        categoryIds: ['Bevande']
    });
    const epBurger = await EventProductModel.create({
        eventId: event._id,
        standId: stand1._id,
        productId: productBurger._id,
        stationIds: [station1._id],
        categoryIds: ['Panini']
    });
    const epPlain = await EventProductModel.create({
        eventId: event._id,
        standId: stand2._id,
        productId: productPlain._id,
        stationIds: [station2._id]
    });

    return {
        adminSession,
        plainSession,
        event,
        stand1,
        stand2,
        standNoData,
        station1,
        epDrink,
        epBurger,
        epPlain
    };
}

let orderSeq = 0;

async function createOrderDoc(env: Awaited<ReturnType<typeof setupEnvironment>>, params: {
    standId: Types.ObjectId;
    epId: Types.ObjectId;
    stationId: Types.ObjectId;
    quantity: number;
    unitPrice?: number;
    creditAmountUsed?: number;
    status?: string;
    isGift?: boolean;
    cancelled?: boolean;
    customerName?: string | null;
    createdAt?: Date;
}) {
    orderSeq += 1;
    const unitPrice = params.unitPrice ?? 1;
    const subtotal = unitPrice * params.quantity;
    return OrderModel.create({
        eventId: env.event._id,
        standId: params.standId,
        orderNumber: orderSeq,
        userId: new Types.ObjectId(),
        customerName: params.customerName ?? null,
        status: params.cancelled ? 'cancelled' : (params.status ?? 'completed'),
        isGift: params.isGift ?? false,
        items: [{
            eventProductId: params.epId,
            productId: new Types.ObjectId(),
            productName: 'Item',
            stationId: params.stationId,
            stationName: 'Station',
            quantity: params.quantity,
            unitPrice,
            subtotal
        }],
        total: subtotal,
        creditAmountUsed: params.creditAmountUsed ?? 0,
        paymentStatus: params.cancelled ? 'refunded' : 'paid',
        createdAt: params.createdAt ?? new Date()
    });
}

async function createTopUp(env: Awaited<ReturnType<typeof setupEnvironment>>, eventUserId: Types.ObjectId, amount: number, at?: Date) {
    return EventUserTransactionModel.create({
        eventUserId,
        eventId: env.event._id,
        userId: null,
        type: 'top-up',
        direction: 'credit',
        amount,
        realAmount: amount,
        balanceAfter: amount,
        occurredAt: at ?? new Date()
    });
}

async function createRefund(env: Awaited<ReturnType<typeof setupEnvironment>>, eventUserId: Types.ObjectId, amount: number, at?: Date) {
    return EventUserTransactionModel.create({
        eventUserId,
        eventId: env.event._id,
        userId: null,
        type: 'refund',
        direction: 'debit',
        amount,
        realAmount: amount,
        balanceAfter: 0,
        occurredAt: at ?? new Date()
    });
}

function getVisitors(sessionToken: string, eventId: string, query = '') {
    return request(app)
        .get(`/api/events/${eventId}/visitors${query}`)
        .set('Cookie', `sid=${sessionToken}`);
}

describe('Integration — Visitor estimation', () => {
    it('401 without auth', async () => {
        const env = await setupEnvironment();
        const res = await request(app).get(`/api/events/${env.event._id}/visitors`);
        expect(res.status).toBe(401);
    });

    it('403 for user without roles', async () => {
        const env = await setupEnvironment();
        const res = await getVisitors(env.plainSession, env.event._id.toString());
        expect(res.status).toBe(403);
    });

    it('200 product-based estimate applies category coefficients and default for no category', async () => {
        const env = await setupEnvironment();

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 2
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epBurger._id, stationId: env.station1._id, quantity: 3
        });
        await createOrderDoc(env, {
            standId: env.stand2._id, epId: env.epPlain._id, stationId: new Types.ObjectId(), quantity: 4
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        expect(res.body.coefficientMap).toMatchObject({ bevande: 0.33, dolci: 0.8 });
        expect(res.body.defaultCoefficient).toBe(1);

        const stand1 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand One');
        const stand2 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand Two');

        expect(stand1).toBeDefined();
        expect(stand1.number).toBe(1);
        expect(stand1.ordersCount).toBe(2);
        expect(stand1.categories).toEqual([
            expect.objectContaining({ label: 'Panini', quantity: 3, coefficient: 1, estimatedVisitors: 3 }),
            expect.objectContaining({ label: 'Bevande', quantity: 2, coefficient: 0.33, estimatedVisitors: 0.7 })
        ]);
        expect(stand1.estimatedVisitorsTotal).toBe(3.7);

        expect(stand2.categories).toEqual([
            expect.objectContaining({ label: 'Senza categoria', quantity: 4, coefficient: 1, estimatedVisitors: 4 })
        ]);
        expect(stand2.estimatedVisitorsTotal).toBe(4);

        expect(res.body.totals.productEstimated).toBe(7.7);
        expect(res.body.totals.nonCancelledOrders).toBe(3);
    });

    it('gift and cancelled orders are excluded from quantities', async () => {
        const env = await setupEnvironment();

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 2
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 5, isGift: true
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 3, cancelled: true
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        const stand1 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand One');
        expect(stand1.categories).toEqual([
            expect.objectContaining({ label: 'Bevande', quantity: 2, coefficient: 0.33, estimatedVisitors: 0.7 })
        ]);
        expect(stand1.ordersCount).toBe(2);
        expect(res.body.totals.nonCancelledOrders).toBe(2);
    });

    it('token-based estimate uses net sold tokens over observed average spend', async () => {
        const env = await setupEnvironment();

        const customerA = await EventUserModel.create({ eventId: env.event._id, balance: 0 });
        const customerB = await EventUserModel.create({ eventId: env.event._id, balance: 0 });

        await createTopUp(env, customerA._id, 80);
        await createTopUp(env, customerB._id, 40);
        await createRefund(env, customerA._id, 20);

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 1, creditAmountUsed: 10
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 1, creditAmountUsed: 10
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 1, creditAmountUsed: 30, cancelled: true
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        expect(res.body.tokensPerVisitor).toBe(10);
        expect(res.body.totals.tokenBasedEstimated).toBe(10);
        expect(res.body.totals.distinctTokenBuyers).toBe(2);
        expect(res.body.totals.netTokensSold).toBe(100);
    });

    it('falls back to DEFAULT_TOKENS_PER_VISITOR when no paid orders exist', async () => {
        const env = await setupEnvironment();

        const customer = await EventUserModel.create({ eventId: env.event._id, balance: 0 });
        await createTopUp(env, customer._id, 100);

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        expect(res.body.tokensPerVisitor).toBe(10);
        expect(res.body.totals.tokenBasedEstimated).toBe(10);
    });

    it('standId filter returns only the requested stand', async () => {
        const env = await setupEnvironment();

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 4
        });
        await createOrderDoc(env, {
            standId: env.stand2._id, epId: env.epPlain._id, stationId: new Types.ObjectId(), quantity: 2
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString(), `?standId=${env.stand1._id}`);
        expect(res.status).toBe(200);

        expect(res.body.stands).toHaveLength(1);
        expect(res.body.stands[0].standName).toBe('Stand One');
    });

    it('from/to window filters orders and token transactions', async () => {
        const env = await setupEnvironment();

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 2,
            createdAt: new Date('2026-09-10T10:00:00')
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 4,
            createdAt: new Date('2026-09-15T10:00:00')
        });

        const customer = await EventUserModel.create({ eventId: env.event._id, balance: 0 });
        await createTopUp(env, customer._id, 40, new Date('2026-09-11T08:00:00'));
        await createTopUp(env, customer._id, 60, new Date('2026-09-16T08:00:00'));

        const res = await getVisitors(
            env.adminSession,
            env.event._id.toString(),
            '?from=2026-09-12&to=2026-09-16'
        );
        expect(res.status).toBe(200);

        const stand1 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand One');
        expect(stand1.categories).toEqual([
            expect.objectContaining({ label: 'Bevande', quantity: 4, estimatedVisitors: 1.3 })
        ]);
        expect(res.body.totals.netTokensSold).toBe(60);
        expect(res.body.totals.distinctTokenBuyers).toBe(1);
        expect(res.body.totals.nonCancelledOrders).toBe(1);
    });

    it('stands without orders are listed with hasOrders false and zero estimate', async () => {
        const env = await setupEnvironment();

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 2
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        const noData = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand No Data');
        expect(noData).toBeDefined();
        expect(noData.hasOrders).toBe(false);
        expect(noData.ordersCount).toBe(0);
        expect(noData.estimatedVisitorsTotal).toBe(0);
    });

    it('a product in multiple categories is counted once, in its category with the highest coefficient', async () => {
        const env = await setupEnvironment();

        const productMulti = await ProductModel.create({ name: 'Pizza fritta', price: 8 });
        const epMulti = await EventProductModel.create({
            eventId: env.event._id,
            standId: env.stand1._id,
            productId: productMulti._id,
            stationIds: [env.station1._id],
            categoryIds: ['Bevande', 'Dolci']
        });

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: epMulti._id, stationId: env.station1._id, quantity: 5
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        const stand1 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand One');
        expect(stand1.categories).toEqual([
            expect.objectContaining({ label: 'Dolci', quantity: 5, coefficient: 0.8, estimatedVisitors: 4 })
        ]);
        expect(stand1.estimatedVisitorsTotal).toBe(4);
        expect(res.body.totals.productEstimated).toBe(4);
    });
});