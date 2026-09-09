import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { EventUserModel } from '../../models/event-user.model';
import { EventUserTransactionModel } from '../../models/event-user-transaction.model';
import { EventModel } from '../../models/event.model';
import { EventProductModel } from '../../models/event-product.model';
import { ProductModel } from '../../models/product.model';
import { PromotionModel, PromotionUsageModel } from '../../models/promotion.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { StandModel } from '../../models/stand.model';
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

async function createAuthSession(prefix = 'promo') {
    const user = await UserModel.create({
        firstName: 'Promo',
        lastName: 'Tester',
        email: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
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

async function getRole(slug: string, scope: 'platform' | 'event' | 'stand') {
    return RoleModel.findOneAndUpdate(
        { slug, scope },
        {
            $set: {
                name: slug,
                slug,
                scope,
                description: null,
                permissions: [],
                isSystem: true,
                isActive: true
            }
        },
        { upsert: true, new: true }
    );
}

async function setupPromotionEnvironment() {
    app = createTestApp();
    const { user: admin, sessionToken } = await createAuthSession();

    const platformAdminRole = await getRole('platform-admin', 'platform');
    const eventAdminRole = await getRole('event-admin', 'event');
    const cashierRole = await getRole('cashier', 'stand');

    const event = await EventModel.create({
        name: 'Promotion Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC',
        exchangeRate: 2,
        cashPaymentsEnabled: true
    });

    await UserRoleModel.create({
        userId: admin._id,
        roleId: eventAdminRole._id,
        eventId: event._id,
        isActive: true
    });

    const stand1 = await StandModel.create({ name: 'Stand Alpha', eventIds: [event._id] });
    const stand2 = await StandModel.create({ name: 'Stand Beta', eventIds: [event._id] });
    const otherStand = await StandModel.create({ name: 'Stand Other' });

    const station = await StationModel.create({ standId: stand1._id, name: 'Grill' });

    const product = await ProductModel.create({ name: 'Panino', ingredients: [], price: 10 });

    const eventProduct = await EventProductModel.create({
        eventId: event._id,
        standId: stand1._id,
        productId: product._id,
        stationIds: [station._id],
        priceOverride: null,
        available: true
    });

    const customer = await UserModel.create({
        firstName: 'Client',
        lastName: 'One',
        email: `client-${Date.now()}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        isActive: true
    });

    const eventUser = await EventUserModel.create({
        eventId: event._id,
        userId: customer._id,
        balance: 100,
        isActive: true
    });

    return {
        admin,
        sessionToken,
        eventAdminRole,
        platformAdminRole,
        cashierRole,
        event,
        stand1,
        stand2,
        otherStand,
        station,
        product,
        eventProduct,
        customer,
        eventUser
    };
}

describe('Integration — Promotions', () => {
    it('rejects unauthenticated access', async () => {
        const env = await setupPromotionEnvironment();

        const res = await request(app).get(`/api/events/${env.event._id}/promotions`);
        expect(res.status).toBe(401);
    });

    it('rejects non-admin users on admin endpoints', async () => {
        const env = await setupPromotionEnvironment();
        const { sessionToken: cashierToken } = await createAuthSession();

        const res = await request(app)
            .get(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${cashierToken}`);
        expect(res.status).toBe(403);
    });

    it('creates a discount coupon and lists it with QR', async () => {
        const env = await setupPromotionEnvironment();

        const res = await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'SC10', title: 'Sconto 10%', type: 'discount', discountType: 'percent', discountValue: 10 });

        expect(res.status).toBe(201);
        expect(res.body.item.code).toBe('SC10');
        expect(res.body.item.type).toBe('discount');
        expect(res.body.item.discountType).toBe('percent');
        expect(res.body.item.usedCount).toBe(0);
        expect(res.body.item.qrCode).toContain('data:image/png');

        const list = await request(app)
            .get(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(list.status).toBe(200);
        expect(list.body.items).toHaveLength(1);
        expect(list.body.items[0].qrCode).toContain('data:image/png');
    });

    it('creates fixed, value and formula product coupons', async () => {
        const env = await setupPromotionEnvironment();

        const fixed = await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'FIX5', type: 'discount', discountType: 'fixed', discountValue: 5 });
        expect(fixed.status).toBe(201);

        const value = await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'BONO', type: 'value', valueAmount: 20 });
        expect(value.status).toBe(201);

        const product = await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({
                code: '2X1',
                type: 'product',
                eventProductId: env.eventProduct._id.toString(),
                formula: { paid: 1, total: 2 },
                formulaMaxFree: 2
            });
        expect(product.status).toBe(201);
        expect(product.body.item.formula.paid).toBe(1);
        expect(product.body.item.formula.total).toBe(2);
        expect(product.body.item.formulaMaxFree).toBe(2);
    });

    it('rejects duplicate codes and invalid product for event', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'dup', type: 'discount', discountType: 'percent', discountValue: 10 });

        const duplicate = await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'dup', type: 'discount', discountType: 'fixed', discountValue: 5 });
        expect(duplicate.status).toBe(400);
        expect(duplicate.body.message).toContain('già un coupon');

        const product = await ProductModel.create({ name: 'Altro', ingredients: [], price: 5 });
        const anotherEvent = await EventModel.create({
            name: 'Other Event',
            location: { label: 'L', coordinates: { type: 'Point', coordinates: [10, 40] } },
            startDate: new Date('2026-07-01'),
            endDate: new Date('2026-07-03'),
            currencyName: 'OC'
        });
        const otherEp = await EventProductModel.create({
            eventId: anotherEvent._id,
            standId: env.stand1._id,
            productId: product._id,
            stationIds: [env.station._id]
        });

        const badProduct = await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'BADP', type: 'product', eventProductId: otherEp._id.toString() });
        expect(badProduct.status).toBe(400);
    });

    it('validates coupons without consuming them', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'OK10', type: 'discount', discountType: 'percent', discountValue: 10 });

        const valid = await request(app)
            .post(`/api/events/${env.event._id}/promotions/validate`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'ok10', standId: env.stand1._id.toString() });
        expect(valid.status).toBe(200);
        expect(valid.body.valid).toBe(true);
        expect(valid.body.item.discountValue).toBe(10);
        expect(valid.body.item.remainingPresentations).toBe(null);

        const unknown = await request(app)
            .post(`/api/events/${env.event._id}/promotions/validate`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'XXXXX' });
        expect(unknown.status).toBe(404);

        const fromDb = await PromotionModel.findOne({ code: 'OK10' });
        expect(fromDb?.usedCount).toBe(0);
    });

    it('rejects expired, inactive and exhausted coupons on validate', async () => {
        const env = await setupPromotionEnvironment();

        const expired = await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'SCAD', type: 'discount', discountType: 'percent', discountValue: 10, expiresAt: '2020-01-01' });
        expect(expired.status).toBe(201);

        const expiredValid = await request(app)
            .post(`/api/events/${env.event._id}/promotions/validate`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'SCAD' });
        expect(expiredValid.body.valid).toBe(false);
        expect(expiredValid.body.message).toContain('scaduto');

        const inactive = await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'SPENT', type: 'discount', discountType: 'fixed', discountValue: 5, maxPresentations: 1 });
        expect(inactive.status).toBe(201);
        const inactiveValid = await request(app)
            .post(`/api/events/${env.event._id}/promotions/validate`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'SPENT' });
        expect(inactiveValid.body.valid).toBe(true);

        await PromotionModel.updateOne({ code: 'SPENT' }, { $set: { isActive: false } });
        const inactive2 = await request(app)
            .post(`/api/events/${env.event._id}/promotions/validate`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'SPENT' });
        expect(inactive2.body.valid).toBe(false);
        expect(inactive2.body.message).toContain('non è attivo');

        await PromotionModel.updateOne({ code: 'SPENT' }, { $set: { isActive: true, usedCount: 5 } });
        const exhausted = await request(app)
            .post(`/api/events/${env.event._id}/promotions/validate`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'SPENT' });
        expect(exhausted.body.valid).toBe(false);
        expect(exhausted.body.message).toContain('esaurito');

        expect(expiredValid.body.valid).toBe(false);
        expect(expiredValid.body.message).toContain('scaduto');
    });

    it('rejects coupon bound to another stand', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'STAND1', type: 'discount', discountType: 'fixed', discountValue: 3, standId: env.stand1._id.toString() });

        const ok = await request(app)
            .post(`/api/events/${env.event._id}/promotions/validate`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'STAND1', standId: env.stand1._id.toString() });
        expect(ok.body.valid).toBe(true);

        const nok = await request(app)
            .post(`/api/events/${env.event._id}/promotions/validate`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'STAND1', standId: env.stand2._id.toString() });
        expect(nok.body.valid).toBe(false);
        expect(nok.body.message).toContain('non è valido per questo stand');
    });

    const orderBody = (env: Awaited<ReturnType<typeof setupPromotionEnvironment>>, overrides: Record<string, unknown> = {}) => ({
        eventId: env.event._id.toString(),
        standId: env.stand1._id.toString(),
        items: [{ eventProductId: env.eventProduct._id.toString(), stationId: env.station._id.toString(), quantity: 2 }],
        paymentOnCreate: { creditAmount: 0 },
        ...overrides
    });

    it('applies percent discount coupon on cash order', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'SC10', type: 'discount', discountType: 'percent', discountValue: 10 });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'sc10' }));

        expect(res.status).toBe(201);
        expect(res.body.item.total).toBe(18);
        expect(res.body.item.discountAmount).toBe(2);
        expect(res.body.item.promotionCode).toBe('SC10');
        expect(res.body.item.items[0].subtotal).toBe(20);

        const promo = await PromotionModel.findOne({ code: 'SC10' });
        expect(promo?.usedCount).toBe(1);
        expect(await PromotionUsageModel.countDocuments({ promotionId: promo?._id, type: 'discount' })).toBe(1);
    });

    it('rejects percent discount coupon on credit payment', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'SC10', type: 'discount', discountType: 'percent', discountValue: 10 });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'SC10', paymentOnCreate: { creditAmount: 10 } }));

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('sconto percentuale');
    });

    it('applies fixed discount coupon capped at total', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'FIX50', type: 'discount', discountType: 'fixed', discountValue: 50 });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'FIX50' }));

        expect(res.status).toBe(201);
        expect(res.body.item.total).toBe(0);
        expect(res.body.item.discountAmount).toBe(20);
        expect(res.body.item.paymentStatus).toBe('paid');
        expect(res.body.item.status).toBe('confirmed');
    });

    it('applies 2x1 formula on product coupon', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: '2X1', type: 'product', eventProductId: env.eventProduct._id.toString(), formula: { paid: 1, total: 2 } });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: '2X1' }));

        expect(res.status).toBe(201);
        expect(res.body.item.total).toBe(10);
        expect(res.body.item.freeUnits).toBe(1);
        expect(res.body.item.discountAmount).toBe(10);
        expect(res.body.item.items[0].subtotal).toBe(10);

        const usage = await PromotionUsageModel.findOne({ code: '2X1' });
        expect(usage?.freeUnits).toBe(1);
    });

    it('applies 2x1 formula with remainder paid in full', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: '2X1', type: 'product', eventProductId: env.eventProduct._id.toString(), formula: { paid: 1, total: 2 } });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, {
                promotionCode: '2X1',
                items: [{ eventProductId: env.eventProduct._id.toString(), stationId: env.station._id.toString(), quantity: 3 }]
            }));

        expect(res.status).toBe(201);
        expect(res.body.item.freeUnits).toBe(1);
        expect(res.body.item.total).toBe(20);
    });

    it('applies 3x2 formula', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: '3X2', type: 'product', eventProductId: env.eventProduct._id.toString(), formula: { paid: 2, total: 3 } });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, {
                promotionCode: '3X2',
                items: [{ eventProductId: env.eventProduct._id.toString(), stationId: env.station._id.toString(), quantity: 3 }]
            }));

        expect(res.status).toBe(201);
        expect(res.body.item.freeUnits).toBe(1);
        expect(res.body.item.total).toBe(20);
    });

    it('caps free units with formulaMaxFree', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({
                code: 'CAP1',
                type: 'product',
                eventProductId: env.eventProduct._id.toString(),
                formula: { paid: 1, total: 2 },
                formulaMaxFree: 1
            });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, {
                promotionCode: 'CAP1',
                items: [{ eventProductId: env.eventProduct._id.toString(), stationId: env.station._id.toString(), quantity: 2 }]
            }));

        expect(res.status).toBe(201);
        expect(res.body.item.freeUnits).toBe(1);
        expect(res.body.item.total).toBe(10);
    });

    it('rejects product coupon when product is missing from the order', async () => {
        const env = await setupPromotionEnvironment();

        const otherProduct = await ProductModel.create({ name: 'Fritto', ingredients: [], price: 5 });
        const otherEp = await EventProductModel.create({
            eventId: env.event._id,
            standId: env.stand1._id,
            productId: otherProduct._id,
            stationIds: [env.station._id]
        });

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'FRITTO', type: 'product', eventProductId: otherEp._id.toString() });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'FRITTO' }));

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('prodotto dedicato');
    });

    it('rejects value coupon on orders', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'BONO', type: 'value', valueAmount: 20 });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'BONO' }));

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('portafoglio');
    });

    it('rejects gift orders with coupon', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'SC10', type: 'discount', discountType: 'percent', discountValue: 10 });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'SC10', isGift: true }));

        expect(res.status).toBe(400);
    });

    it('enforces maxPresentations across orders', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'ONCE', type: 'discount', discountType: 'fixed', discountValue: 3, maxPresentations: 1 });

        const first = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'ONCE' }));
        expect(first.status).toBe(201);

        const second = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'ONCE' }));
        expect(second.status).toBe(400);
        expect(second.body.message).toContain('esaurito');
    });

    it('consumed presentation is not refunded when the order is cancelled', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'ONCE', type: 'discount', discountType: 'fixed', discountValue: 3, maxPresentations: 1 });

        const order = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'ONCE' }));

        const cancel = await request(app)
            .post(`/api/orders/${order.body.item.id}/cancel`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ reason: 'test' });
        expect(cancel.status).toBe(200);

        const promo = await PromotionModel.findOne({ code: 'ONCE' });
        expect(promo?.usedCount).toBe(1);

        const again = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'ONCE' }));
        expect(again.status).toBe(400);
    });

    it('redeems a value coupon into the customer wallet', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'BONO', type: 'value', valueAmount: 20 });

        const res = await request(app)
            .post(`/api/events/${env.event._id}/promotions/redeem-value`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'bono', eventUserId: env.eventUser._id.toString() });

        expect(res.status).toBe(200);
        expect(res.body.item.balance).toBe(120);

        const txn = await EventUserTransactionModel.findOne({ type: 'promotion' });
        expect(txn).toBeDefined();
        expect(txn?.amount).toBe(20);
        expect(txn?.realAmount).toBe(10);
        expect(txn?.direction).toBe('credit');

        const usage = await PromotionUsageModel.findOne({ code: 'BONO' });
        expect(usage?.type).toBe('value');
        expect(usage?.valueAmount).toBe(20);

        const promo = await PromotionModel.findOne({ code: 'BONO' });
        expect(promo?.usedCount).toBe(1);
    });

    it('blocks redeeming an exhausted value coupon', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'ONCE', type: 'value', valueAmount: 10, maxPresentations: 1 });

        const first = await request(app)
            .post(`/api/events/${env.event._id}/promotions/redeem-value`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'ONCE', eventUserId: env.eventUser._id.toString() });
        expect(first.status).toBe(200);

        const second = await request(app)
            .post(`/api/events/${env.event._id}/promotions/redeem-value`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'ONCE', eventUserId: env.eventUser._id.toString() });
        expect(second.status).toBe(400);
    });

    it('enforces per-user limit', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'PERU', type: 'discount', discountType: 'fixed', discountValue: 3, perUserLimit: 1 });

        const otherCustomer = await UserModel.create({
            firstName: 'Client',
            lastName: 'Two',
            email: `client2-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });
        const otherEventUser = await EventUserModel.create({
            eventId: env.event._id,
            userId: otherCustomer._id,
            balance: 100,
            isActive: true
        });

        const first = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'PERU', customerId: env.customer._id.toString() }));
        expect(first.status).toBe(201);

        const secondSameCustomer = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'PERU', customerId: env.customer._id.toString() }));
        expect(secondSameCustomer.status).toBe(400);

        const otherCustomerOrder = await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'PERU', customerId: otherCustomer._id.toString() }));
        expect(otherCustomerOrder.status).toBe(201);
        expect(otherEventUser._id).toBeDefined();
    });

    it('returns coupons section in event and stand reports', async () => {
        const env = await setupPromotionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'SC10', type: 'discount', discountType: 'percent', discountValue: 10 });
        await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({
                code: '2X1',
                type: 'product',
                eventProductId: env.eventProduct._id.toString(),
                formula: { paid: 1, total: 2 }
            });

        await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'SC10' }));
        await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, {
                promotionCode: '2X1',
                items: [{ eventProductId: env.eventProduct._id.toString(), stationId: env.station._id.toString(), quantity: 2 }]
            }));

        const eventReport = await request(app)
            .get(`/api/orders/report/event/${env.event._id}`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(eventReport.status).toBe(200);
        expect(eventReport.body.coupons.totalAppliedOrders).toBe(2);
        expect(eventReport.body.coupons.totalDiscountAmount).toBe(12);
        expect(eventReport.body.coupons.byPromotion).toHaveLength(2);

        const sc10 = eventReport.body.coupons.byPromotion.find((c: { code: string }) => c.code === 'SC10');
        expect(sc10.discountAmount).toBe(2);

        const x21 = eventReport.body.coupons.byPromotion.find((c: { code: string }) => c.code === '2X1');
        expect(x21.freeUnits).toBe(1);
        expect(x21.discountAmount).toBe(10);

        const standAlpha = eventReport.body.stands.find((s: { standId: string }) => s.standId === env.stand1._id.toString());
        expect(standAlpha.discountAmount).toBe(12);
        expect(eventReport.body.totals.discountAmount).toBe(12);

        const standReport = await request(app)
            .get(`/api/orders/report/stand/${env.stand1._id}?eventId=${env.event._id}`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(standReport.status).toBe(200);
        expect(standReport.body.summary.discountAmount).toBe(12);
        expect(standReport.body.coupons.byPromotion).toHaveLength(2);
    });

    it('does not delete used coupons (must be deactivated)', async () => {
        const env = await setupPromotionEnvironment();

        const created = await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'USED', type: 'discount', discountType: 'fixed', discountValue: 3 });

        await request(app)
            .post('/api/orders')
            .set('Cookie', `sid=${env.sessionToken}`)
            .send(orderBody(env, { promotionCode: 'USED' }));

        const del = await request(app)
            .delete(`/api/events/${env.event._id}/promotions/${created.body.item.id}`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(del.status).toBe(400);
        expect(del.body.message).toContain('disattivalo');
    });

    it('deletes unused coupons', async () => {
        const env = await setupPromotionEnvironment();

        const created = await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'UNUSED', type: 'discount', discountType: 'fixed', discountValue: 3 });

        const del = await request(app)
            .delete(`/api/events/${env.event._id}/promotions/${created.body.item.id}`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(del.status).toBe(200);
    });

    it('updates coupon and returns usage history', async () => {
        const env = await setupPromotionEnvironment();

        const created = await request(app)
            .post(`/api/events/${env.event._id}/promotions`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'EDIT', type: 'discount', discountType: 'fixed', discountValue: 3 });

        const patched = await request(app)
            .patch(`/api/events/${env.event._id}/promotions/${created.body.item.id}`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ code: 'EDIT', type: 'discount', discountType: 'percent', discountValue: 20, isActive: false });
        expect(patched.status).toBe(200);
        expect(patched.body.item.discountType).toBe('percent');
        expect(patched.body.item.discountValue).toBe(20);
        expect(patched.body.item.isActive).toBe(false);

        const usage = await request(app)
            .get(`/api/events/${env.event._id}/promotions/${created.body.item.id}/usage`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(usage.status).toBe(200);
        expect(usage.body.items).toEqual([]);
    });
});