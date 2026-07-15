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
        firstName: 'Lifecycle',
        lastName: 'Tester',
        email: `lifecycle-${Date.now()}-${Math.random()}@test.com`,
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

async function setupOrderEnvironment(overrides: {
    cashPaymentsEnabled?: boolean;
    productPrice?: number;
    itemQty?: number;
} = {}) {
    const { user, sessionToken } = await createAuthSession();

    const event = await EventModel.create({
        name: 'Lifecycle Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC',
        cashPaymentsEnabled: overrides.cashPaymentsEnabled ?? false
    });

    const stand = await StandModel.create({
        name: 'Lifecycle Stand',
        eventIds: [event._id]
    });

    const station = await StationModel.create({
        standId: stand._id,
        name: 'Lifecycle Station'
    });

    const product = await ProductModel.create({
        name: 'Lifecycle Product',
        price: overrides.productPrice ?? 10
    });

    const eventProduct = await EventProductModel.create({
        eventId: event._id,
        standId: stand._id,
        productId: product._id,
        stationIds: [station._id]
    });

    await CounterModel.create({ standId: stand._id, seq: 0 });

    return {
        user,
        sessionToken,
        event,
        stand,
        station,
        product,
        eventProduct
    };
}

describe('Integration — Order Lifecycle', () => {
    it('full lifecycle: unpaid → confirmed → preparing → ready → completed', async () => {
        app = createTestApp();
        const { sessionToken, event, stand, station, eventProduct } = await setupOrderEnvironment();

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

        expect(createRes.status).toBe(201);
        expect(createRes.body.item.status).toBe('pending');
        expect(createRes.body.item.paymentStatus).toBe('unpaid');
        const orderId = createRes.body.item.id;

        const confirmRes = await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'confirmed' });

        expect(confirmRes.status).toBe(200);
        expect(confirmRes.body.item.status).toBe('confirmed');

        const prepareRes = await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'preparing' });

        expect(prepareRes.status).toBe(200);
        expect(prepareRes.body.item.status).toBe('preparing');

        const markReadyRes = await request(app)
            .patch(`/api/orders/${orderId}/mark-item-ready`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventProductId: eventProduct._id.toString() });

        expect(markReadyRes.status).toBe(200);
        expect(markReadyRes.body.item.status).toBe('ready');

        const completeRes = await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'completed' });

        expect(completeRes.status).toBe(200);
        expect(completeRes.body.item.status).toBe('completed');
    });

    it('full lifecycle with credit payment', async () => {
        app = createTestApp();
        const { user, sessionToken, event, stand, station, eventProduct } = await setupOrderEnvironment({
            productPrice: 30
        });

        await EventUserModel.create({
            eventId: event._id,
            userId: user._id,
            balance: 100,
            isActive: true
        });

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
                ],
                paymentOnCreate: { creditAmount: 30 }
            });

        expect(createRes.status).toBe(201);
        expect(createRes.body.item.paymentStatus).toBe('paid');
        expect(createRes.body.item.creditAmountUsed).toBe(30);
        expect(createRes.body.item.status).toBe('confirmed');

        const eu = await EventUserModel.findOne({
            eventId: event._id,
            userId: user._id
        });
        expect(eu!.balance).toBe(70);

        const orderId = createRes.body.item.id;

        const prepareRes = await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'preparing' });

        expect(prepareRes.status).toBe(200);

        const markReadyRes = await request(app)
            .patch(`/api/orders/${orderId}/mark-item-ready`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventProductId: eventProduct._id.toString() });

        expect(markReadyRes.status).toBe(200);
        expect(markReadyRes.body.item.status).toBe('ready');

        const completeRes = await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'completed' });

        expect(completeRes.status).toBe(200);
        expect(completeRes.body.item.status).toBe('completed');
    });

    it('order with mixed payment: credits + cash', async () => {
        app = createTestApp();
        const { user, sessionToken, event, stand, station, eventProduct } = await setupOrderEnvironment({
            cashPaymentsEnabled: true,
            productPrice: 20
        });

        await EventUserModel.create({
            eventId: event._id,
            userId: user._id,
            balance: 50,
            isActive: true
        });

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
                ],
                paymentOnCreate: { creditAmount: 10 }
            });

        expect(createRes.status).toBe(201);
        expect(createRes.body.item.total).toBe(20);
        expect(createRes.body.item.creditAmountUsed).toBe(10);
        expect(createRes.body.item.paymentStatus).toBe('paid');
        expect(createRes.body.item.status).toBe('confirmed');

        const eu = await EventUserModel.findOne({
            eventId: event._id,
            userId: user._id
        });
        expect(eu!.balance).toBe(40);

        const orderId = createRes.body.item.id;

        const prepareRes = await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'preparing' });

        expect(prepareRes.status).toBe(200);

        const markReadyRes = await request(app)
            .patch(`/api/orders/${orderId}/mark-item-ready`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventProductId: eventProduct._id.toString() });

        expect(markReadyRes.status).toBe(200);
        expect(markReadyRes.body.item.status).toBe('ready');

        const completeRes = await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'completed' });

        expect(completeRes.status).toBe(200);
        expect(completeRes.body.item.status).toBe('completed');
    });

    it('cancel paid order refunds credits', async () => {
        app = createTestApp();
        const { user, sessionToken, event, stand, station, eventProduct } = await setupOrderEnvironment({
            productPrice: 25
        });

        await EventUserModel.create({
            eventId: event._id,
            userId: user._id,
            balance: 100,
            isActive: true
        });

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
                ],
                paymentOnCreate: { creditAmount: 25 }
            });

        expect(createRes.status).toBe(201);
        expect(createRes.body.item.paymentStatus).toBe('paid');
        expect(createRes.body.item.creditAmountUsed).toBe(25);

        let eu = await EventUserModel.findOne({
            eventId: event._id,
            userId: user._id
        });
        expect(eu!.balance).toBe(75);

        const orderId = createRes.body.item.id;

        await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'confirmed' });

        const cancelRes = await request(app)
            .post(`/api/orders/${orderId}/cancel`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ reason: 'Changed mind' });

        expect(cancelRes.status).toBe(200);
        expect(cancelRes.body.item.status).toBe('cancelled');
        expect(cancelRes.body.item.paymentStatus).toBe('refunded');
        expect(cancelRes.body.item.cancelReason).toBe('Changed mind');
        expect(cancelRes.body.item.cancelledAt).toBeDefined();

        eu = await EventUserModel.findOne({
            eventId: event._id,
            userId: user._id
        });
        expect(eu!.balance).toBe(100);
    });

    it('order cancellation prevents further status changes', async () => {
        app = createTestApp();
        const { sessionToken, event, stand, station, eventProduct } = await setupOrderEnvironment();

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

        await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'confirmed' });

        const cancelRes = await request(app)
            .post(`/api/orders/${orderId}/cancel`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ reason: 'No longer needed' });

        expect(cancelRes.status).toBe(200);
        expect(cancelRes.body.item.status).toBe('cancelled');

        const prepareRes = await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'preparing' });

        expect(prepareRes.status).toBe(400);
    });
});
