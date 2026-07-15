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
        firstName: 'Receipt',
        lastName: 'Tester',
        email: `receipt-${Date.now()}@test.com`,
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

async function createTestOrder(sessionToken: string) {
    const event = await EventModel.create({
        name: 'Receipt Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC'
    });

    const stand = await StandModel.create({
        name: 'Receipt Stand',
        eventIds: [event._id]
    });

    const station = await StationModel.create({
        standId: stand._id,
        name: 'Receipt Station'
    });

    const product = await ProductModel.create({
        name: 'Panino',
        price: 12
    });

    const eventProduct = await EventProductModel.create({
        eventId: event._id,
        standId: stand._id,
        productId: product._id,
        stationIds: [station._id]
    });

    await CounterModel.create({ standId: stand._id, seq: 0 });

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
                    quantity: 3
                }
            ]
        });

    return { event, stand, order: res.body.item };
}

describe('Orders Receipt API', () => {
    it('gets order receipt (public)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const { event, stand, order } = await createTestOrder(sessionToken);

        const res = await request(app)
            .get(`/api/orders/${order.id}/receipt`);

        expect(res.status).toBe(200);
        expect(res.body.item.id).toBe(order.id);
        expect(res.body.item.items).toHaveLength(1);
        expect(res.body.item.items[0].productName).toBe('Panino');
        expect(res.body.item.items[0].quantity).toBe(3);
        expect(res.body.item.items[0].subtotal).toBe(36);
        expect(res.body.item.total).toBe(36);
        expect(res.body.item.standName).toBe('Receipt Stand');
        expect(res.body.item.eventName).toBe('Receipt Event');
        expect(res.body.item.receiptQrCode).toContain('data:image');
    });

    it('returns 404 for non-existent receipt', async () => {
        app = createTestApp();

        const fakeId = '507f1f77bcf86cd799439011';
        const res = await request(app)
            .get(`/api/orders/${fakeId}/receipt`);

        expect(res.status).toBe(404);
    });

    it('gets receipt QR code (auth required)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const { order } = await createTestOrder(sessionToken);

        const res = await request(app)
            .get(`/api/orders/${order.id}/receipt-qrcode`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.qrCode).toContain('data:image');
    });

    it('returns 401 for receipt-qrcode without auth', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const { order } = await createTestOrder(sessionToken);

        const res = await request(app)
            .get(`/api/orders/${order.id}/receipt-qrcode`);

        expect(res.status).toBe(401);
    });
});
