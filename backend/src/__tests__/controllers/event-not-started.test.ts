import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/cloudinary', () => ({
    cloudinary: {
        upload: { stream: vi.fn() }, api: { delete_resources: vi.fn() }
    }
}));

vi.mock('@/services/cloudinary-upload.service', () => ({
    deleteImage: vi.fn().mockResolvedValue(undefined),
    uploadImage: vi.fn(),
    uploadImages: vi.fn(),
    uploadImageBuffer: vi.fn().mockResolvedValue({
        url: 'https://res.cloudinary.com/test/image.jpg',
        publicId: 'test-image',
        width: 800,
        height: 600,
        format: 'jpg',
        bytes: 1000
    })
}));

import { Types } from 'mongoose';
import { ContestModel } from '../../models/contest.model';
import { EventModel } from '../../models/event.model';
import { EventPhotoModel } from '../../models/event-photo.model';
import { EventProductModel } from '../../models/event-product.model';
import { OrderModel } from '../../models/order.model';
import { ProductModel } from '../../models/product.model';
import { SessionModel } from '../../models/session.model';
import { StandModel } from '../../models/stand.model';
import { StationModel } from '../../models/station.model';
import { UserModel } from '../../models/user.model';
import { generateSessionToken, getSessionExpiryDate, hashSessionToken } from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession() {
    const user = await UserModel.create({
        firstName: 'Schedule',
        lastName: 'Tester',
        email: `schedule-${Date.now()}@test.com`,
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

/**
 * Evento con date **future**: e' il caso che il gate deve chiudere.
 *
 * Le date sono relative (`now + 10 giorni`) e non fisse: un test che usa una
 * data nel passato continuerebbe a passare anche con il gate rotto, e uno con
 * una data nel futuro comincerebbe a fallire da solo con il tempo.
 */
async function createFutureEvent() {
    const inTenDays = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const inTwentyDays = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const event = await EventModel.create({
        name: 'Future Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: inTenDays,
        endDate: inTwentyDays,
        currencyName: 'TC'
    });
    const stand = await StandModel.create({ name: 'Future Stand', eventIds: [event._id] });
    const station = await StationModel.create({ standId: stand._id, name: 'Future Station' });
    const product = await ProductModel.create({ name: 'Future Item', price: 5 });
    const eventProduct = await EventProductModel.create({
        eventId: event._id, standId: stand._id, productId: product._id, stationIds: [station._id]
    });
    return { event, stand, station, eventProduct };
}

describe('Operazioni bloccate su evento non ancora iniziato', () => {
    it('la cassa non crea ordini prima del via dell\'evento', async () => {
        app = await createTestApp();
        const { sessionToken } = await createAuthSession();
        const { event, stand, station, eventProduct } = await createFutureEvent();

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                items: [{
                    eventProductId: eventProduct._id.toString(),
                    stationId: station._id.toString(),
                    quantity: 1
                }]
            });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('event_not_started');
        /* Il blocco deve avvenire PRIMA di scrivere: nessun ordine, nessun
           contatore consumato, nessuna transazione. */
        expect(await OrderModel.countDocuments({ eventId: event._id })).toBe(0);
    });

    it('la cassa non incassa un ordine preesistente prima del via', async () => {
        app = await createTestApp();
        const { sessionToken } = await createAuthSession();
        const { event, stand, station, eventProduct } = await createFutureEvent();

        /* Ordine creato direttamente sul model: simula un ordine lasciato
           sospeso (o un test precedente), che deve restare non pagabile. */
        const order = await OrderModel.create({
            eventId: event._id,
            standId: stand._id,
            orderNumber: 5001,
            userId: new Types.ObjectId(),
            status: 'pending',
            paymentStatus: 'unpaid',
            total: 5,
            items: [{
                eventProductId: eventProduct._id,
                productId: new Types.ObjectId(),
                productName: 'Future Item',
                stationId: station._id,
                stationName: 'Future Station',
                quantity: 1,
                unitPrice: 5,
                subtotal: 5
            }]
        });

        const res = await request(app)
            .post(`/api/orders/${order._id.toString()}/pay`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({});

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('event_not_started');
    });

    it('non lascia avanzare lo stato di un ordine prima del via', async () => {
        app = await createTestApp();
        const { sessionToken } = await createAuthSession();
        const { event, stand, station, eventProduct } = await createFutureEvent();

        const order = await OrderModel.create({
            eventId: event._id,
            standId: stand._id,
            orderNumber: 5002,
            userId: new Types.ObjectId(),
            status: 'confirmed',
            paymentStatus: 'paid',
            paidAt: new Date(),
            total: 5,
            items: [{
                eventProductId: eventProduct._id,
                productId: new Types.ObjectId(),
                productName: 'Future Item',
                stationId: station._id,
                stationName: 'Future Station',
                quantity: 1,
                unitPrice: 5,
                subtotal: 5
            }]
        });

        const res = await request(app)
            .patch(`/api/orders/${order._id.toString()}/status`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'preparing' });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('event_not_started');
        expect((await OrderModel.findById(order._id))?.status).toBe('confirmed');
    });

    it('il contest non registra scansioni prima del via dell\'evento', async () => {
        app = await createTestApp();
        const { event } = await createFutureEvent();

        const poiId = new Types.ObjectId();
        const contest = await ContestModel.create({
            eventId: event._id,
            name: 'Future Contest',
            isActive: true,
            durationMinutes: 60,
            startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            orderedPOIIds: [poiId],
            scannedPOIIds: []
        });

        /* Il contest e' gia' "partito": il gate che deve scattare qui e' quello
           sull'EVENTO, non quello sul contest. */
        const res = await request(app)
            .post(`/api/contests/${contest._id.toString()}/scan`)
            .send({ participantId: 'anon-1', poiId: poiId.toString() });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('event_not_started');
    });

    it('non accetta foto di un evento non ancora iniziato', async () => {
        app = await createTestApp();
        const { event } = await createFutureEvent();

        const res = await request(app)
            .post(`/api/events/${event._id.toString()}/photos`)
            .attach('image', Buffer.from('fake-image'), 'test.jpg');

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('event_not_started');
        expect(await EventPhotoModel.countDocuments({ eventId: event._id })).toBe(0);
    });

    it('un evento gia\' iniziato continua a operare normalmente', async () => {
        app = await createTestApp();
        const { sessionToken } = await createAuthSession();

        /* Stesso fixture, ma con il via ieri: il gate non deve toccare la
           cassa di un evento aperto (e\' il caso in cui sbagliare blocca la
           vendita). */
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const event = await EventModel.create({
            name: 'Ongoing Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: yesterday,
            endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            currencyName: 'TC'
        });
        const stand = await StandModel.create({ name: 'Ongoing Stand', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'Ongoing Station' });
        const product = await ProductModel.create({ name: 'Ongoing Item', price: 5 });
        const eventProduct = await EventProductModel.create({
            eventId: event._id, standId: stand._id, productId: product._id, stationIds: [station._id]
        });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                standId: stand._id.toString(),
                items: [{
                    eventProductId: eventProduct._id.toString(),
                    stationId: station._id.toString(),
                    quantity: 1
                }]
            });

        expect(res.status).toBe(201);
        expect(await OrderModel.countDocuments({ eventId: event._id })).toBe(1);
    });
});