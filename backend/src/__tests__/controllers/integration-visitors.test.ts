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

import { Types } from 'mongoose';

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
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createUser(emailSuffix: string, firstName: string) {
    return UserModel.create({
        firstName,
        lastName: 'Tester',
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

async function createPlatformAdmin(userId: Types.ObjectId) {
    const platformAdminRole = await RoleModel.create({
        name: 'Platform Admin',
        scope: 'platform',
        slug: 'platform-admin',
        permissions: [],
        isSystem: true,
        isActive: true
    });
    await UserRoleModel.create({
        userId,
        roleId: platformAdminRole._id,
        isActive: true
    });
}

async function setupEnvironment() {
    app = createTestApp();

    const adminUser = await createUser('visitors-admin', 'Visitors');
    const adminSession = await createSession(adminUser._id);
    await createPlatformAdmin(adminUser._id);

    const plainUser = await createUser('visitors-plain', 'Plain');
    const plainSession = await createSession(plainUser._id);

    /* Finestra evento RELATIVA a oggi: l'endpoint filtra gli ordini sul
     * periodo dell'evento di default, e gli ordini del fixture hanno
     * createdAt = now. Con date fisse il test scaderebbe nel giorno successivo
     * alla fine evento (e' successo il 2026-10-01 con la finestra 01/09-30/09). */
    const dayMs = 24 * 60 * 60 * 1000;
    const event = await EventModel.create({
        name: 'Visitors Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date(Date.now() - 5 * dayMs),
        endDate: new Date(Date.now() + 5 * dayMs),
        currencyName: 'TC',
        cashPaymentsEnabled: true
    });

    const stand1 = await StandModel.create({
        name: 'Stand One',
        eventIds: [event._id],
        numbers: [{ eventId: event._id, number: 1 }]
    });
    const stand2 = await StandModel.create({
        name: 'Stand Two',
        eventIds: [event._id],
        numbers: [{ eventId: event._id, number: 2 }]
    });
    const standNoData = await StandModel.create({
        name: 'Stand No Data',
        eventIds: [event._id],
        numbers: [{ eventId: event._id, number: 3 }]
    });

    const station1 = await StationModel.create({ standId: stand1._id, name: 'Station One' });
    const station2 = await StationModel.create({ standId: stand2._id, name: 'Station Two' });

    const productDrink = await ProductModel.create({ name: 'Bevanda', price: 3 });
    const productBurger = await ProductModel.create({ name: 'Panino', price: 8 });
    const productPlain = await ProductModel.create({ name: 'Prodotto senza categoria', price: 5 });

    const epDrink = await EventProductModel.create({
        eventId: event._id,
        standId: stand1._id,
        productId: productDrink._id,
        stationIds: [station1._id],
        categoryIds: ['Bevande']
    });
    const epBurger = await EventProductModel.create({
        eventId: event._id,
        standId: stand1._id,
        productId: productBurger._id,
        stationIds: [station1._id],
        categoryIds: ['Panini']
    });
    const epPlain = await EventProductModel.create({
        eventId: event._id,
        standId: stand2._id,
        productId: productPlain._id,
        stationIds: [station2._id]
    });

    return {
        adminSession,
        plainSession,
        event,
        stand1,
        stand2,
        standNoData,
        station1,
        station2,
        epDrink,
        epBurger,
        epPlain
    };
}

let orderSeq = 0;

async function createOrderDoc(env: Awaited<ReturnType<typeof setupEnvironment>>, params: {
    standId: Types.ObjectId;
    epId: Types.ObjectId;
    stationId: Types.ObjectId;
    quantity: number;
    unitPrice?: number;
    creditAmountUsed?: number;
    status?: string;
    isGift?: boolean;
    cancelled?: boolean;
    customerName?: string | null;
    createdAt?: Date;
}) {
    orderSeq += 1;
    const unitPrice = params.unitPrice ?? 1;
    const subtotal = unitPrice * params.quantity;
    return OrderModel.create({
        eventId: env.event._id,
        standId: params.standId,
        orderNumber: orderSeq,
        userId: new Types.ObjectId(),
        customerName: params.customerName ?? null,
        status: params.cancelled ? 'cancelled' : (params.status ?? 'completed'),
        isGift: params.isGift ?? false,
        items: [{
            eventProductId: params.epId,
            productId: new Types.ObjectId(),
            productName: 'Item',
            stationId: params.stationId,
            stationName: 'Station',
            quantity: params.quantity,
            unitPrice,
            subtotal
        }],
        total: subtotal,
        creditAmountUsed: params.creditAmountUsed ?? 0,
        paymentStatus: params.cancelled ? 'refunded' : 'paid',
        createdAt: params.createdAt ?? new Date()
    });
}

async function createTopUp(env: Awaited<ReturnType<typeof setupEnvironment>>, eventUserId: Types.ObjectId, amount: number, at?: Date) {
    return EventUserTransactionModel.create({
        eventUserId,
        eventId: env.event._id,
        userId: null,
        type: 'top-up',
        direction: 'credit',
        amount,
        realAmount: amount,
        balanceAfter: amount,
        occurredAt: at ?? new Date()
    });
}

async function createRefund(env: Awaited<ReturnType<typeof setupEnvironment>>, eventUserId: Types.ObjectId, amount: number, at?: Date) {
    return EventUserTransactionModel.create({
        eventUserId,
        eventId: env.event._id,
        userId: null,
        type: 'refund',
        direction: 'debit',
        amount,
        realAmount: amount,
        balanceAfter: 0,
        occurredAt: at ?? new Date()
    });
}

function getVisitors(sessionToken: string, eventId: string, query = '') {
    return request(app)
        .get(`/api/events/${eventId}/visitors${query}`)
        .set('Cookie', `sid=${sessionToken}`);
}

/** Ordine con piu' righe: serve a misurare i carrelli che mescolano le
 *  categorie, cosa che `createOrderDoc` (mono-riga) non puo' rappresentare. */
async function createBasketDoc(env: Awaited<ReturnType<typeof setupEnvironment>>, params: {
    standId: Types.ObjectId;
    lines: { epId: Types.ObjectId; stationId: Types.ObjectId; quantity: number; unitPrice: number }[];
    creditAmountUsed?: number;
    createdAt?: Date;
}) {
    orderSeq += 1;
    const items = params.lines.map((line) => ({
        eventProductId: line.epId,
        productId: new Types.ObjectId(),
        productName: 'Item',
        stationId: line.stationId,
        stationName: 'Station',
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        subtotal: line.unitPrice * line.quantity
    }));
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    return OrderModel.create({
        eventId: env.event._id,
        standId: params.standId,
        orderNumber: orderSeq,
        userId: new Types.ObjectId(),
        customerName: null,
        status: 'completed',
        items,
        total,
        creditAmountUsed: params.creditAmountUsed ?? 0,
        paymentStatus: 'paid',
        createdAt: params.createdAt ?? new Date()
    });
}

async function createSettlement(env: Awaited<ReturnType<typeof setupEnvironment>>, params: {
    standId: Types.ObjectId;
    standName: string;
    amount: number;
    occurredAt?: Date;
}) {
    return StandSettlementModel.create({
        eventId: env.event._id,
        standId: params.standId,
        standName: params.standName,
        direction: 'credit',
        unit: 'credits',
        amount: params.amount,
        exchangeRate: 1,
        feePercent: 0,
        grossEuro: params.amount,
        feeEuro: 0,
        payoutEuro: params.amount,
        occurredAt: params.occurredAt ?? new Date()
    });
}

describe('Integration — Visitor estimation', () => {
    it('401 without auth', async () => {
        const env = await setupEnvironment();
        const res = await request(app).get(`/api/events/${env.event._id}/visitors`);
        expect(res.status).toBe(401);
    });

    it('403 for user without roles', async () => {
        const env = await setupEnvironment();
        const res = await getVisitors(env.plainSession, env.event._id.toString());
        expect(res.status).toBe(403);
    });

    it('200 product-based estimate applies category coefficients and default for no category', async () => {
        const env = await setupEnvironment();

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 2
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epBurger._id, stationId: env.station1._id, quantity: 3
        });
        await createOrderDoc(env, {
            standId: env.stand2._id, epId: env.epPlain._id, stationId: new Types.ObjectId(), quantity: 4
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        expect(res.body.coefficientMap).toMatchObject({ bevande: 0.33, dolci: 0.8 });
        expect(res.body.defaultCoefficient).toBe(1);

        const stand1 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand One');
        const stand2 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand Two');

        expect(stand1).toBeDefined();
        expect(stand1.number).toBe(1);
        expect(stand1.ordersCount).toBe(2);
        expect(stand1.categories).toEqual([
            expect.objectContaining({ label: 'Panini', quantity: 3, coefficient: 1, estimatedVisitors: 3 }),
            expect.objectContaining({ label: 'Bevande', quantity: 2, coefficient: 0.33, estimatedVisitors: 0.7 })
        ]);
        expect(stand1.estimatedVisitorsTotal).toBe(3.7);

        expect(stand2.categories).toEqual([
            expect.objectContaining({ label: 'Senza categoria', quantity: 4, coefficient: 1, estimatedVisitors: 4 })
        ]);
        expect(stand2.estimatedVisitorsTotal).toBe(4);

        expect(res.body.totals.productEstimated).toBe(7.7);
        expect(res.body.totals.nonCancelledOrders).toBe(3);
    });

    it('gift and cancelled orders are excluded from quantities', async () => {
        const env = await setupEnvironment();

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 2
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 5, isGift: true
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 3, cancelled: true
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        const stand1 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand One');
        expect(stand1.categories).toEqual([
            expect.objectContaining({ label: 'Bevande', quantity: 2, coefficient: 0.33, estimatedVisitors: 0.7 })
        ]);
        expect(stand1.ordersCount).toBe(2);
        expect(res.body.totals.nonCancelledOrders).toBe(2);
    });

    it('token-based estimate uses net sold tokens over observed average spend', async () => {
        const env = await setupEnvironment();

        const customerA = await EventUserModel.create({ eventId: env.event._id, balance: 0 });
        const customerB = await EventUserModel.create({ eventId: env.event._id, balance: 0 });

        await createTopUp(env, customerA._id, 80);
        await createTopUp(env, customerB._id, 40);
        await createRefund(env, customerA._id, 20);

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 1, creditAmountUsed: 10
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 1, creditAmountUsed: 10
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 1, creditAmountUsed: 30, cancelled: true
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        expect(res.body.tokensPerVisitor).toBe(10);
        expect(res.body.totals.tokenBasedEstimated).toBe(10);
        expect(res.body.totals.distinctTokenBuyers).toBe(2);
        expect(res.body.totals.netTokensSold).toBe(100);
    });

    it('falls back to DEFAULT_TOKENS_PER_VISITOR when no paid orders exist', async () => {
        const env = await setupEnvironment();

        const customer = await EventUserModel.create({ eventId: env.event._id, balance: 0 });
        await createTopUp(env, customer._id, 100);

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        expect(res.body.tokensPerVisitor).toBe(10);
        expect(res.body.totals.tokenBasedEstimated).toBe(10);
    });

    it('standId filter returns only the requested stand', async () => {
        const env = await setupEnvironment();

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 4
        });
        await createOrderDoc(env, {
            standId: env.stand2._id, epId: env.epPlain._id, stationId: new Types.ObjectId(), quantity: 2
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString(), `?standId=${env.stand1._id}`);
        expect(res.status).toBe(200);

        expect(res.body.stands).toHaveLength(1);
        expect(res.body.stands[0].standName).toBe('Stand One');
    });

    it('from/to window filters orders and token transactions', async () => {
        const env = await setupEnvironment();

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 2,
            createdAt: new Date('2026-09-10T10:00:00')
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 4,
            createdAt: new Date('2026-09-15T10:00:00')
        });

        const customer = await EventUserModel.create({ eventId: env.event._id, balance: 0 });
        await createTopUp(env, customer._id, 40, new Date('2026-09-11T08:00:00'));
        await createTopUp(env, customer._id, 60, new Date('2026-09-16T08:00:00'));

        const res = await getVisitors(
            env.adminSession,
            env.event._id.toString(),
            '?from=2026-09-12&to=2026-09-16'
        );
        expect(res.status).toBe(200);

        const stand1 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand One');
        expect(stand1.categories).toEqual([
            expect.objectContaining({ label: 'Bevande', quantity: 4, estimatedVisitors: 1.3 })
        ]);
        expect(res.body.totals.netTokensSold).toBe(60);
        expect(res.body.totals.distinctTokenBuyers).toBe(1);
        expect(res.body.totals.nonCancelledOrders).toBe(1);
    });

    it('stands without orders are listed with hasOrders false and zero estimate', async () => {
        const env = await setupEnvironment();

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 2
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        const noData = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand No Data');
        expect(noData).toBeDefined();
        expect(noData.hasOrders).toBe(false);
        expect(noData.ordersCount).toBe(0);
        expect(noData.estimatedVisitorsTotal).toBe(0);
    });

    it('a product in multiple categories is counted once, in its category with the highest coefficient', async () => {
        const env = await setupEnvironment();

        const productMulti = await ProductModel.create({ name: 'Pizza fritta', price: 8 });
        const epMulti = await EventProductModel.create({
            eventId: env.event._id,
            standId: env.stand1._id,
            productId: productMulti._id,
            stationIds: [env.station1._id],
            categoryIds: ['Bevande', 'Dolci']
        });

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: epMulti._id, stationId: env.station1._id, quantity: 5
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        const stand1 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand One');
        expect(stand1.categories).toEqual([
            expect.objectContaining({ label: 'Dolci', quantity: 5, coefficient: 0.8, estimatedVisitors: 4 })
        ]);
        expect(stand1.estimatedVisitorsTotal).toBe(4);
        expect(res.body.totals.productEstimated).toBe(4);
    });
});

describe('Integration — Visitor estimation, sovrapposizione fra categorie', () => {
    it('non conta due volte i visitatori che hanno comprato in piu\' categorie', async () => {
        const env = await setupEnvironment();

        /* Tre carrelli MISTI: chi beve ha anche mangiato, quindi quelle persone
         * sono gia' contate fra i panini. Senza correzione la somma direbbe
         * 3.99 visitatori per 3 carrelli. */
        for (let i = 0; i < 3; i++) {
            await createBasketDoc(env, {
                standId: env.stand1._id,
                lines: [
                    { epId: env.epBurger._id, stationId: env.station1._id, quantity: 1, unitPrice: 8 },
                    { epId: env.epDrink._id, stationId: env.station1._id, quantity: 1, unitPrice: 3 }
                ]
            });
        }

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        expect(res.status).toBe(200);

        expect(res.body.overlap.totalBaskets).toBe(3);
        expect(res.body.overlap.mixedBaskets).toBe(3);
        expect(res.body.overlap.multiCategoryBasketShare).toBe(1);

        /* Nessun carrello contiene una sola categoria: la quota "solo" e' 0 e la
         * categoria secondaria non aggiunge visitatori. */
        const panini = res.body.categories.find((c: { label: string }) => c.label === 'Panini');
        const bevande = res.body.categories.find((c: { label: string }) => c.label === 'Bevande');
        expect(panini).toMatchObject({ weight: 1, weightedVisitors: 3 });
        expect(bevande).toMatchObject({ soloQuota: 0, weight: 0, weightedVisitors: 0 });

        expect(res.body.totals.productEstimated).toBe(3);
        /* 3.99 grezzo, arrotondato a un decimale come tutti i totali. */
        expect(res.body.totals.productEstimatedUnweighted).toBe(4);
    });

    it('applica un peso parziale quando solo una parte dei carrelli e\' mista', async () => {
        const env = await setupEnvironment();

        /* 2 panini (carrello solo), 1 bevanda (solo), 1 panino + 1 bevanda (misto),
         * 1 bevanda (solo): i panini compaiono in 2 carrelli di cui 1 solo => quota
         * 0.5; le bevande in 3 di cui 2 solo => 2/3. */
        await createBasketDoc(env, {
            standId: env.stand1._id,
            lines: [{ epId: env.epBurger._id, stationId: env.station1._id, quantity: 2, unitPrice: 8 }]
        });
        await createBasketDoc(env, {
            standId: env.stand1._id,
            lines: [{ epId: env.epDrink._id, stationId: env.station1._id, quantity: 1, unitPrice: 3 }]
        });
        await createBasketDoc(env, {
            standId: env.stand1._id,
            lines: [
                { epId: env.epBurger._id, stationId: env.station1._id, quantity: 1, unitPrice: 8 },
                { epId: env.epDrink._id, stationId: env.station1._id, quantity: 1, unitPrice: 3 }
            ]
        });
        await createBasketDoc(env, {
            standId: env.stand1._id,
            lines: [{ epId: env.epDrink._id, stationId: env.station1._id, quantity: 1, unitPrice: 3 }]
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());

        expect(res.body.overlap.totalBaskets).toBe(4);
        expect(res.body.overlap.multiCategoryBasketShare).toBe(0.25);

        const bevande = res.body.categories.find((c: { label: string }) => c.label === 'Bevande');
        expect(bevande.soloQuota).toBe(0.667);
        expect(bevande.weight).toBe(0.667);
        /* 3 bevande x 0.33 = 0.99, pesato 2/3 = 0.66, sopra i 3 panini (3.66
         * grezzo, reso 3.7 dal rounding a un decimale). */
        expect(res.body.totals.productEstimated).toBe(3.7);
        expect(res.body.totals.productEstimatedUnweighted).toBe(4);
    });

    it('non corregge nulla se nessun carrello mescola le categorie', async () => {
        const env = await setupEnvironment();
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epBurger._id, stationId: env.station1._id, quantity: 2
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id, quantity: 2
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());

        expect(res.body.overlap.multiCategoryBasketShare).toBe(0);
        expect(res.body.categories.every((c: { weight: number }) => c.weight === 1)).toBe(true);
        expect(res.body.totals.productEstimated).toBe(res.body.totals.productEstimatedUnweighted);
    });

    it('le stime per stand restano senza pesi e non sono addizionabili', async () => {
        const env = await setupEnvironment();
        for (let i = 0; i < 2; i++) {
            await createBasketDoc(env, {
                standId: env.stand1._id,
                lines: [
                    { epId: env.epBurger._id, stationId: env.station1._id, quantity: 1, unitPrice: 8 },
                    { epId: env.epDrink._id, stationId: env.station1._id, quantity: 1, unitPrice: 3 }
                ]
            });
        }

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        const stand1 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand One');

        /* La riga e' la somma "di quel banco", invariata: il peso si misura a
         * livello di evento, sui carrelli che attraversano piu' stand. */
        expect(stand1.estimatedVisitorsTotal).toBe(2.7);
        /* Il totale evento e' corretto, quindi non e' la somma delle righe. */
        expect(res.body.totals.productEstimated).toBe(2);
    });
});

describe('Integration — Visitor estimation, terza base sulle liquidazioni', () => {
    it('espone null quando non ci sono liquidazioni', async () => {
        const env = await setupEnvironment();
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epBurger._id, stationId: env.station1._id,
            quantity: 1, creditAmountUsed: 20
        });

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        /* Zero liquidati non e' una stima di visitatori, e' un dato assente. */
        expect(res.body.totals.settlementBasedEstimated).toBeNull();
        expect(res.body.totals.settledCredits).toBe(0);
    });

    it('stima dai crediti liquidati usando i token per visitatore', async () => {
        const env = await setupEnvironment();
        /* Un ordine pagato tutto in crediti da 20 => tokensPerVisitor 20. */
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epBurger._id, stationId: env.station1._id,
            quantity: 1, unitPrice: 20, creditAmountUsed: 20
        });
        await createSettlement(env, { standId: env.stand1._id, standName: 'Stand One', amount: 40 });

        const res = await getVisitors(env.adminSession, env.event._id.toString());

        expect(res.body.tokensPerVisitor).toBe(20);
        expect(res.body.totals.settledCredits).toBe(40);
        expect(res.body.totals.settlementBasedEstimated).toBe(2);

        const stand1 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand One');
        expect(stand1.settledCredits).toBe(40);
        /* Crediti guadagnati su tutto l'evento, indipendentemente dalla finestra. */
        expect(stand1.earnedCredits).toBe(20);
    });

    it('riporta i crediti non attribuibili se lo stand non ha vendite', async () => {
        const env = await setupEnvironment();
        await createSettlement(env, { standId: env.stand2._id, standName: 'Stand Two', amount: 30 });

        const res = await getVisitors(env.adminSession, env.event._id.toString());

        /* Il mix di vendita dello stand non esiste: spalmare sarebbe inventare. */
        expect(res.body.totals.settledCredits).toBe(30);
        expect(res.body.totals.unattributedSettledCredits).toBe(30);
    });

    it('ripartisce i crediti liquidati sul mix di vendita del loro stand', async () => {
        const env = await setupEnvironment();
        /* Stand One vende 3 panini da 8 e 1 bevanda da 3: 24 su 27 = 88.9% il
         * fatturato e' panini. */
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epBurger._id, stationId: env.station1._id,
            quantity: 3, unitPrice: 8
        });
        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epDrink._id, stationId: env.station1._id,
            quantity: 1, unitPrice: 3
        });
        /* Stand Two vende UNA bevanda e un prodotto senza categoria, metà e metà: la
         * ripartizione e' del suo banco e non deve conguagliarsi con quella dello
         * stand uno, che ha venduto bevande per un fatturato ben diverso. */
        await createOrderDoc(env, {
            standId: env.stand2._id, epId: env.epDrink._id, stationId: env.station2._id,
            quantity: 1, unitPrice: 5
        });
        await createOrderDoc(env, {
            standId: env.stand2._id, epId: env.epPlain._id, stationId: env.station2._id,
            quantity: 1, unitPrice: 5
        });

        await createSettlement(env, { standId: env.stand1._id, standName: 'Stand One', amount: 90 });
        await createSettlement(env, { standId: env.stand2._id, standName: 'Stand Two', amount: 40 });

        const res = await getVisitors(env.adminSession, env.event._id.toString());

        const stand1 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand One');
        const panini = stand1.categories.find((c: { label: string }) => c.label === 'Panini');
        const bevande = stand1.categories.find((c: { label: string }) => c.label === 'Bevande');
        expect(panini.settledCredits).toBe(80);
        expect(bevande.settledCredits).toBe(10);

        const stand2 = res.body.stands.find((s: { standName: string }) => s.standName === 'Stand Two');
        /* 5 su 10 di fatturato in bevande = 20 crediti su 40 liquidati, non i 30
         * che si otterrebbero sommando anche i 10 dello stand uno. */
        expect(stand2.categories.find((c: { label: string }) => c.label === 'Bevande').settledCredits).toBe(20);
        expect(stand2.categories.find((c: { label: string }) => c.label === 'Senza categoria').settledCredits)
            .toBe(20);
        /* Nessun credito degli altri stand deve comparire sulla riga. */
        expect(res.body.totals.unattributedSettledCredits).toBe(0);
        expect(res.body.totals.settledCredits).toBe(130);
    });

    it('non somma le tre basi fra loro', async () => {
        const env = await setupEnvironment();
        const customer = await EventUserModel.create({ eventId: env.event._id, balance: 0 });
        await createTopUp(env, customer._id, 200);

        await createOrderDoc(env, {
            standId: env.stand1._id, epId: env.epBurger._id, stationId: env.station1._id,
            quantity: 4, unitPrice: 5, creditAmountUsed: 20
        });
        await createSettlement(env, { standId: env.stand1._id, standName: 'Stand One', amount: 20 });

        const res = await getVisitors(env.adminSession, env.event._id.toString());
        const { totals } = res.body;

        /* 200 token caricati / 20 token spesi per ordine = 10 per visitatore. */
        expect(totals.productEstimated).toBe(4);
        expect(totals.tokenBasedEstimated).toBe(10);
        expect(totals.settlementBasedEstimated).toBe(1);
        /* Sono tre letture dello stesso gruppo di persone: sommarle produrrebbe
         * un numero senza significato, quindi nessun totale corrisponde alla
         * somma delle altre due. */
        expect(totals.productEstimated).not.toBe(
            totals.tokenBasedEstimated + totals.settlementBasedEstimated
        );
    });
});