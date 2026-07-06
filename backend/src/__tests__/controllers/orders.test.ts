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
        firstName: 'Order',
        lastName: 'Tester',
        email: `order-${Date.now()}@test.com`,
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

describe('Orders API', () => {
    it('lists orders (empty)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .get('/api/orders')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('returns 401 without auth', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/orders');
        expect(res.status).toBe(401);
    });

    it('creates an order with items', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Test Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({
            name: 'Test Stand',
            eventIds: [event._id]
        });

        const station = await StationModel.create({
            standId: stand._id,
            name: 'Test Station'
        });

        const product = await ProductModel.create({
            name: 'Burger',
            price: 10
        });

        const eventProduct = await EventProductModel.create({
            eventId: event._id,
            standId: stand._id,
            productId: product._id,
            stationIds: [station._id]
        });

        await CounterModel.create({
            standId: stand._id,
            seq: 0
        });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                items: [
                    {
                        eventProductId: eventProduct._id.toString(),
                        stationId: station._id.toString(),
                        quantity: 2
                    }
                ]
            });

        expect(res.status).toBe(201);
        expect(res.body.item.items).toHaveLength(1);
        expect(res.body.item.items[0]!.productName).toBe('Burger');
        expect(res.body.item.items[0]!.quantity).toBe(2);
        expect(res.body.item.total).toBe(20);
        expect(res.body.item.status).toBe('pending');
        expect(res.body.item.paymentStatus).toBe('unpaid');
    });

    it('creates an order with payment on create', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Pay Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({
            name: 'Pay Stand',
            eventIds: [event._id]
        });

        const station = await StationModel.create({
            standId: stand._id,
            name: 'Pay Station'
        });

        const product = await ProductModel.create({
            name: 'Pizza',
            price: 15
        });

        const eventProduct = await EventProductModel.create({
            eventId: event._id,
            standId: stand._id,
            productId: product._id,
            stationIds: [station._id]
        });

        await EventUserModel.create({
            eventId: event._id,
            userId: user._id,
            balance: 50,
            isActive: true
        });

        await CounterModel.create({
            standId: stand._id,
            seq: 0
        });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                items: [
                    {
                        eventProductId: eventProduct._id.toString(),
                        stationId: station._id.toString(),
                        quantity: 1
                    }
                ],
                paymentOnCreate: { creditAmount: 15 }
            });

        expect(res.status).toBe(201);
        expect(res.body.item.paymentStatus).toBe('paid');
        expect(res.body.item.creditAmountUsed).toBe(15);

        const eu = await EventUserModel.findOne({
            eventId: event._id,
            userId: user._id
        });
        expect(eu!.balance).toBe(35);
    });

    it('cancels an unpaid order', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Cancel Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({
            name: 'Cancel Stand',
            eventIds: [event._id]
        });

        const station = await StationModel.create({
            standId: stand._id,
            name: 'Cancel Station'
        });

        const product = await ProductModel.create({
            name: 'Fries',
            price: 5
        });

        const eventProduct = await EventProductModel.create({
            eventId: event._id,
            standId: stand._id,
            productId: product._id,
            stationIds: [station._id]
        });

        await CounterModel.create({ standId: stand._id, seq: 0 });

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
                        quantity: 1
                    }
                ]
            });

        const orderId = createRes.body.item.id;

        const cancelRes = await request(app)
            .post(`/api/orders/${orderId}/cancel`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ reason: 'Test cancel' });

        expect(cancelRes.status).toBe(200);
        expect(cancelRes.body.item.status).toBe('cancelled');
        expect(cancelRes.body.item.cancelReason).toBe('Test cancel');
        expect(cancelRes.body.item.cancelledAt).toBeDefined();
    });

    it('updates order status through workflow', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Status Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({
            name: 'Status Stand',
            eventIds: [event._id]
        });

        const station = await StationModel.create({
            standId: stand._id,
            name: 'Status Station'
        });

        const product = await ProductModel.create({
            name: 'Drink',
            price: 3
        });

        const eventProduct = await EventProductModel.create({
            eventId: event._id,
            standId: stand._id,
            productId: product._id,
            stationIds: [station._id]
        });

        await CounterModel.create({ standId: stand._id, seq: 0 });

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
                        quantity: 1
                    }
                ]
            });

        const orderId = createRes.body.item.id;

        const transitions = ['confirmed', 'preparing', 'ready', 'completed'];
        for (const status of transitions) {
            const res = await request(app)
                .patch(`/api/orders/${orderId}/status`)
                .set('Cookie', `sid=${sessionToken}`)
                .send({ status });

            expect(res.status).toBe(200);
            expect(res.body.item.status).toBe(status);
        }
    });

    it('creates an order with cash payment (unified cashier)', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Cash Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC',
            cashPaymentsEnabled: true
        });

        const stand = await StandModel.create({ name: 'Cash Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Cash Station' });
        const product = await ProductModel.create({ name: 'Cash Item', price: 10 });
        const eventProduct = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: product._id, stationIds: [station._id]
        });
        await CounterModel.create({ standId: stand._id, seq: 0 });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                items: [{ eventProductId: eventProduct._id.toString(), stationId: station._id.toString(), quantity: 2 }],
                paymentOnCreate: { creditAmount: 0 }
            });

        expect(res.status).toBe(201);
        expect(res.body.item.status).toBe('confirmed');
        expect(res.body.item.paymentStatus).toBe('paid');
        expect(res.body.item.creditAmountUsed).toBe(0);
        expect(res.body.item.paidAt).toBeDefined();
    });

    it('rejects paymentOnCreate when cash disabled and creditAmount < total', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Credits Only Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC',
            cashPaymentsEnabled: false
        });

        const stand = await StandModel.create({ name: 'Credits Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Credits Station' });
        const product = await ProductModel.create({ name: 'Credits Item', price: 10 });
        const eventProduct = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: product._id, stationIds: [station._id]
        });
        await CounterModel.create({ standId: stand._id, seq: 0 });
        await EventUserModel.create({ eventId: event._id, userId: user._id, balance: 5, isActive: true });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                items: [{ eventProductId: eventProduct._id.toString(), stationId: station._id.toString(), quantity: 1 }],
                paymentOnCreate: { creditAmount: 3 }
            });

        expect(res.status).toBe(400);
    });

    it('rejects paymentOnCreate with insufficient balance', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Insuff Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC',
            cashPaymentsEnabled: true
        });

        const stand = await StandModel.create({ name: 'Insuff Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Insuff Station' });
        const product = await ProductModel.create({ name: 'Expensive', price: 100 });
        const eventProduct = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: product._id, stationIds: [station._id]
        });
        await CounterModel.create({ standId: stand._id, seq: 0 });
        await EventUserModel.create({ eventId: event._id, userId: user._id, balance: 10, isActive: true });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                items: [{ eventProductId: eventProduct._id.toString(), stationId: station._id.toString(), quantity: 1 }],
                paymentOnCreate: { creditAmount: 50 }
            });

        expect(res.status).toBe(400);
    });

    it('cancels a paid order and refunds credits', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Refund Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'Refund Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Refund Station' });
        const product = await ProductModel.create({ name: 'Refundable', price: 20 });
        const eventProduct = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: product._id, stationIds: [station._id]
        });
        await CounterModel.create({ standId: stand._id, seq: 0 });
        await EventUserModel.create({ eventId: event._id, userId: user._id, balance: 50, isActive: true });

        const createRes = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                items: [{ eventProductId: eventProduct._id.toString(), stationId: station._id.toString(), quantity: 1 }],
                paymentOnCreate: { creditAmount: 20 }
            });

        expect(createRes.body.item.paymentStatus).toBe('paid');
        let eu = await EventUserModel.findOne({ eventId: event._id, userId: user._id });
        expect(eu!.balance).toBe(30);

        const orderId = createRes.body.item.id;
        const cancelRes = await request(app)
            .post(`/api/orders/${orderId}/cancel`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ reason: 'Customer request' });

        expect(cancelRes.status).toBe(200);
        expect(cancelRes.body.item.status).toBe('cancelled');
        expect(cancelRes.body.item.paymentStatus).toBe('refunded');
        expect(cancelRes.body.item.cancelReason).toBe('Customer request');

        eu = await EventUserModel.findOne({ eventId: event._id, userId: user._id });
        expect(eu!.balance).toBe(50);
    });

    it('cancels a paid cash order and sets refunded status', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Cash Cancel Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC',
            cashPaymentsEnabled: true
        });

        const stand = await StandModel.create({ name: 'Cash Cancel Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Cash Cancel Station' });
        const product = await ProductModel.create({ name: 'CashItem', price: 15 });
        const eventProduct = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: product._id, stationIds: [station._id]
        });
        await CounterModel.create({ standId: stand._id, seq: 0 });

        const createRes = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                items: [{ eventProductId: eventProduct._id.toString(), stationId: station._id.toString(), quantity: 1 }],
                paymentOnCreate: { creditAmount: 0 }
            });

        expect(createRes.body.item.paymentStatus).toBe('paid');
        expect(createRes.body.item.creditAmountUsed).toBe(0);

        const orderId = createRes.body.item.id;
        const cancelRes = await request(app)
            .post(`/api/orders/${orderId}/cancel`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ reason: 'Wrong order' });

        expect(cancelRes.status).toBe(200);
        expect(cancelRes.body.item.status).toBe('cancelled');
        expect(cancelRes.body.item.paymentStatus).toBe('refunded');
    });

    it('rejects cancelling an already completed order', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Compl Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'Compl Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Compl Station' });
        const product = await ProductModel.create({ name: 'C', price: 1 });
        const eventProduct = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: product._id, stationIds: [station._id]
        });
        await CounterModel.create({ standId: stand._id, seq: 0 });

        const createRes = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                items: [{ eventProductId: eventProduct._id.toString(), stationId: station._id.toString(), quantity: 1 }]
            });

        const orderId = createRes.body.item.id;

        const transitions = ['confirmed', 'preparing', 'ready', 'completed'];
        for (const status of transitions) {
            const r = await request(app)
                .patch(`/api/orders/${orderId}/status`)
                .set('Cookie', `sid=${sessionToken}`)
                .send({ status });
            expect(r.status).toBe(200);
        }

        const cancelRes = await request(app)
            .post(`/api/orders/${orderId}/cancel`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ reason: 'Too late' });

        expect(cancelRes.status).toBe(400);
    });

    it('rejects invalid status transition', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Bad Trans',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({
            name: 'Bad Trans Stand',
            eventIds: [event._id]
        });

        const station = await StationModel.create({
            standId: stand._id,
            name: 'Bad Station'
        });

        const product = await ProductModel.create({ name: 'X', price: 1 });

        const eventProduct = await EventProductModel.create({
            eventId: event._id,
            standId: stand._id,
            productId: product._id,
            stationIds: [station._id]
        });

        await CounterModel.create({ standId: stand._id, seq: 0 });

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
                        quantity: 1
                    }
                ]
            });

        const orderId = createRes.body.item.id;

        const res = await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'completed' });

        expect(res.status).toBe(400);
    });
});
