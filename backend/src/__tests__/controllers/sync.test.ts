import type { Express } from 'express';
import request from 'supertest';
import { Types } from 'mongoose';
import * as argon2 from 'argon2';
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
import { StandModel } from '../../models/stand.model';
import { StationModel } from '../../models/station.model';
import { createTestApp } from '../helpers/test-app';

let app: Express;

const TOKEN = { Authorization: 'Bearer test-sync-token' };
const SYNC_PASSWORD = 'sync-pass-123';
const PWD = { 'X-Sync-Password': SYNC_PASSWORD };

async function seedEventWithStand(password = true) {
    const event = await EventModel.create({
        name: 'Sync Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2099-06-01'),
        endDate: new Date('2099-06-07'),
        currencyName: 'Moneta',
        exchangeRate: 2
    });
    const stand = await StandModel.create({
        type: 'food',
        name: 'Sync Stand',
        eventIds: [event._id],
        numbers: [{ eventId: event._id, number: 1, showOnMap: true }],
        ...(password ? { syncPasswordHash: await argon2.hash(SYNC_PASSWORD) } : {})
    });
    const station = await StationModel.create({ standId: stand._id, name: 'Cucina', sequenceOrder: 0 });
    const product = await ProductModel.create({ name: 'Panino', price: 5 });
    const ep = await EventProductModel.create({
        eventId: event._id,
        standId: stand._id,
        productId: product._id,
        stationIds: [station._id],
        priceOverride: null,
        available: true
    });
    return { event, stand, station, product, ep };
}

describe('Sync API', () => {
    it('requires a valid bearer token', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/sync/events');
        expect(res.status).toBe(401);
    });

    it('lists events with token', async () => {
        app = createTestApp();
        await seedEventWithStand();

        const res = await request(app).get('/api/sync/events').set(TOKEN);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(1);
        expect(res.body.items[0].name).toBe('Sync Event');
    });

    it('lists stands for an event', async () => {
        app = createTestApp();
        const { event, stand } = await seedEventWithStand();

        const res = await request(app).get(`/api/sync/events/${event._id}/stands`).set(TOKEN);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(1);
        expect(res.body.items[0].id).toBe(stand._id.toString());
        expect(res.body.items[0].number).toBe(1);
        expect(res.body.items[0].syncEnabled).toBe(true);
    });

    it('returns full snapshot for event+stand with the sync password', async () => {
        app = createTestApp();
        const { event, stand, ep } = await seedEventWithStand();

        const res = await request(app)
            .get(`/api/sync/events/${event._id}/stands/${stand._id}`)
            .set(TOKEN)
            .set(PWD);

        expect(res.status).toBe(200);
        expect(res.body.event.name).toBe('Sync Event');
        expect(res.body.stand.name).toBe('Sync Stand');
        expect(res.body.stations.length).toBe(1);
        expect(res.body.eventProducts.length).toBe(1);
        expect(res.body.eventProducts[0]._id).toBe(ep._id.toString());
        expect(res.body.counter.seq).toBe(0);
        expect(res.body.stand.syncPasswordHash).toBeUndefined();
    });

    it('rejects a snapshot without the sync password', async () => {
        app = createTestApp();
        const { event, stand } = await seedEventWithStand();

        const res = await request(app).get(`/api/sync/events/${event._id}/stands/${stand._id}`).set(TOKEN);
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Password di sincronizzazione non valida');
    });

    it('rejects a snapshot with the wrong sync password', async () => {
        app = createTestApp();
        const { event, stand } = await seedEventWithStand();

        const res = await request(app)
            .get(`/api/sync/events/${event._id}/stands/${stand._id}`)
            .set(TOKEN)
            .set('X-Sync-Password', 'wrong-password');
        expect(res.status).toBe(401);
    });

    it('rejects a snapshot for a stand without a configured sync password', async () => {
        app = createTestApp();
        const { event, stand } = await seedEventWithStand(false);

        const res = await request(app)
            .get(`/api/sync/events/${event._id}/stands/${stand._id}`)
            .set(TOKEN)
            .set(PWD);
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Password di sincronizzazione non configurata per questo stand');
    });

    it('rejects a stand that does not belong to the event', async () => {
        app = createTestApp();
        const eventA = await EventModel.create({
            name: 'A',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2099-06-01'),
            endDate: new Date('2099-06-07'),
            currencyName: 'M'
        });
        const eventB = await EventModel.create({
            name: 'B',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2099-06-01'),
            endDate: new Date('2099-06-07'),
            currencyName: 'M'
        });
        const stand = await StandModel.create({ name: 'Stand', eventIds: [eventB._id] });

        const res = await request(app)
            .get(`/api/sync/events/${eventA._id}/stands/${stand._id}`)
            .set(TOKEN);
        expect(res.status).toBe(400);
    });

    it('pushes orders and counters with the sync password', async () => {
        app = createTestApp();
        const { event, stand, product, ep } = await seedEventWithStand();
        const orderId = new Types.ObjectId();

        const res = await request(app)
            .post('/api/sync/push')
            .set(TOKEN)
            .set(PWD)
            .send({
                standId: stand._id.toString(),
                orders: [
                    {
                        _id: orderId.toString(),
                        eventId: event._id.toString(),
                        standId: stand._id.toString(),
                        orderNumber: 1,
                        userId: new Types.ObjectId().toString(),
                        customerId: null,
                        status: 'confirmed',
                        isGift: false,
                        items: [
                            {
                                eventProductId: ep._id.toString(),
                                productId: product._id.toString(),
                                productName: 'Panino',
                                stationId: new Types.ObjectId().toString(),
                                stationName: 'Cucina',
                                quantity: 1,
                                unitPrice: 5,
                                subtotal: 5,
                                ready: false,
                                notes: null
                            }
                        ],
                        total: 5,
                        creditAmountUsed: 0,
                        paymentStatus: 'unpaid',
                        paidAt: null,
                        paymentTransactionId: null,
                        performedByUserId: null,
                        notes: null,
                        cancelledAt: null,
                        cancelReason: null,
                        readyAt: null,
                        updatedAt: new Date().toISOString()
                    }
                ],
                counters: [{ standId: stand._id.toString(), seq: 5 }]
            });

        expect(res.status).toBe(200);
        expect(res.body.results.orders).toBe(1);
        expect(await OrderModel.findById(orderId)).not.toBeNull();
        const counter = await CounterModel.findOne({ standId: stand._id }).lean();
        expect(counter?.seq).toBe(5);
    });

    it('rejects push without standId', async () => {
        app = createTestApp();
        const res = await request(app).post('/api/sync/push').set(TOKEN).set(PWD).send({ orders: [] });
        expect(res.status).toBe(400);
    });

    it('rejects push without the sync password', async () => {
        app = createTestApp();
        const { stand } = await seedEventWithStand();

        const res = await request(app)
            .post('/api/sync/push')
            .set(TOKEN)
            .send({ standId: stand._id.toString(), orders: [] });
        expect(res.status).toBe(401);
    });

    it('rejects push with the wrong sync password', async () => {
        app = createTestApp();
        const { stand } = await seedEventWithStand();

        const res = await request(app)
            .post('/api/sync/push')
            .set(TOKEN)
            .set('X-Sync-Password', 'wrong-password')
            .send({ standId: stand._id.toString(), orders: [] });
        expect(res.status).toBe(401);
    });
});
