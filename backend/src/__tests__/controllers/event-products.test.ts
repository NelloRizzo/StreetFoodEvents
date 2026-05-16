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

import { EventModel } from '../../models/event.model';
import { EventProductModel } from '../../models/event-product.model';
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
        firstName: 'EP',
        lastName: 'Tester',
        email: `ep-${Date.now()}@test.com`,
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

describe('EventProducts API', () => {
    it('lists event-products filtered by standId', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'Stand', eventIds: [event._id] });
        const otherStand = await StandModel.create({ name: 'Other' });

        const station = await StationModel.create({ standId: stand._id, name: 'Stazione' });
        const product = await ProductModel.create({ name: 'Burger', price: 10 });

        await EventProductModel.create({
            eventId: event._id,
            standId: stand._id,
            productId: product._id,
            stationIds: [station._id]
        });

        await EventProductModel.create({
            eventId: event._id,
            standId: otherStand._id,
            productId: product._id,
            stationIds: [station._id]
        });

        const res = await request(app).get(`/api/event-products?standId=${stand._id}`);
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
    });

    it('creates an event-product when authenticated', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Cucina' });
        const product = await ProductModel.create({ name: 'Pizza', price: 8 });

        const res = await request(app)
            .post('/api/event-products')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                productId: product._id.toString(),
                stationIds: [station._id.toString()],
                priceOverride: 10
            });

        expect(res.status).toBe(201);
        expect(res.body.item.priceOverride).toBe(10);
    });

    it('returns 401 for create without auth', async () => {
        app = createTestApp();
        const res = await request(app)
            .post('/api/event-products')
            .send({ eventId: 'x', standId: 'x', productId: 'x', stationIds: ['x'] });
        expect(res.status).toBe(401);
    });

    it('deletes an event-product', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'Stand' });
        const station = await StationModel.create({ standId: stand._id, name: 'Bar' });
        const product = await ProductModel.create({ name: 'Drink', price: 3 });

        const ep = await EventProductModel.create({
            eventId: event._id,
            standId: stand._id,
            productId: product._id,
            stationIds: [station._id]
        });

        const res = await request(app)
            .delete(`/api/event-products/${ep._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);

        const found = await EventProductModel.findById(ep._id);
        expect(found).toBeNull();
    });
});
