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

import { CashRegisterModel } from '../../models/cash-register.model';
import { EventModel } from '../../models/event.model';
import { EventProductModel } from '../../models/event-product.model';
import { EventUserModel } from '../../models/event-user.model';
import { EventUserTransactionModel } from '../../models/event-user-transaction.model';
import { OrderModel } from '../../models/order.model';
import { ProductModel } from '../../models/product.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { StandModel } from '../../models/stand.model';
import { StandSettlementModel } from '../../models/stand-settlement.model';
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

type SettlementParams = {
    standId: Types.ObjectId;
    standName: string;
    amount: number;
    direction?: 'credit' | 'debit';
    unit?: 'credits' | 'euro';
    grossEuro?: number;
    feeEuro?: number;
    payoutEuro?: number;
    occurredAt: Date;
    /** Se true il record viene scritto grezzo, senza `direction`/`unit`:
     *  serve a provare che i record legacy valgano AVERE in crediti. */
    legacy?: boolean;
};

async function createSettlement(env: Awaited<ReturnType<typeof setupEnvironment>>, params: SettlementParams) {
    const base = {
        eventId: env.event._id,
        standId: params.standId,
        standName: params.standName,
        amount: params.amount,
        exchangeRate: 1,
        feePercent: 0,
        feeFlat: 0,
        grossEuro: params.grossEuro ?? 0,
        feeEuro: params.feeEuro ?? 0,
        payoutEuro: params.payoutEuro ?? 0,
        occurredAt: params.occurredAt
    };

    if (params.legacy) {
        /* `collection.insertOne` scavalca i default dello schema: e' l'unico
         * modo per avere un record senza `direction`/`unit`. */
        await StandSettlementModel.collection.insertOne(base);
        return;
    }

    await StandSettlementModel.create({
        ...base,
        direction: params.direction ?? 'credit',
        unit: params.unit ?? 'credits'
    });
}

async function createWallet(env: Awaited<ReturnType<typeof setupEnvironment>>, balance: number) {
    return EventUserModel.create({ eventId: env.event._id, balance, isActive: true });
}

async function createTokenTransaction(
    env: Awaited<ReturnType<typeof setupEnvironment>>,
    params: {
        eventUserId: Types.ObjectId;
        type: 'top-up' | 'refund' | 'purchase';
        direction: 'credit' | 'debit';
        amount: number;
        occurredAt: Date;
        cashRegisterId?: Types.ObjectId | null;
    }
) {
    return EventUserTransactionModel.create({
        eventId: env.event._id,
        eventUserId: params.eventUserId,
        type: params.type,
        direction: params.direction,
        amount: params.amount,
        realAmount: null,
        balanceAfter: 0,
        paymentMethod: 'cash',
        cashRegisterId: params.cashRegisterId ?? null,
        occurredAt: params.occurredAt
    });
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

describe('Integration — Event analytics, liquidazioni', () => {
    it('segnala come mai liquidati gli stand che hanno venduto ma non sono stati liquidati', async () => {
        const env = await setupEnvironment();
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
            productName: 'Panino', quantity: 2, unitPrice: 5, creditAmountUsed: 10,
            createdAt: utcAt(12)
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        const uno = res.body.byStand.find((s: { standName: string }) => s.standName === 'Stand Uno');
        expect(uno.earnedCredits).toBe(10);
        expect(uno.settledCredits).toBe(0);
        expect(uno.settlementCount).toBe(0);
        expect(uno.neverSettled).toBe(true);
        /* Il credito guadagnato ma non ancora corrisposto. */
        expect(uno.remainingEarnedCredits).toBe(10);

        expect(res.body.totals.settlements.standsNeverSettled).toBe(1);
        /* Il fatturato NON contiene i token liquidati: sono due sezioni diverse. */
        expect(res.body.totals.revenue).toBe(10);
        expect(res.body.totals.settlements.settledCredits).toBe(0);
    });

    it('include uno stand liquidato senza ordini nella finestra, con fatturato a zero', async () => {
        const env = await setupEnvironment();
        /* Stand Due non ha ordini: l'unica attivita' e' la liquidazione. */
        await createSettlement(env, {
            standId: env.stand2._id,
            standName: 'Stand Due',
            amount: 30,
            grossEuro: 30,
            feeEuro: 3,
            payoutEuro: 27,
            occurredAt: utcAt(18)
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        const due = res.body.byStand.find((s: { standName: string }) => s.standName === 'Stand Due');

        /* Solo Stand Due ha attivita' (la liquidazione): Stand Uno non ha ordini
         * ne' liquidazioni e non ha motivo di comparire. */
        expect(res.body.byStand).toHaveLength(1);
        expect(due.orders).toBe(0);
        expect(due.revenue).toBe(0);
        expect(due.settledCredits).toBe(30);
        expect(due.grossEuro).toBe(30);
        expect(due.feeEuro).toBe(3);
        expect(due.payoutEuro).toBe(27);
        /* Senza ordini non ci sono crediti guadagnati, quindi niente badge. */
        expect(due.neverSettled).toBe(false);
        expect(due.earnedCredits).toBe(0);

        /* Il payout non entra nel fatturato. */
        expect(res.body.totals.revenue).toBe(0);
        expect(res.body.totals.settlements.payoutEuro).toBe(27);
    });

    it('NON segnala mai liquidato uno stand liquidato fuori dalla finestra', async () => {
        const env = await setupEnvironment();
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
            productName: 'Panino', quantity: 2, unitPrice: 5, creditAmountUsed: 10,
            createdAt: utcAt(12)
        });
        /* Liquidazione in luglio, ordini in giugno: il filtro di default (giorno
         * dell'evento) non la vede, ma lo stand e' stato liquidato. */
        await createSettlement(env, {
            standId: env.stand1._id,
            standName: 'Stand Uno',
            amount: 10,
            payoutEuro: 10,
            occurredAt: new Date('2026-07-20T12:00:00.000Z')
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        const uno = res.body.byStand.find((s: { standName: string }) => s.standName === 'Stand Uno');

        /* Nella finestra non c'e' nulla, ma il badge "mai liquidato" e' falso. */
        expect(uno.settledCredits).toBe(0);
        expect(uno.neverSettled).toBe(false);
        expect(uno.settlementCountAllTime).toBe(1);
        expect(res.body.totals.settlements.standsNeverSettled).toBe(0);

        /* Aprendo la finestra di luglio la liquidazione compare. */
        const wide = await getAnalytics(
            env.adminSession,
            env.event._id.toString(),
            '?from=2026-07-01&to=2026-07-31'
        );
        expect(wide.body.totals.settlements.settledCredits).toBe(10);
    });

    it('separa DARE (crediti caricati) da AVERE (pagamento in euro)', async () => {
        const env = await setupEnvironment();
        await createSettlement(env, {
            standId: env.stand1._id, standName: 'Stand Uno', amount: 50,
            direction: 'debit', occurredAt: utcAt(11)
        });
        await createSettlement(env, {
            standId: env.stand1._id, standName: 'Stand Uno', amount: 40,
            grossEuro: 40, feeEuro: 4, payoutEuro: 36, occurredAt: utcAt(19)
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        const uno = res.body.byStand.find((s: { standName: string }) => s.standName === 'Stand Uno');

        expect(uno.loadedCredits).toBe(50);
        expect(uno.loadCount).toBe(1);
        expect(uno.settledCredits).toBe(40);
        expect(uno.settlementCount).toBe(1);
        /* 50 caricati - 40 liquidati = 10 da restituire. */
        expect(uno.toReturnCredits).toBe(10);

        const { settlements } = res.body.totals;
        expect(settlements.loadedCredits).toBe(50);
        expect(settlements.settledCredits).toBe(40);
        expect(settlements.toReturnCredits).toBe(10);
    });

    it('non mette in euro una liquidazione gia espressa in euro', async () => {
        const env = await setupEnvironment();
        await createSettlement(env, {
            standId: env.stand2._id, standName: 'Stand Due', amount: 25,
            unit: 'euro', payoutEuro: 25, occurredAt: utcAt(18)
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        const due = res.body.byStand.find((s: { standName: string }) => s.standName === 'Stand Due');

        expect(due.settledEuro).toBe(25);
        expect(due.settledCredits).toBe(0);
    });

    it('tratta i record legacy senza direction/unit come AVERE in crediti', async () => {
        const env = await setupEnvironment();
        await createSettlement(env, {
            standId: env.stand1._id, standName: 'Stand Uno', amount: 15,
            grossEuro: 15, payoutEuro: 15, occurredAt: utcAt(18), legacy: true
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        const uno = res.body.byStand.find((s: { standName: string }) => s.standName === 'Stand Uno');

        expect(uno.settledCredits).toBe(15);
        expect(uno.loadedCredits).toBe(0);
        expect(uno.payoutEuro).toBe(15);
    });

    it('calcola i crediti guadagnati su tutto l\'evento, anche fuori finestra', async () => {
        const env = await setupEnvironment();
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
            productName: 'Panino', quantity: 2, unitPrice: 5, creditAmountUsed: 10,
            createdAt: utcAt(12)
        });
        /* Ordine di luglio: fuori dalla finestra del giorno dell'evento. */
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
            productName: 'Panino', quantity: 1, unitPrice: 5, creditAmountUsed: 5,
            createdAt: new Date('2026-07-20T12:00:00.000Z')
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        const uno = res.body.byStand.find((s: { standName: string }) => s.standName === 'Stand Uno');

        expect(res.body.totals.orders).toBe(1);
        expect(uno.earnedCredits).toBe(15);
        expect(res.body.totals.settlements.earnedCredits).toBe(15);
    });
});

describe('Integration — Event analytics, resoconto token', () => {
    it('riporta caricati, usati, rimasti, in circolazione e in cassa', async () => {
        const env = await setupEnvironment();

        const register = await CashRegisterModel.create({
            eventId: env.event._id,
            name: 'Cassa 1',
            status: 'open',
            openedByUserId: new Types.ObjectId(),
            openedAt: utcAt(10),
            cashFloat: { euro: 100, credits: 250, setAt: utcAt(10) }
        });

        const wallet = await createWallet(env, 150);
        /* 200 caricati in cassa; 150 sono rimasti nel portafoglio. */
        await createTokenTransaction(env, {
            eventUserId: wallet._id, type: 'top-up', direction: 'credit',
            amount: 200, occurredAt: utcAt(11), cashRegisterId: register._id
        });
        /* 50 spesi su un ordine: il fatturato del giorno e' 10, ma i crediti
         * sono un flusso diverso. */
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
            productName: 'Panino', quantity: 10, unitPrice: 5, creditAmountUsed: 50,
            createdAt: utcAt(12)
        });
        await createTokenTransaction(env, {
            eventUserId: wallet._id, type: 'purchase', direction: 'debit',
            amount: 50, occurredAt: utcAt(12)
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        const { tokens } = res.body;
        expect(tokens.period.loaded).toBe(200);
        expect(tokens.period.netLoaded).toBe(200);
        expect(tokens.period.spent).toBe(50);
        expect(tokens.period.spentShareOfNetLoaded).toBe(0.25);
        expect(tokens.period.remaining).toBe(150);

        /* Istantanea: 150 nel portafoglio del cliente, 50 fisicamente in cassa
         * (fondo 250 - 200 consegnati al cliente). */
        expect(tokens.snapshot.inCirculation).toBe(150);
        expect(tokens.snapshot.inCash).toBe(50);
        expect(tokens.snapshot.registerFloats).toBe(250);
        expect(tokens.snapshot.cashRegisterCount).toBe(1);

        /* Quadratura: saldo del portafoglio contro movimento delle transazioni. */
        expect(tokens.snapshot.netFromTransactions).toBe(150);
        expect(tokens.snapshot.gap).toBe(0);
    });

    it('distingue il rimborso del cambio dal rimborso di un ordine annullato', async () => {
        const env = await setupEnvironment();
        const wallet = await createWallet(env, 100);

        await createTokenTransaction(env, {
            eventUserId: wallet._id, type: 'top-up', direction: 'credit',
            amount: 100, occurredAt: utcAt(10)
        });
        /* Rimborso del banco cambio: i token escono dalla circolazione. */
        await createTokenTransaction(env, {
            eventUserId: wallet._id, type: 'refund', direction: 'debit',
            amount: 30, occurredAt: utcAt(11)
        });
        /* Ordine annullato: i token tornano in circolazione. */
        await createTokenTransaction(env, {
            eventUserId: wallet._id, type: 'refund', direction: 'credit',
            amount: 20, occurredAt: utcAt(12)
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        const { tokens } = res.body;

        expect(tokens.period.loaded).toBe(100);
        expect(tokens.period.cashRefunded).toBe(30);
        expect(tokens.period.orderRefunded).toBe(20);
        expect(tokens.period.netLoaded).toBe(70);
        /* Rimborsare 30 con 100 caricati significa che 50 sono rimasti in giro. */
        expect(tokens.period.remaining).toBe(70);
    });

    it('riporta null sulla quota spesa quando non e\' stata caricata moneta', async () => {
        const env = await setupEnvironment();
        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        expect(res.body.tokens.period.spentShareOfNetLoaded).toBeNull();
        expect(res.body.tokens.snapshot.inCirculation).toBe(0);
        expect(res.body.tokens.snapshot.gap).toBe(0);
    });

    it('riporta la quota di token spesa per prodotto', async () => {
        const env = await setupEnvironment();
        /* Ordine unico da 10 crediti: 5 per il Panino (5 su 10) e 5 per la
         * Birra (5 su 10). */
        await OrderModel.create({
            eventId: env.event._id,
            standId: env.stand1._id,
            orderNumber: 900,
            userId: new Types.ObjectId(),
            customerName: null,
            status: 'completed',
            items: [
                {
                    eventProductId: env.epA._id,
                    productId: new Types.ObjectId(),
                    productName: 'Panino',
                    stationId: env.station1._id,
                    stationName: 'Stazione Uno',
                    quantity: 2,
                    unitPrice: 5,
                    subtotal: 10
                },
                {
                    eventProductId: env.epB._id,
                    productId: new Types.ObjectId(),
                    productName: 'Birra',
                    stationId: env.station2._id,
                    stationName: 'Stazione Due',
                    quantity: 1,
                    unitPrice: 5,
                    subtotal: 5
                }
            ],
            total: 15,
            creditAmountUsed: 10,
            paymentStatus: 'paid',
            createdAt: utcAt(12)
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        const rows = res.body.tokensByProduct as {
            productName: string; tokens: number; share: number; quantity: number;
        }[];

        expect(rows).toHaveLength(2);
        expect(rows[0]?.productName).toBe('Panino');
        expect(rows[0]?.tokens).toBeCloseTo(6.67, 2);
        expect(rows[0]?.share).toBeCloseTo(0.667, 2);
        expect(rows[1]?.productName).toBe('Birra');
        expect(rows[1]?.tokens).toBeCloseTo(3.33, 2);
        /* La somma delle quote e' 1: i crediti sono distribuiti una volta sola. */
        expect(rows.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1, 2);
    });

    it('non attribuisce token ai prodotti di un ordine senza crediti', async () => {
        const env = await setupEnvironment();
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
            productName: 'Panino', quantity: 2, unitPrice: 5, createdAt: utcAt(12)
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        expect(res.body.tokensByProduct).toEqual([]);
    });

    it('esclude omaggi e cancellati dai token spesi', async () => {
        const env = await setupEnvironment();
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
            productName: 'Panino', quantity: 1, unitPrice: 5, isGift: true,
            createdAt: utcAt(12)
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epA._id, stationId: env.station1._id,
            productName: 'Panino', quantity: 1, unitPrice: 5, status: 'cancelled',
            creditAmountUsed: 5, createdAt: utcAt(12)
        });

        const res = await getAnalytics(env.adminSession, env.event._id.toString());
        expect(res.body.tokens.period.spent).toBe(0);
        expect(res.body.tokensByProduct).toEqual([]);
    });
});