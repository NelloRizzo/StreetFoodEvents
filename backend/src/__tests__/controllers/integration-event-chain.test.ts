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
import { FavoriteModel } from '../../models/favorite.model';
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
        firstName: 'Integration',
        lastName: 'Tester',
        email: `integration-${Date.now()}@test.com`,
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

describe('Integration: Event → Stand → Product → EventProduct → Order chain', () => {
    it('create event → add stand → associate stand to event → verify', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const eventRes = await request(app)
            .post('/api/events')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                name: 'Chain Event',
                location: { label: 'Piazza', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
                startDate: '2026-08-01',
                endDate: '2026-08-05',
                currencyName: 'Coin'
            });

        expect(eventRes.status).toBe(201);
        const eventId = eventRes.body.item.id;

        const standRes = await request(app)
            .post('/api/stands')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Chain Stand', slogan: 'Tasty food' });

        expect(standRes.status).toBe(201);
        const standId = standRes.body.item.id;

        const patchRes = await request(app)
            .patch(`/api/stands/${standId}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventIds: [eventId] });

        expect(patchRes.status).toBe(200);
        expect(patchRes.body.item.eventIds).toContain(eventId);

        const listRes = await request(app).get(`/api/stands?eventId=${eventId}`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.items).toHaveLength(1);
        expect(listRes.body.items[0]!.name).toBe('Chain Stand');
    });

    it('create full product chain and order with correct data', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Full Chain Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-08-01'),
            endDate: new Date('2026-08-05'),
            currencyName: 'CC'
        });

        const stand = await StandModel.create({ name: 'Full Chain Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Grill Station' });
        const product = await ProductModel.create({ name: 'Steak', price: 15 });

        const epRes = await request(app)
            .post('/api/event-products')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                productId: product._id.toString(),
                stationIds: [station._id.toString()],
                priceOverride: 18
            });

        expect(epRes.status).toBe(201);
        const eventProductId = epRes.body.item.id;

        await CounterModel.create({ standId: stand._id, seq: 0 });

        const orderRes = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                items: [
                    {
                        eventProductId,
                        stationId: station._id.toString(),
                        quantity: 3
                    }
                ]
            });

        expect(orderRes.status).toBe(201);
        const order = orderRes.body.item;
        expect(order.items).toHaveLength(1);
        expect(order.items[0]!.productName).toBe('Steak');
        expect(order.items[0]!.stationName).toBe('Grill Station');
        expect(order.items[0]!.unitPrice).toBe(18);
        expect(order.items[0]!.quantity).toBe(3);
        expect(order.items[0]!.subtotal).toBe(54);
        expect(order.total).toBe(54);
    });

    it('favorite event shows in user favorites with populated name', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Fav Chain Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-09-01'),
            endDate: new Date('2026-09-03'),
            currencyName: 'FC'
        });

        const favRes = await request(app)
            .post('/api/favorites')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString() });

        expect(favRes.status).toBe(201);

        const listRes = await request(app)
            .get('/api/favorites')
            .set('Cookie', `sid=${sessionToken}`);

        expect(listRes.status).toBe(200);
        expect(listRes.body.items).toHaveLength(1);
        expect(listRes.body.items[0]!.event.name).toBe('Fav Chain Event');
        expect(listRes.body.items[0]!.event.id).toBe(event._id.toString());
        expect(listRes.body.items[0]!.stand).toBeNull();
    });

    it('event-product linked to correct event and stand — filtered correctly', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event1 = await EventModel.create({
            name: 'Event One',
            location: { label: 'Loc A', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-10-01'),
            endDate: new Date('2026-10-03'),
            currencyName: 'A'
        });

        const event2 = await EventModel.create({
            name: 'Event Two',
            location: { label: 'Loc B', coordinates: { type: 'Point', coordinates: [13.0, 42.0] } },
            startDate: new Date('2026-10-05'),
            endDate: new Date('2026-10-07'),
            currencyName: 'B'
        });

        const stand1 = await StandModel.create({ name: 'Stand One', eventIds: [event1._id] });
        const stand2 = await StandModel.create({ name: 'Stand Two', eventIds: [event2._id] });

        const station1 = await StationModel.create({ standId: stand1._id, name: 'Kitchen One' });
        const station2 = await StationModel.create({ standId: stand2._id, name: 'Kitchen Two' });

        const product1 = await ProductModel.create({ name: 'Pasta', price: 8 });
        const product2 = await ProductModel.create({ name: 'Sushi', price: 12 });

        await EventProductModel.create({
            eventId: event1._id,
            standId: stand1._id,
            productId: product1._id,
            stationIds: [station1._id]
        });

        await EventProductModel.create({
            eventId: event2._id,
            standId: stand2._id,
            productId: product2._id,
            stationIds: [station2._id]
        });

        const res = await request(app).get(`/api/event-products?standId=${stand1._id}`);
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0]!.standId).toBe(stand1._id.toString());
        expect(res.body.items[0]!.eventId).toBe(event1._id.toString());
        expect(res.body.items[0]!.product.name).toBe('Pasta');
    });

    it('delete event-product removes it from available products', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Delete EP Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-11-01'),
            endDate: new Date('2026-11-03'),
            currencyName: 'DE'
        });

        const stand = await StandModel.create({ name: 'Delete EP Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Delete Station' });
        const product = await ProductModel.create({ name: 'Temp Item', price: 7 });

        const epRes = await request(app)
            .post('/api/event-products')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                productId: product._id.toString(),
                stationIds: [station._id.toString()]
            });

        expect(epRes.status).toBe(201);
        const epId = epRes.body.item.id;

        const beforeRes = await request(app).get(`/api/event-products?standId=${stand._id}`);
        expect(beforeRes.body.items).toHaveLength(1);

        const delRes = await request(app)
            .delete(`/api/event-products/${epId}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(delRes.status).toBe(204);

        const afterRes = await request(app).get(`/api/event-products?standId=${stand._id}`);
        expect(afterRes.status).toBe(200);
        expect(afterRes.body.items).toHaveLength(0);

        const verifyDirect = await EventProductModel.findById(epId);
        expect(verifyDirect).toBeNull();
    });
});
