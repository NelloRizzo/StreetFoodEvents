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

    it('lists orders filtered by multiple comma-separated stationIds', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Multi Station Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'Multi Stand', eventIds: [event._id] });
        const stationA = await StationModel.create({ standId: stand._id, name: 'Station A' });
        const stationB = await StationModel.create({ standId: stand._id, name: 'Station B' });
        const productA = await ProductModel.create({ name: 'Multi Item A', price: 5 });
        const productB = await ProductModel.create({ name: 'Multi Item B', price: 6 });
        const epA = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: productA._id, stationIds: [stationA._id]
        });
        const epB = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: productB._id, stationIds: [stationB._id]
        });
        await CounterModel.create({ standId: stand._id, seq: 0 });

        const createOrder = (eventProductId: string, stationId: string) =>
            request(app)
                .post('/api/orders')
                .set('Cookie', `sid=${sessionToken}`)
                .send({
                    eventId: event._id.toString(),
                    standId: stand._id.toString(),
                    items: [{ eventProductId, stationId, quantity: 1 }]
                });

        await createOrder(epA._id.toString(), stationA._id.toString());
        await createOrder(epB._id.toString(), stationB._id.toString());

        const res = await request(app)
            .get(`/api/orders?stationId=${stationA._id.toString()},${stationB._id.toString()}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(2);

        const singleRes = await request(app)
            .get(`/api/orders?stationId=${stationA._id.toString()}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(singleRes.status).toBe(200);
        expect(singleRes.body.items).toHaveLength(1);
    });

    it('returns stand display orders publicly (confirmed/preparing/ready only)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Display Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'Display Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Griglia' });
        const product = await ProductModel.create({ name: 'Burger', price: 10 });
        const eventProduct = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: product._id, stationIds: [station._id]
        });
        await CounterModel.create({ standId: stand._id, seq: 0 });

        const createOrder = async (quantity: number, payOnCreate = true) => {
            return request(app)
                .post('/api/orders')
                .set('Cookie', `sid=${sessionToken}`)
                .send({
                    eventId: event._id.toString(),
                    standId: stand._id.toString(),
                    items: [{ eventProductId: eventProduct._id.toString(), stationId: station._id.toString(), quantity }],
                    paymentOnCreate: payOnCreate ? { creditAmount: 0 } : undefined
                });
        };

        const pendingRes = await createOrder(1, false);
        const confirmedRes = await createOrder(1);
        const preparingRes = await createOrder(1);
        const readyRes = await createOrder(1);
        const completedRes = await createOrder(1);

        const confirmedId = confirmedRes.body.item.id;
        const preparingId = preparingRes.body.item.id;
        const readyId = readyRes.body.item.id;
        const completedId = completedRes.body.item.id;

        const patch = (id: string, status: string) =>
            request(app)
                .patch(`/api/orders/${id}/status`)
                .set('Cookie', `sid=${sessionToken}`)
                .send({ status });

        await patch(preparingId, 'preparing');
        await patch(readyId, 'preparing');
        await patch(readyId, 'ready');
        await patch(completedId, 'preparing');
        await patch(completedId, 'ready');
        await patch(completedId, 'completed');

        const res = await request(app).get(`/api/orders/stand/${stand._id}/ordersqueue`);

        expect(res.status).toBe(200);
        expect(res.body.standName).toBe('Display Stand');

        const returnedIds = res.body.items.map((o: { id: string }) => o.id);
        expect(returnedIds).not.toContain(pendingRes.body.item.id);
        expect(returnedIds).toContain(confirmedId);
        expect(returnedIds).toContain(preparingId);
        expect(returnedIds).toContain(readyId);
        expect(returnedIds).not.toContain(completedId);

        const readyOrder = res.body.items.find((o: { id: string }) => o.id === readyId);
        expect(readyOrder.status).toBe('ready');
        expect(readyOrder.items[0].productName).toBe('Burger');
        expect(readyOrder.items[0].ready).toBe(true);
        expect(readyOrder.items[0].quantity).toBe(1);
    });

    it('returns 404 for stand display with unknown stand', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/orders/stand/000000000000000000000000/ordersqueue');
        expect(res.status).toBe(404);
    });

    it('sets readyAt on ready transition and hides stale ready orders from display queue', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Ready Timeout Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'Ready Timeout Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Griglia' });
        const product = await ProductModel.create({ name: 'Ready Item', price: 10 });
        const eventProduct = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: product._id, stationIds: [station._id]
        });
        await CounterModel.create({ standId: stand._id, seq: 0 });

        const createOrder = async () => {
            const res = await request(app)
                .post('/api/orders')
                .set('Cookie', `sid=${sessionToken}`)
                .send({
                    eventId: event._id.toString(),
                    standId: stand._id.toString(),
                    items: [{ eventProductId: eventProduct._id.toString(), stationId: station._id.toString(), quantity: 1 }],
                    paymentOnCreate: { creditAmount: 0 }
                });
            return res.body.item.id as string;
        };

        const patch = (id: string, status: string) =>
            request(app)
                .patch(`/api/orders/${id}/status`)
                .set('Cookie', `sid=${sessionToken}`)
                .send({ status });

        const freshId = await createOrder();
        const staleId = await createOrder();

        await patch(freshId, 'preparing');
        const readyRes = await patch(freshId, 'ready');
        expect(readyRes.status).toBe(200);
        expect(readyRes.body.item.readyAt).toBeDefined();

        await patch(staleId, 'preparing');
        await patch(staleId, 'ready');
        await OrderModel.findByIdAndUpdate(staleId, { readyAt: new Date(Date.now() - 3 * 60 * 1000) });

        const res = await request(app).get(`/api/orders/stand/${stand._id}/ordersqueue`);

        expect(res.status).toBe(200);
        const returnedIds = res.body.items.map((o: { id: string }) => o.id);
        expect(returnedIds).toContain(freshId);
        expect(returnedIds).not.toContain(staleId);
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

    it('creates a gift order with forced confirmed/paid state and zero total', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Gift Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'Gift Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Gift Station' });
        const product = await ProductModel.create({ name: 'Omaggio Burger', price: 12 });
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
                isGift: true
            });

        expect(res.status).toBe(201);
        expect(res.body.item.isGift).toBe(true);
        expect(res.body.item.status).toBe('confirmed');
        expect(res.body.item.paymentStatus).toBe('paid');
        expect(res.body.item.total).toBe(0);
        expect(res.body.item.creditAmountUsed).toBe(0);
        expect(res.body.item.paidAt).toBeDefined();
        expect(res.body.item.paymentTransactionId).toBeNull();
        expect(res.body.item.items[0].productName).toBe('Omaggio Burger');
        expect(res.body.item.items[0].quantity).toBe(2);
        expect(res.body.item.items[0].subtotal).toBe(24);
    });

    it('returns gift stats with counts and threshold', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Gift Stats Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'Gift Stats Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Gift Stats Station' });
        const product = await ProductModel.create({ name: 'Stats Item', price: 10 });
        const eventProduct = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: product._id, stationIds: [station._id]
        });
        await CounterModel.create({ standId: stand._id, seq: 0 });

        const createOrder = async (isGift: boolean) => {
            const res = await request(app)
                .post('/api/orders')
                .set('Cookie', `sid=${sessionToken}`)
                .send({
                    eventId: event._id.toString(),
                    standId: stand._id.toString(),
                    items: [{ eventProductId: eventProduct._id.toString(), stationId: station._id.toString(), quantity: 1 }],
                    paymentOnCreate: isGift ? undefined : { creditAmount: 0 },
                    isGift
                });
            return res.body.item;
        };

        const orderA = await createOrder(false);
        const orderB = await createOrder(false);
        const gift1 = await createOrder(true);
        const gift2 = await createOrder(true);

        const res = await request(app)
            .get(`/api/orders/gift-stats?eventId=${event._id}&standId=${stand._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.totalOrders).toBe(4);
        expect(res.body.giftOrders).toBe(2);
        expect(res.body.giftPercentage).toBe(50);
        expect(res.body.giftThreshold).toBe(5);
        expect(res.body.thresholdExceeded).toBe(true);

        await request(app)
            .post(`/api/orders/${gift2.id}/cancel`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ reason: 'Gift cancelled' });

        const afterCancel = await request(app)
            .get(`/api/orders/gift-stats?eventId=${event._id}&standId=${stand._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(afterCancel.body.totalOrders).toBe(3);
        expect(afterCancel.body.giftOrders).toBe(1);

        const otherStand = await StandModel.create({ name: 'Other Stand', eventIds: [event._id] });
        const otherRes = await request(app)
            .get(`/api/orders/gift-stats?standId=${otherStand._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(otherRes.status).toBe(200);
        expect(otherRes.body.totalOrders).toBe(0);
        expect(otherRes.body.giftOrders).toBe(0);
        expect(otherRes.body.giftPercentage).toBe(0);
        expect(otherRes.body.thresholdExceeded).toBe(false);
    });

    it('returns gift stats threshold not exceeded at exactly 5 percent', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Gift Boundary Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'Gift Boundary Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Boundary Station' });
        const product = await ProductModel.create({ name: 'Boundary Item', price: 10 });
        const eventProduct = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: product._id, stationIds: [station._id]
        });
        await CounterModel.create({ standId: stand._id, seq: 0 });

        const createOrder = async (isGift: boolean) => {
            const res = await request(app)
                .post('/api/orders')
                .set('Cookie', `sid=${sessionToken}`)
                .send({
                    eventId: event._id.toString(),
                    standId: stand._id.toString(),
                    items: [{ eventProductId: eventProduct._id.toString(), stationId: station._id.toString(), quantity: 1 }],
                    paymentOnCreate: isGift ? undefined : { creditAmount: 0 },
                    isGift
                });
            return res.body.item;
        };

        for (let i = 0; i < 19; i++) {
            await createOrder(false);
        }
        await createOrder(true);

        const boundary = await request(app)
            .get(`/api/orders/gift-stats?eventId=${event._id}&standId=${stand._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(boundary.body.totalOrders).toBe(20);
        expect(boundary.body.giftOrders).toBe(1);
        expect(boundary.body.giftPercentage).toBe(5);
        expect(boundary.body.thresholdExceeded).toBe(false);

        await createOrder(true);

        const above = await request(app)
            .get(`/api/orders/gift-stats?eventId=${event._id}&standId=${stand._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(above.body.totalOrders).toBe(21);
        expect(above.body.giftOrders).toBe(2);
        expect(above.body.giftPercentage).toBe(9.5);
        expect(above.body.thresholdExceeded).toBe(true);
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
            .send({ status: 'preparing' });

        expect(res.status).toBe(400);
    });
});
