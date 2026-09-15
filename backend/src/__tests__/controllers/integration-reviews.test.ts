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
import { OrderModel } from '../../models/order.model';
import { ProductModel } from '../../models/product.model';
import { RoleModel } from '../../models/role.model';
import { ReviewModel } from '../../models/review.model';
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

async function createSession(userId: unknown) {
    const sessionToken = generateSessionToken();
    await SessionModel.create({
        userId,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: getSessionExpiryDate(),
        lastActivityAt: new Date()
    });
    return sessionToken;
}

async function createUser(email: string) {
    return UserModel.create({
        firstName: 'Review',
        lastName: 'User',
        email,
        passwordHash: await argon2.hash('Password123!'),
        isActive: true
    });
}

async function createBaseEntities(buyerId?: unknown) {
    const event = await EventModel.create({
        name: 'Review Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-07'),
        currencyName: 'TC'
    });
    const stand = await StandModel.create({ name: 'Review Stand', eventIds: [event._id] });
    const otherStand = await StandModel.create({ name: 'Other Stand', eventIds: [event._id] });
    const station = await StationModel.create({ standId: stand._id, name: 'Grill' });
    const product = await ProductModel.create({ name: 'Burger', price: 10 });
    const eventProduct = await EventProductModel.create({
        eventId: event._id,
        standId: stand._id,
        productId: product._id,
        stationIds: [station._id]
    });

    if (buyerId) {
        await OrderModel.create({
            eventId: event._id,
            standId: stand._id,
            orderNumber: 1,
            userId: buyerId,
            customerId: buyerId,
            status: 'confirmed',
            items: [
                {
                    eventProductId: eventProduct._id,
                    productId: product._id,
                    productName: 'Burger',
                    stationId: station._id,
                    stationName: 'Grill',
                    quantity: 1,
                    unitPrice: 10,
                    subtotal: 10
                }
            ],
            total: 10
        });
    }

    return { event, stand, otherStand, eventProduct, station };
}

describe('Reviews API', () => {
    it('lists empty reviews for an event', async () => {
        app = createTestApp();
        const { event } = await createBaseEntities();

        const res = await request(app).get(`/api/events/${event._id}/reviews`);
        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
        expect(res.body.pagination.total).toBe(0);
    });

    it('rejects review for unknown event', async () => {
        app = createTestApp();
        const res = await request(app).get(`/api/events/${'0'.repeat(24)}/reviews`);
        expect(res.status).toBe(404);
    });

    it('creates a stand review for a registered buyer', async () => {
        app = createTestApp();
        const buyer = await createUser(`buyer-${Date.now()}@test.com`);
        const { event, stand } = await createBaseEntities(buyer._id);
        const sessionToken = await createSession(buyer._id);

        const res = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ standId: stand._id.toString(), rating: 5, comment: 'Ottimo!', reviewerName: 'Nello' });

        expect(res.status).toBe(201);
        expect(res.body.item.rating).toBe(5);
        expect(res.body.item.comment).toBe('Ottimo!');
        expect(res.body.item.isVerified).toBe(true);
        expect(res.body.item.reviewerName).toBe('Nello');
        expect(res.body.guestToken).toBeUndefined();
    });

    it('allows a registered user without a purchase at the stand (no gate)', async () => {
        app = createTestApp();
        const buyer = await createUser(`nopurchase-${Date.now()}@test.com`);
        const { event, stand } = await createBaseEntities();
        const sessionToken = await createSession(buyer._id);

        const res = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ standId: stand._id.toString(), rating: 4 });

        expect(res.status).toBe(201);
        expect(res.body.item.isVerified).toBe(true);
    });

    it('allows a registered user to review even with only a cancelled order (no gate)', async () => {
        app = createTestApp();
        const buyer = await createUser(`cancelled-${Date.now()}@test.com`);
        const { event, stand, station, eventProduct } = await createBaseEntities();
        const sessionToken = await createSession(buyer._id);

        const product = await ProductModel.create({ name: 'Fries', price: 4 });
        await OrderModel.create({
            eventId: event._id,
            standId: stand._id,
            orderNumber: 2,
            userId: buyer._id,
            customerId: buyer._id,
            status: 'cancelled',
            items: [
                {
                    eventProductId: eventProduct._id,
                    productId: product._id,
                    productName: 'Fries',
                    stationId: station._id,
                    stationName: 'Grill',
                    quantity: 1,
                    unitPrice: 4,
                    subtotal: 4
                }
            ],
            total: 4,
            cancelledAt: new Date()
        });

        const res = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ standId: stand._id.toString(), rating: 3 });

        expect(res.status).toBe(201);
    });

    it('creates an event-level review when user bought anything at the event', async () => {
        app = createTestApp();
        const buyer = await createUser(`eventbuyer-${Date.now()}@test.com`);
        const { event } = await createBaseEntities(buyer._id);
        const sessionToken = await createSession(buyer._id);

        const res = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ rating: 4, comment: 'Bella serata' });

        expect(res.status).toBe(201);
        expect(res.body.item.standId).toBeNull();
    });

    it('requires reviewerName for anonymous guests', async () => {
        app = createTestApp();
        const { event, stand } = await createBaseEntities();

        const res = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ standId: stand._id.toString(), rating: 4 });

        expect(res.status).toBe(400);
    });

    it('allows anonymous guests and returns a guest token', async () => {
        app = createTestApp();
        const { event, stand } = await createBaseEntities();

        const res = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ standId: stand._id.toString(), rating: 5, reviewerName: 'Mario' });

        expect(res.status).toBe(201);
        expect(res.body.item.reviewerName).toBe('Mario');
        expect(res.body.item.isVerified).toBe(false);
        expect(typeof res.body.guestToken).toBe('string');
        expect(res.body.guestToken.length).toBeGreaterThan(20);
    });

    it('rejects duplicate review for the same anonymous guest', async () => {
        app = createTestApp();
        const { event, stand } = await createBaseEntities();

        const first = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ standId: stand._id.toString(), rating: 5, reviewerName: 'Mario' });

        const res = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .set('x-access-token', first.body.guestToken)
            .send({ standId: stand._id.toString(), rating: 4, reviewerName: 'Mario' });

        expect(res.status).toBe(409);
    });

    it('allows a different guest to review the same stand', async () => {
        app = createTestApp();
        const { event, stand } = await createBaseEntities();

        const res = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ standId: stand._id.toString(), rating: 4, reviewerName: 'Luigi' });

        expect(res.status).toBe(201);
    });

    it('rejects duplicate review for the same registered user on the same target', async () => {
        app = createTestApp();
        const buyer = await createUser(`dupe-${Date.now()}@test.com`);
        const { event, stand } = await createBaseEntities(buyer._id);
        const sessionToken = await createSession(buyer._id);

        await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ standId: stand._id.toString(), rating: 5 });

        const res = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ standId: stand._id.toString(), rating: 3 });

        expect(res.status).toBe(409);
    });

    it('does not accept invalid rating or comment length', async () => {
        app = createTestApp();
        const { event, stand } = await createBaseEntities();

        const ratingRes = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ standId: stand._id.toString(), rating: 9, reviewerName: 'Mario' });
        expect(ratingRes.status).toBe(400);

        const commentRes = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ standId: stand._id.toString(), rating: 3, comment: 'x'.repeat(1001), reviewerName: 'Mario' });
        expect(commentRes.status).toBe(400);
    });

    it('sanitizes the comment server side', async () => {
        app = createTestApp();
        const { event, stand } = await createBaseEntities();

        const res = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ standId: stand._id.toString(), rating: 5, comment: '<script>alert(1)</script>Ottimo', reviewerName: 'Mario' });

        expect(res.status).toBe(201);
        expect(res.body.item.comment).toBe('Ottimo');
    });

    it('supports the optional whatBought field (sanitized, ≤200)', async () => {
        app = createTestApp();
        const { event, stand } = await createBaseEntities();

        const res = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({
                standId: stand._id.toString(),
                rating: 5,
                whatBought: '<b>Burger</b> + patatine',
                reviewerName: 'Mario'
            });

        expect(res.status).toBe(201);
        expect(res.body.item.whatBought).toBe('Burger + patatine');

        const list = await request(app).get(`/api/events/${event._id}/reviews?standId=${stand._id}`);
        expect(list.body.items[0].whatBought).toBe('Burger + patatine');

        const tooLong = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ standId: stand._id.toString(), rating: 4, whatBought: 'x'.repeat(201), reviewerName: 'Luca' });
        expect(tooLong.status).toBe(400);
    });

    it('lists visible reviews and computes summary aggregates', async () => {
        app = createTestApp();
        const { event, stand } = await createBaseEntities();
        const registered = await createUser(`sum-${Date.now()}@test.com`);
        const sessionToken = await createSession(registered._id);

        await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ standId: stand._id.toString(), rating: 5, reviewerName: 'Mario' });
        await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ standId: stand._id.toString(), rating: 3, reviewerName: 'Luigi' });
        await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ standId: stand._id.toString(), rating: 2 });
        await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ rating: 4, reviewerName: 'Giulia' });

        const list = await request(app).get(
            `/api/events/${event._id}/reviews?standId=${stand._id}`
        );
        expect(list.status).toBe(200);
        expect(list.body.items).toHaveLength(3);
        expect(list.body.items.every((r: { standId: string | null }) => r.standId === stand._id.toString())).toBe(true);

        const eventList = await request(app).get(`/api/events/${event._id}/reviews`);
        expect(eventList.body.items).toHaveLength(1);

        const summary = await request(app).get(`/api/events/${event._id}/reviews/summary`);
        expect(summary.status).toBe(200);
        const standRow = summary.body.stands.find(
            (s: { standId: string }) => s.standId === stand._id.toString()
        );
        expect(standRow.count).toBe(3);
        expect(standRow.avg).toBe(3.3);
        expect(standRow.registeredCount).toBe(1);
        expect(summary.body.event.count).toBe(1);
        expect(summary.body.event.avg).toBe(4);
        expect(summary.body.event.registeredCount).toBe(0);

        const standSummary = await request(app).get(
            `/api/events/${event._id}/reviews/summary?standId=${stand._id}`
        );
        expect(standSummary.body.stands).toHaveLength(1);
        expect(standSummary.body.stands[0].count).toBe(3);
        expect(standSummary.body.stands[0].registeredCount).toBe(1);
    });

    it('returns my reviews for a registered user', async () => {
        app = createTestApp();
        const buyer = await createUser(`mine-${Date.now()}@test.com`);
        const { event, stand } = await createBaseEntities(buyer._id);
        const sessionToken = await createSession(buyer._id);

        await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ standId: stand._id.toString(), rating: 2 });

        const res = await request(app)
            .get(`/api/events/${event._id}/reviews/mine`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].standId).toBe(stand._id.toString());
    });

    it('returns my reviews for an anonymous guest via token', async () => {
        app = createTestApp();
        const { event, stand } = await createBaseEntities();

        const created = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ standId: stand._id.toString(), rating: 4, reviewerName: 'Mario' });

        const res = await request(app)
            .get(`/api/events/${event._id}/reviews/mine`)
            .set('x-access-token', created.body.guestToken);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
    });

    it('blocks manage endpoints for regular users', async () => {
        app = createTestApp();
        const buyer = await createUser(`regular-${Date.now()}@test.com`);
        const { event } = await createBaseEntities();
        const sessionToken = await createSession(buyer._id);

        const res = await request(app)
            .get(`/api/events/${event._id}/reviews/manage`)
            .set('Cookie', `sid=${sessionToken}`);
        expect(res.status).toBe(403);
    });

    it('lets event-admin hide and delete reviews', async () => {
        app = createTestApp();
        const admin = await createUser(`admin-${Date.now()}@test.com`);
        const { event, stand } = await createBaseEntities();
        const sessionToken = await createSession(admin._id);

        const role = await RoleModel.create({
            name: 'Event Admin',
            scope: 'event',
            slug: 'event-admin',
            permissions: [],
            isSystem: true,
            isActive: true
        });
        await UserRoleModel.create({
            userId: admin._id,
            roleId: role._id,
            eventId: event._id,
            isActive: true
        });

        const created = await request(app)
            .post(`/api/events/${event._id}/reviews`)
            .send({ standId: stand._id.toString(), rating: 3, reviewerName: 'Mario' });
        const reviewId = created.body.item.id;

        const manage = await request(app)
            .get(`/api/events/${event._id}/reviews/manage`)
            .set('Cookie', `sid=${sessionToken}`);
        expect(manage.status).toBe(200);
        expect(manage.body.items).toHaveLength(1);
        expect(manage.body.items[0].reviewerEmail).toBeDefined();

        const hidden = await request(app)
            .patch(`/api/events/${event._id}/reviews/${reviewId}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'hidden' });
        expect(hidden.status).toBe(200);
        expect(hidden.body.item.status).toBe('hidden');

        const publicList = await request(app).get(`/api/events/${event._id}/reviews`);
        expect(publicList.body.items).toHaveLength(0);

        const invalid = await request(app)
            .patch(`/api/events/${event._id}/reviews/${reviewId}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'bogus' });
        expect(invalid.status).toBe(400);

        const deleted = await request(app)
            .delete(`/api/events/${event._id}/reviews/${reviewId}`)
            .set('Cookie', `sid=${sessionToken}`);
        expect(deleted.status).toBe(204);

        expect(await ReviewModel.countDocuments({})).toBe(0);
    });

    it('returns QR data URL for event and stand review pages', async () => {
        app = createTestApp();
        const { event, stand } = await createBaseEntities();

        const eventQr = await request(app).get(`/api/events/${event._id}/reviews/qrcode`);
        expect(eventQr.status).toBe(200);
        expect(eventQr.body.qrCode).toMatch(/^data:image\/png;base64,/);
        expect(eventQr.body.url).toContain(`/events/${event._id}/review`);

        const standQr = await request(app).get(
            `/api/events/${event._id}/reviews/qrcode?standId=${stand._id}`
        );
        expect(standQr.status).toBe(200);
        expect(standQr.body.url).toContain(`/events/${event._id}/stands/${stand._id}/review`);
    });

    it('returns QR codes for all event stands via /qrcodes/all (event-admin)', async () => {
        app = createTestApp();
        const admin = await createUser(`admin-${Date.now()}@test.com`);
        const { event, stand, otherStand } = await createBaseEntities();
        const sessionToken = await createSession(admin._id);

        const role = await RoleModel.create({
            name: 'Event Admin',
            scope: 'event',
            slug: 'event-admin',
            permissions: [],
            isSystem: true,
            isActive: true
        });
        await UserRoleModel.create({
            userId: admin._id,
            roleId: role._id,
            eventId: event._id,
            isActive: true
        });

        const res = await request(app)
            .get(`/api/events/${event._id}/reviews/qrcodes/all`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(2);
        const ids = res.body.items.map((i: { standId: string }) => i.standId).sort();
        expect(ids).toEqual([stand._id.toString(), otherStand._id.toString()].sort());
        for (const item of res.body.items) {
            expect(item.standName).toBeDefined();
            expect(item.qrCode).toMatch(/^data:image\/png;base64,/);
            expect(item.url).toContain(`/events/${event._id}/stands/${item.standId}/review`);
        }
    });

    it('blocks /qrcodes/all without auth or with a non-event role', async () => {
        app = createTestApp();
        const stranger = await createUser(`stranger-${Date.now()}@test.com`);
        const { event } = await createBaseEntities();

        const unauth = await request(app).get(`/api/events/${event._id}/reviews/qrcodes/all`);
        expect(unauth.status).toBe(401);

        const sessionToken = await createSession(stranger._id);
        const forbidden = await request(app)
            .get(`/api/events/${event._id}/reviews/qrcodes/all`)
            .set('Cookie', `sid=${sessionToken}`);
        expect(forbidden.status).toBe(403);
    });
});