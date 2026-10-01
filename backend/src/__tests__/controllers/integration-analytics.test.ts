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

import { EventModel } from '../../models/event.model';
import { EventProductModel } from '../../models/event-product.model';
import { OrderModel } from '../../models/order.model';
import { ProductModel } from '../../models/product.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { StandModel } from '../../models/stand.model';
import { StationModel } from '../../models/station.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import { generateSessionToken, getSessionExpiryDate, hashSessionToken } from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createUser(emailSuffix: string) {
    return UserModel.create({
        firstName: 'Tester',
        lastName: 'Analitics',
        email: `${emailSuffix}-${Date.now()}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        isActive: true
    });
}

async function createSession(userId: Types.ObjectId) {
    const sessionToken = generateSessionToken();
    await SessionModel.create({
        userId,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: getSessionExpiryDate(),
        lastActivityAt: new Date()
    });
    return sessionToken;
}

async function assignRole(userId: Types.ObjectId, slug: string, scope: 'platform' | 'event' | 'stand', eventId?: Types.ObjectId) {
    const role = await RoleModel.create({
        name: slug,
        scope,
        slug,
        permissions: [],
        isSystem: true,
        isActive: true
    });
    await UserRoleModel.create({
        userId,
        roleId: role._id,
        eventId: eventId ?? null,
        standId: null,
        isActive: true
    });
}

/* Orario "ore 14:37 UTC" di un giorno fisso: i bucket orari devono essere
   allineati all'ora UTC, non all'ora locale del server. */
function utcAt(hour: number, minute = 0) {
    const d = new Date('2026-06-15T00:00:00.000Z');
    d.setUTCHours(hour, minute, 0, 0);
    return d;
}

async function setupEnvironment() {
    app = createTestApp();

    const adminUser = await createUser('analytics-admin');
    const adminSession = await createSession(adminUser._id);

    const plainUser = await createUser('analytics-plain');
    const plainSession = await createSession(plainUser._id);

    const event = await EventModel.create({
        name: 'Analytics Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-15T00:00:00.000Z'),
        endDate: new Date('2026-06-15T23:59:59.999Z'),
        currencyName: 'TC',
        cashPaymentsEnabled: true
    });

    /* I ruoli vanno assegnati DOPO la creazione dell'evento: servono eventId
       e UserRole li accetta appena creati. */
    await assignRole(adminUser._id, 'event-admin', 'event', event._id);

    const stand1 = await StandModel.create({
        name: 'Stand Uno',
        eventIds: [event._id],
        numbers: [{ eventId: event._id, number: 1 }],
        locations: [{ eventId: event._id, location: { type: 'Point', coordinates: [12.4900, 41.9000] } }]
    });
    const stand2 = await StandModel.create({
        name: 'Stand Due',
        eventIds: [event._id],
        numbers: [{ eventId: event._id, number: 2 }]
    });

    const station1 = await StationModel.create({ standId: stand1._id, name: 'Stazione Uno' });
    const station2 = await StationModel.create({ standId: stand2._id, name: 'Stazione Due' });

    const productA = await ProductModel.create({ name: 'Panino', price: 5 });
    const productB = await ProductModel.create({ name: 'Birra', price: 3 });

    const epA = await EventProductModel.create({
        eventId: event._id,
        standId: stand1._id,
        productId: productA._id,
        stationIds: [station1._id],
        categoryIds: ['Panini']
    });
    const epB = await EventProductModel.create({
        eventId: event._id,
        standId: stand2._id,
        productId: productB._id,
        stationIds: [station2._id],
        categoryIds: ['Bibite']
    });

    return { adminSession, plainSession, event, stand1, stand2, station1, station2, epA, epB };
}

let orderSeq = 0;

async function createOrderDoc(env: Awaited<ReturnType<typeof setupEnvironment>>, params: {
    standId: Types.ObjectId;
    epId: Types.ObjectId;
    stationId: Types.ObjectId;
    productName: string;
    quantity: number;
    unitPrice: number;
    status?: string;
    isGift?: boolean;
    isPos?: boolean;
    creditAmountUsed?: number;
    readyAfterSeconds?: number;
    createdAt: Date;
}) {
    orderSeq += 1;
    const subtotal = params.unitPrice * params.quantity;
    const total = params.isGift ? 0 : subtotal;
    return OrderModel.create({
        eventId: env.event._id,
        standId: params.standId,
        orderNumber: orderSeq,
        userId: new Types.ObjectId(),
        customerName: null,
        status: params.status ?? 'completed',
        isGift: params.isGift ?? false,
        isPos: params.isPos ?? false,
        items: [{
            eventProductId: params.epId,
            productId: new Types.ObjectId(),
            productName: params.productName,
            stationId: params.stationId,
            stationName: 'Stazione',
            quantity: params.quantity,
            unitPrice: params.unitPrice,
            subtotal
        }],
        total,
        creditAmountUsed: params.creditAmountUsed ?? 0,
        paymentStatus: params.isGift ? 'paid' : 'paid',
        createdAt: params.createdAt,
        readyAt: params.readyAfterSeconds !== undefined
            ? new Date(params.createdAt.getTime() + params.readyAfterSeconds * 1000)
            : null
    });
}

function getAnalytics(sessionToken: string, eventId: string, query = '') {
    return request(app)
        .get(`/api/events/${eventId}/analytics${query}`)
        .set('Cookie', `sid=${sessionToken}`);
}

/* Due ordini a Stand Uno (5 e 3 pezzi) e uno a Stand Due (2 pezzi),
   distribuiti su tre ore diverse; il secondo Stand Uno impiega 8 minuti. */
async function seedSales(env: Awaited<ReturnType<typeof setupEnvironment>>) {
    await createOrderDoc(env, {
        standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
        productName: 'Panino', quantity: 3, unitPrice: 5, status: 'completed',
        readyAfterSeconds: 60, createdAt: utcAt(12, 10)
    });
    await createOrderDoc(env, {
        standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
        productName: 'Panino', quantity: 2, unitPrice: 5, status: 'ready',
        readyAfterSeconds: 480, createdAt: utcAt(13, 5)
    });
    await createOrderDoc(env, {
        standId: env.stand2._id, epId: env.epB._id, stationId: env.station2._id,
        productName: 'Birra', quantity: 2, unitPrice: 3, status: 'completed',
        isPos: true, createdAt: utcAt(13, 50)
    });
}

describe('Integration — Event analytics', () => {
    it('restituisce 400 con un eventId non valido', async () => {
        const env = await setupEnvironment();
        const res = await getAnalytics(env.adminSession, 'not-an-id');
        expect(res.status).toBe(400);
    });

    it('risponde 403 (non 404) per un evento a cui non si ha accesso', async () => {
        const env = await setupEnvironment();
        /* L'admin ha event-admin solo sull'evento di test: su un altro id il
           guard risponde 403 PRIMA che il controller controlli l'esistenza.
           E' il comportamento giusto: non si rivela se un evento esiste. */
        const res = await getAnalytics(env.adminSession, new Types.ObjectId().toString());
        expect(res.status).toBe(403);
    });

    it('risponde 404 per un evento inesistente a cui si ha accesso', async () => {
        await setupEnvironment();
        /* platform-admin: passa il guard su qualunque id, quindi il 404 arriva
           davvero dal controller. */
        const platformUser = await createUser('analytics-platform');
        const platformSession = await createSession(platformUser._id);
        await assignRole(platformUser._id, 'platform-admin', 'platform');

        const res = await getAnalytics(platformSession, new Types.ObjectId().toString());
        expect(res.status).toBe(404);
    });

    it('richiede autenticazione e il ruolo evento', async () => {
        const env = await setupEnvironment();

        const anon = await request(app).get(`/api/events/${env.event._id}/analytics`);
        expect(anon.status).toBe(401);

        const plain = await getAnalytics(env.plainSession, env.event._id.toString());
        expect(plain.status).toBe(403);
    });

    it('aggrega ordini, quantità e fatturato escludendo omaggi e cancellati', async () => {
        const env = await setupEnvironment();
        await seedSales(env);

        /* Omaggio: non entra nel fatturato, ma conta in giftOrders. */
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
            productName: 'Panino', quantity: 9, unitPrice: 5, isGift: true,
            status: 'confirmed', createdAt: utcAt(14)
        });

        /* Cancellato: escluso del tutto. */
        await createOrderDoc(env, {
            standId: env.stand2._id, epId: env.epB._id, stationId: env.station2._id,
            productName: 'Birra', quantity: 7, unitPrice: 3, status: 'cancelled',
            createdAt: utcAt(14)
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        const { totals } = res.body;
        expect(totals.orders).toBe(3);
        expect(totals.quantity).toBe(7);
        expect(totals.revenue).toBe(31);
        expect(totals.giftOrders).toBe(1);
        /* 12:00 -> 3 pezzi x 5, 13:00 -> 2 x 5 + 2 x 3, 14:00 solo omaggio/cancellato */
        expect(totals.avgOrderValue).toBeCloseTo(31 / 3, 1);
    });

    it('separa incassi POS, crediti e contanti', async () => {
        const env = await setupEnvironment();
        /* Ordine misto: 10 totali di cui 4 in crediti, POS = 10 - 4 = 6. */
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
            productName: 'Panino', quantity: 2, unitPrice: 5, isPos: true,
            creditAmountUsed: 4, createdAt: utcAt(12)
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        const { totals } = res.body;
        expect(totals.revenue).toBe(10);
        expect(totals.creditRevenue).toBe(4);
        expect(totals.posRevenue).toBe(6);
        expect(totals.cashRevenue).toBe(0);
    });

    it('allinea i bucket orari sull\'ora UTC (nessuno spostamento di fuso)', async () => {
        const env = await setupEnvironment();
        await seedSales(env);

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        const hourly = res.body.hourly as { bucketStart: string; orders: number; quantity: number }[];
        /* Tre ordini ma solo due ore distinte: 12:10 e 13:05+13:50. */
        expect(hourly).toHaveLength(2);

        /* Ogni bucket deve cadere esattamente a inizio ora UTC: e' ilFrontend
           che lo etichetta in ora locale, non MongoDB. */
        for (const bucket of hourly) {
            const d = new Date(bucket.bucketStart);
            expect(d.getUTCMinutes()).toBe(0);
            expect(d.getUTCSeconds()).toBe(0);
            expect(d.getUTCMilliseconds()).toBe(0);
        }

        expect(hourly.map((h) => h.orders)).toEqual([1, 2]);
        expect(hourly.reduce((sum, h) => sum + h.quantity, 0)).toBe(7);
        /* I bucket sono in ordine cronologico. */
        const times = hourly.map((h) => new Date(h.bucketStart).getTime());
        expect([...times].sort((a, b) => a - b)).toEqual(times);
    });

    it('calcola il tempo medio di preparazione e i suoi bucket', async () => {
        const env = await setupEnvironment();
        /* 60s (1 min) e 480s (8 min) -> media 270s = 4 min 30. */
        await seedSales(env);

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        const { totals, prepBuckets } = res.body;

        expect(totals.prepOrders).toBe(2);
        expect(totals.avgPrepSeconds).toBe(270);

        /* I bucket sono sempre tutti presenti, anche vuoti, perche' la scala
           deve restare confrontabile fra eventi. */
        expect(prepBuckets).toHaveLength(7);
        const counts = Object.fromEntries(prepBuckets.map((b: { label: string; count: number }) => [b.label, b.count]));
        expect(counts['fino a 2 min'] ?? 0).toBe(1);
        expect(counts['5-10 min'] ?? 0).toBe(1);
        expect(counts['10-15 min'] ?? 0).toBe(0);
    });

    it('ordina i prodotti per quantità e riporta stand e numero', async () => {
        const env = await setupEnvironment();
        await seedSales(env);

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        const top = res.body.topProducts as { productName: string; quantity: number; standName: string; number: number | null }[];

        expect(top[0]?.productName).toBe('Panino');
        expect(top[0]?.quantity).toBe(5);
        expect(top[0]?.standName).toBe('Stand Uno');
        expect(top[0]?.number).toBe(1);
        expect(top[1]?.productName).toBe('Birra');
        expect(top[1]?.quantity).toBe(2);
    });

    it('ordina gli stand per numero ed espone la posizione quando esiste', async () => {
        const env = await setupEnvironment();
        await seedSales(env);

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        const byStand = res.body.byStand as { standName: string; number: number; location: { lat: number; lng: number } | null }[];

        expect(byStand.map((s) => s.standName)).toEqual(['Stand Uno', 'Stand Due']);
        /* GeoJSON Point [lng, lat] riordinato in {lat, lng} per Leaflet. */
        expect(byStand[0]?.location).toEqual({ lat: 41.9, lng: 12.49 });
        expect(byStand[1]?.location).toBeNull();
    });

    it('filtra per standId', async () => {
        const env = await setupEnvironment();
        await seedSales(env);

        const res = await getAnalytics(env.adminSession, env.event._id.toString(), `?standId=${env.stand2._id}`);
        expect(res.status).toBe(200);
        expect(res.body.totals.orders).toBe(1);
        expect(res.body.byStand).toHaveLength(1);
        expect(res.body.byStand[0].standName).toBe('Stand Due');
    });

    it('rispetta la finestra from/to', async () => {
        const env = await setupEnvironment();
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
            productName: 'Panino', quantity: 4, unitPrice: 5, createdAt: new Date('2026-07-20T12:00:00.000Z')
        });

        /* La finestra di default e' il giorno dell'evento (15 giugno): l'ordine
           di luglio deve restare fuori. */
        const def = await getAnalytics(env.adminSession, env.event._id.toString());
        expect(def.body.totals.orders).toBe(0);

        const wide = await getAnalytics(
            env.adminSession,
            env.event._id.toString(),
            '?from=2026-07-01&to=2026-07-31'
        );
        expect(wide.body.totals.orders).toBe(1);
    });
});