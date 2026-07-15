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

import { CounterModel } from '../../models/counter.model';
import { EventModel } from '../../models/event.model';
import { EventProductModel } from '../../models/event-product.model';
import { EventUserModel } from '../../models/event-user.model';
import { OrderModel } from '../../models/order.model';
import { ProductModel } from '../../models/product.model';
import { SessionModel } from '../../models/session.model';
import { StandModel } from '../../models/stand.model';
import { StationModel } from '../../models/station.model';
import { UserModel } from '../../models/user.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession() {
    const user = await UserModel.create({
        firstName: 'Pay',
        lastName: 'Tester',
        email: `pay-${Date.now()}-${Math.random()}@test.com`,
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

async function createOrderWithSetup(overrides: {
    cashPaymentsEnabled?: boolean;
    itemQty?: number;
    productPrice?: number;
} = {}) {
    const { user, sessionToken } = await createAuthSession();

    const event = await EventModel.create({
        name: 'PayTest Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC',
        cashPaymentsEnabled: overrides.cashPaymentsEnabled ?? false
    });

    const stand = await StandModel.create({
        name: 'PayTest Stand',
        eventIds: [event._id]
    });

    const station = await StationModel.create({
        standId: stand._id,
        name: 'PayTest Station'
    });

    const product = await ProductModel.create({
        name: 'PayTest Product',
        price: overrides.productPrice ?? 10
    });

    const eventProduct = await EventProductModel.create({
        eventId: event._id,
        standId: stand._id,
        productId: product._id,
        stationIds: [station._id]
    });

    await CounterModel.create({ standId: stand._id, seq: 0 });

    await EventUserModel.create({
        eventId: event._id,
        userId: user._id,
        balance: 100,
        isActive: true
    });

    const quantity = overrides.itemQty ?? 1;

    const createRes = await request(app)
        .post('/api/orders')
        .set('Cookie', `sid=${sessionToken}`)
        .send({
            eventId: event._id.toString(),
            standId: stand._id.toString(),
            items: [
                {
                    eventProductId: eventProduct._id.toString(),
                    stationId: station._id.toString(),
                    quantity
                }
            ]
        });

    return {
        user,
        sessionToken,
        event,
        stand,
        station,
        product,
        eventProduct,
        order: createRes.body.item
    };
}

describe('Orders Pay / Mark-Ready / Cancel-Items', () => {
    it('pays an unpaid order with credits', async () => {
        app = createTestApp();
        const { sessionToken, event, order } = await createOrderWithSetup({ productPrice: 10 });

        const res = await request(app)
            .post(`/api/orders/${order.id}/pay`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ creditAmount: 10 });

        expect(res.status).toBe(200);
        expect(res.body.item.paymentStatus).toBe('paid');
        expect(res.body.item.creditAmountUsed).toBe(10);
        expect(res.body.item.paidAt).toBeDefined();
    });

    it('rejects pay on already paid order', async () => {
        app = createTestApp();
        const { sessionToken, order } = await createOrderWithSetup({ productPrice: 10 });

        await request(app)
            .post(`/api/orders/${order.id}/pay`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ creditAmount: 10 });

        const res = await request(app)
            .post(`/api/orders/${order.id}/pay`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ creditAmount: 10 });

        expect(res.status).toBe(400);
    });

    it('mark item ready', async () => {
        app = createTestApp();
        const { sessionToken, eventProduct, order } = await createOrderWithSetup();

        const res = await request(app)
            .patch(`/api/orders/${order.id}/mark-item-ready`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventProductId: eventProduct._id.toString() });

        expect(res.status).toBe(200);
        const item = res.body.item.items.find(
            (i: { eventProductId: string }) => i.eventProductId === eventProduct._id.toString()
        );
        expect(item.ready).toBe(true);
    });

    it('auto-transitions to ready when all items ready', async () => {
        app = createTestApp();
        const { sessionToken, eventProduct, order } = await createOrderWithSetup();

        const res = await request(app)
            .patch(`/api/orders/${order.id}/mark-item-ready`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventProductId: eventProduct._id.toString() });

        expect(res.status).toBe(200);
        expect(res.body.item.status).toBe('ready');
    });

    it('mark station ready', async () => {
        app = createTestApp();
        const { sessionToken, user } = await createAuthSession();

        const eventDoc = await EventModel.create({
            name: 'Station Ready Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'SR Stand', eventIds: [eventDoc._id] });

        const stationA = await StationModel.create({ standId: stand._id, name: 'Station A' });
        const stationB = await StationModel.create({ standId: stand._id, name: 'Station B' });

        const productA = await ProductModel.create({ name: 'Item A', price: 5 });
        const productB = await ProductModel.create({ name: 'Item B', price: 8 });

        const epA = await EventProductModel.create({
            eventId: eventDoc._id, standId: stand._id, productId: productA._id, stationIds: [stationA._id]
        });
        const epB = await EventProductModel.create({
            eventId: eventDoc._id, standId: stand._id, productId: productB._id, stationIds: [stationB._id]
        });

        await CounterModel.create({ standId: stand._id, seq: 0 });
        await EventUserModel.create({ eventId: eventDoc._id, userId: user._id, balance: 100, isActive: true });

        const createRes = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: eventDoc._id.toString(),
                standId: stand._id.toString(),
                items: [
                    { eventProductId: epA._id.toString(), stationId: stationA._id.toString(), quantity: 1 },
                    { eventProductId: epB._id.toString(), stationId: stationB._id.toString(), quantity: 1 }
                ]
            });

        const orderId = createRes.body.item.id;

        await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'confirmed' });

        await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'preparing' });

        const res = await request(app)
            .patch(`/api/orders/${orderId}/mark-station-ready`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ stationId: stationA._id.toString() });

        expect(res.status).toBe(200);
        expect(res.body.item.status).toBe('preparing');

        const itemA = res.body.item.items.find(
            (i: { eventProductId: string }) => i.eventProductId === epA._id.toString()
        );
        const itemB = res.body.item.items.find(
            (i: { eventProductId: string }) => i.eventProductId === epB._id.toString()
        );
        expect(itemA.ready).toBe(true);
        expect(itemB.ready).toBe(false);
    });

    it('cancel order items', async () => {
        app = createTestApp();
        const { sessionToken, user } = await createAuthSession();

        const eventDoc = await EventModel.create({
            name: 'Cancel Items Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'CI Stand', eventIds: [eventDoc._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'CI Station' });

        const p1 = await ProductModel.create({ name: 'Burger', price: 10 });
        const p2 = await ProductModel.create({ name: 'Fries', price: 5 });

        const ep1 = await EventProductModel.create({
            eventId: eventDoc._id, standId: stand._id, productId: p1._id, stationIds: [station._id]
        });
        const ep2 = await EventProductModel.create({
            eventId: eventDoc._id, standId: stand._id, productId: p2._id, stationIds: [station._id]
        });

        await CounterModel.create({ standId: stand._id, seq: 0 });
        await EventUserModel.create({ eventId: eventDoc._id, userId: user._id, balance: 100, isActive: true });

        const createRes = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: eventDoc._id.toString(),
                standId: stand._id.toString(),
                items: [
                    { eventProductId: ep1._id.toString(), stationId: station._id.toString(), quantity: 1 },
                    { eventProductId: ep2._id.toString(), stationId: station._id.toString(), quantity: 2 }
                ]
            });

        const orderId = createRes.body.item.id;
        expect(createRes.body.item.total).toBe(20);

        const res = await request(app)
            .patch(`/api/orders/${orderId}/cancel-items`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ itemIds: [ep1._id.toString()] });

        expect(res.status).toBe(200);
        expect(res.body.item.items).toHaveLength(1);
        expect(res.body.item.total).toBe(10);
        expect(res.body.item.items[0].productName).toBe('Fries');
    });

    it('rejects cancelling all items', async () => {
        app = createTestApp();
        const { sessionToken, eventProduct, order } = await createOrderWithSetup();

        const res = await request(app)
            .patch(`/api/orders/${order.id}/cancel-items`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ itemIds: [eventProduct._id.toString()] });

        expect(res.status).toBe(400);
    });

    it('reset order counter', async () => {
        app = createTestApp();
        const { sessionToken, stand } = await createOrderWithSetup();

        const res = await request(app)
            .post('/api/orders/reset-counter')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ standId: stand._id.toString() });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Counter reset to 0');
    });

    it('returns 401 without auth on pay', async () => {
        app = createTestApp();
        const { order } = await createOrderWithSetup();

        const res = await request(app)
            .post(`/api/orders/${order.id}/pay`)
            .send({ creditAmount: 10 });

        expect(res.status).toBe(401);
    });

    it('refund excess credits on cancel-items', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Refund Items Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'RI Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'RI Station' });

        const ep1 = await EventProductModel.create({
            eventId: event._id, standId: stand._id,
            productId: (await ProductModel.create({ name: 'A', price: 15 }))._id,
            stationIds: [station._id]
        });
        const ep2 = await EventProductModel.create({
            eventId: event._id, standId: stand._id,
            productId: (await ProductModel.create({ name: 'B', price: 10 }))._id,
            stationIds: [station._id]
        });

        await CounterModel.create({ standId: stand._id, seq: 0 });
        await EventUserModel.create({ eventId: event._id, userId: user._id, balance: 100, isActive: true });

        const createRes = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                items: [
                    { eventProductId: ep1._id.toString(), stationId: station._id.toString(), quantity: 1 },
                    { eventProductId: ep2._id.toString(), stationId: station._id.toString(), quantity: 1 }
                ],
                paymentOnCreate: { creditAmount: 25 }
            });

        expect(createRes.body.item.paymentStatus).toBe('paid');
        expect(createRes.body.item.creditAmountUsed).toBe(25);

        let eu = await EventUserModel.findOne({ eventId: event._id, userId: user._id });
        expect(eu!.balance).toBe(75);

        const orderId = createRes.body.item.id;

        const res = await request(app)
            .patch(`/api/orders/${orderId}/cancel-items`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ itemIds: [ep1._id.toString()] });

        expect(res.status).toBe(200);
        expect(res.body.item.items).toHaveLength(1);
        expect(res.body.item.total).toBe(10);
        expect(res.body.item.creditAmountUsed).toBe(10);

        eu = await EventUserModel.findOne({ eventId: event._id, userId: user._id });
        expect(eu!.balance).toBe(90);
    });
});
