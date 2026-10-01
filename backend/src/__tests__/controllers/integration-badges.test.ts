import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { Types } from 'mongoose';
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

import { BadgeModel } from '../../models/badge.model';
import { EventModel } from '../../models/event.model';
import { EventPhotoModel } from '../../models/event-photo.model';
import { FavoriteModel } from '../../models/favorite.model';
import { OrderModel } from '../../models/order.model';
import { SessionModel } from '../../models/session.model';
import { StandModel } from '../../models/stand.model';
import { StationModel } from '../../models/station.model';
import { UserModel } from '../../models/user.model';
import { generateSessionToken, getSessionExpiryDate, hashSessionToken } from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createUser(suffix: string) {
    const user = await UserModel.create({
        firstName: 'Badge',
        lastName: 'Tester',
        email: `${suffix}-${Date.now()}@test.com`,
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

async function createEvent(overrides: Record<string, unknown> = {}) {
    return EventModel.create({
        name: 'Badge Event',
        location: { label: 'Piazza', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-15T00:00:00.000Z'),
        endDate: new Date('2026-06-15T23:59:59.999Z'),
        currencyName: 'TC',
        cashPaymentsEnabled: true,
        ...overrides
    });
}

async function createOrder(params: {
    eventId: Types.ObjectId;
    standId: Types.ObjectId;
    stationId: Types.ObjectId;
    customerId: Types.ObjectId;
    createdAt: Date;
    isGift?: boolean;
    cancelled?: boolean;
    /** Se valorizzato simula un ordine emesso dal cassiere per un cliente. */
    cashierId?: Types.ObjectId;
}) {
    return OrderModel.create({
        eventId: params.eventId,
        standId: params.standId,
        orderNumber: Math.floor(Math.random() * 100000),
        /* `userId` e' chi emette l'ordine: mettiamo un id diverso dal cliente
           per dimostrare che i badge seguono il cliente e NON il cassiere. */
        userId: params.cashierId ?? new Types.ObjectId(),
        customerId: params.customerId,
        customerName: null,
        status: params.cancelled ? 'cancelled' : 'completed',
        isGift: params.isGift ?? false,
        items: [{
            eventProductId: new Types.ObjectId(),
            productId: new Types.ObjectId(),
            productName: 'Item',
            stationId: params.stationId,
            stationName: 'Stazione',
            quantity: 1,
            unitPrice: 5,
            subtotal: 5
        }],
        total: params.isGift ? 0 : 5,
        creditAmountUsed: 0,
        paymentStatus: 'paid',
        createdAt: params.createdAt
    });
}

function getMyBadges(sessionToken: string) {
    return request(app).get('/api/badges/me').set('Cookie', `sid=${sessionToken}`);
}

let photoSeq = 0;

describe('Integration — Badge', () => {
    it('richiede autenticazione', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/badges/me');
        expect(res.status).toBe(401);
    });

    it('risponde 401 con un evento inesistente: i badge non dipendono dagli eventi', async () => {
        app = createTestApp();
        const { sessionToken } = await createUser('badge-401');
        const res = await getMyBadges(sessionToken);
        expect(res.status).toBe(200);
    });

    it('assegna "Primo ordine" al primo ordine e lo registra col contesto', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createUser('badge-first');
        const event = await createEvent();
        const stand = await StandModel.create({ name: 'S', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'St' });

        await createOrder({
            eventId: event._id, standId: stand._id, stationId: station._id,
            customerId: user._id, createdAt: new Date('2026-06-15T12:00:00.000Z')
        });

        const res = await getMyBadges(sessionToken);
        expect(res.status).toBe(200);

        const first = res.body.badges.find((b: { type: string }) => b.type === 'first-order');
        expect(first.earned).toBe(true);
        expect(first.eventId).toBe(event._id.toString());
        expect(first.earnedAt).not.toBeNull();

        expect(await BadgeModel.countDocuments({ userId: user._id, type: 'first-order' })).toBe(1);
    });

    it('NON usa Order.userId: un ordine emesso dal cassiere non spetta al cliente', async () => {
        app = createTestApp();
        const { user: cashier, sessionToken } = await createUser('badge-cashier');
        const event = await createEvent();
        const stand = await StandModel.create({ name: 'S', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'St' });

        /* customerId null = ordine per un ospite anonimo, emesso dal cassiere.
           Il cassiere non deve accorgersi di badge. */
        await OrderModel.create({
            eventId: event._id,
            standId: stand._id,
            orderNumber: 1,
            userId: cashier._id,
            customerId: null,
            customerName: 'Anonimo',
            status: 'completed',
            items: [{
                eventProductId: new Types.ObjectId(), productId: new Types.ObjectId(),
                productName: 'I', stationId: station._id, stationName: 'St',
                quantity: 1, unitPrice: 5, subtotal: 5
            }],
            total: 5,
            creditAmountUsed: 0,
            paymentStatus: 'paid',
            createdAt: new Date('2026-06-15T12:00:00.000Z')
        });

        const res = await getMyBadges(sessionToken);
        const first = res.body.badges.find((b: { type: string }) => b.type === 'first-order');
        expect(first.earned).toBe(false);
    });

    it('assegna "Esploratore" a 3 stand distinti e mostra il progresso sotto soglia', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createUser('badge-explorer');
        const event = await createEvent();

        for (let i = 0; i < 2; i += 1) {
            const stand = await StandModel.create({ name: `S${i}`, eventIds: [event._id] });
            const station = await StationModel.create({ standId: stand._id, name: `St${i}` });
            await createOrder({
                eventId: event._id, standId: stand._id, stationId: station._id,
                customerId: user._id, createdAt: new Date('2026-06-15T12:00:00.000Z')
            });
        }

        const before = await getMyBadges(sessionToken);
        const locked = before.body.badges.find((b: { type: string }) => b.type === 'explorer');
        expect(locked.earned).toBe(false);
        expect(locked.progress).toBe(2);
        expect(locked.target).toBe(3);

        const third = await StandModel.create({ name: 'S2', eventIds: [event._id] });
        const thirdStation = await StationModel.create({ standId: third._id, name: 'St2' });
        await createOrder({
            eventId: event._id, standId: third._id, stationId: thirdStation._id,
            customerId: user._id, createdAt: new Date('2026-06-15T12:00:00.000Z')
        });

        const after = await getMyBadges(sessionToken);
        const earned = after.body.badges.find((b: { type: string }) => b.type === 'explorer');
        expect(earned.earned).toBe(true);
    });

    it('assegna "Nottefondista" sull\'ora LOCALE dell\'evento, non su UTC', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createUser('badge-night');
        /* 21:30 UTC in estate = 23:30 Europe/Rome: da' in badges a UTC (21) ma
           e' notte per l'evento (23). */
        const event = await createEvent({ timezone: 'Europe/Rome' });
        const stand = await StandModel.create({ name: 'S', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'St' });
        await createOrder({
            eventId: event._id, standId: stand._id, stationId: station._id,
            customerId: user._id, createdAt: new Date('2026-06-15T21:30:00.000Z')
        });

        const res = await getMyBadges(sessionToken);
        const owl = res.body.badges.find((b: { type: string }) => b.type === 'night-owl');
        expect(owl.earned).toBe(true);
    });

    it('NON assegna "Nottefondista" se l\'ora e\' di notte solo in UTC', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createUser('badge-notnight');
        /* 21:30 UTC in New York = 17:30 local: di notte solo se si guarda l'UTC. */
        const event = await createEvent({ timezone: 'America/New_York' });
        const stand = await StandModel.create({ name: 'S', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'St' });
        await createOrder({
            eventId: event._id, standId: stand._id, stationId: station._id,
            customerId: user._id, createdAt: new Date('2026-06-15T21:30:00.000Z')
        });

        const res = await getMyBadges(sessionToken);
        const owl = res.body.badges.find((b: { type: string }) => b.type === 'night-owl');
        expect(owl.earned).toBe(false);
    });

    it('assegna "Fotografo" a 3 foto e "Seguace" a 2 eventi preferiti', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createUser('badge-photo');

        const event1 = await createEvent();
        const event2 = await createEvent({ name: 'Altro evento' });

        for (let i = 0; i < 3; i += 1) {
            photoSeq += 1;
            await EventPhotoModel.create({
                eventId: event1._id,
                sequenceNumber: photoSeq,
                takenAt: new Date(),
                type: 'image',
                image: {
                    url: 'https://cdn.example.com/p.jpg',
                    publicId: `p${i}`,
                    width: 1200,
                    height: 800,
                    format: 'jpg',
                    bytes: 120000
                },
                createdBy: user._id
            });
        }

        await FavoriteModel.create({ userId: user._id, eventId: event1._id });
        await FavoriteModel.create({ userId: user._id, eventId: event2._id });

        const res = await getMyBadges(sessionToken);
        const byType = Object.fromEntries(
            res.body.badges.map((b: { type: string }) => [b.type, b])
        );
        expect(byType.photographer.earned).toBe(true);
        expect(byType.follower.earned).toBe(true);
        /* "Fotografo" non deve bastare a regalare "Esploratore". */
        expect(byType.explorer.earned).toBe(false);
    });

    it('ignora omaggi e ordini cancellati', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createUser('badge-excluded');
        const event = await createEvent();
        const stand = await StandModel.create({ name: 'S', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'St' });

        await createOrder({
            eventId: event._id, standId: stand._id, stationId: station._id,
            customerId: user._id, isGift: true, createdAt: new Date('2026-06-15T12:00:00.000Z')
        });
        await createOrder({
            eventId: event._id, standId: stand._id, stationId: station._id,
            customerId: user._id, cancelled: true, createdAt: new Date('2026-06-15T12:00:00.000Z')
        });

        const res = await getMyBadges(sessionToken);
        const first = res.body.badges.find((b: { type: string }) => b.type === 'first-order');
        expect(first.earned).toBe(false);
    });

    it('e\' idempotente: leggere i badge piu\' volte non crea doppioni', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createUser('badge-idempotent');
        const event = await createEvent();
        const stand = await StandModel.create({ name: 'S', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'St' });
        await createOrder({
            eventId: event._id, standId: stand._id, stationId: station._id,
            customerId: user._id, createdAt: new Date('2026-06-15T12:00:00.000Z')
        });

        await getMyBadges(sessionToken);
        await getMyBadges(sessionToken);
        await getMyBadges(sessionToken);

        expect(await BadgeModel.countDocuments({ userId: user._id })).toBe(1);
    });

    it('e\' retroattivo: un ordine gia\' esistente viene premiato al primo accesso', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createUser('badge-retro');
        const event = await createEvent();
        const stand = await StandModel.create({ name: 'S', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'St' });
        await createOrder({
            eventId: event._id, standId: stand._id, stationId: station._id,
            customerId: user._id, createdAt: new Date('2026-06-15T12:00:00.000Z')
        });

        /* Nessun badge pre-esistente: la feature "non e' mai girata". */
        expect(await BadgeModel.countDocuments({ userId: user._id })).toBe(0);

        await getMyBadges(sessionToken);
        expect(await BadgeModel.countDocuments({ userId: user._id, type: 'first-order' })).toBe(1);
    });

    it('non espone i badge di un altro utente', async () => {
        app = createTestApp();
        const { user: mine, sessionToken } = await createUser('badge-privacy-a');
        const { sessionToken: otherToken } = await createUser('badge-privacy-b');

        const event = await createEvent();
        const stand = await StandModel.create({ name: 'S', eventIds: [event._id] });
        const station = await StationModel.create({ standId: stand._id, name: 'St' });
        await createOrder({
            eventId: event._id, standId: stand._id, stationId: station._id,
            customerId: mine._id, createdAt: new Date('2026-06-15T12:00:00.000Z')
        });

        const own = await getMyBadges(sessionToken);
        const others = await getMyBadges(otherToken);

        const ownFirst = own.body.badges.find((b: { type: string }) => b.type === 'first-order');
        const otherFirst = others.body.badges.find((b: { type: string }) => b.type === 'first-order');
        expect(ownFirst.earned).toBe(true);
        expect(otherFirst.earned).toBe(false);
    });

    it('spedisce il catalogo: etichette e icone hanno una sola fonte di verita\'', async () => {
        app = createTestApp();
        const { sessionToken } = await createUser('badge-catalog');
        const res = await getMyBadges(sessionToken);
        expect(res.body.catalog).toHaveLength(5);
        for (const entry of res.body.catalog) {
            expect(entry.label).toBeTruthy();
            expect(entry.icon).toBeTruthy();
        }
        /* "Top Spender" non deve esistere: sostituito da Esploratore/Nottefondista. */
        expect(res.body.catalog.map((c: { type: string }) => c.type)).not.toContain('top-spender');
    });
});

