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
import { SessionModel } from '../../models/session.model';
import { StandModel } from '../../models/stand.model';
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
        firstName: 'Stand',
        lastName: 'Tester',
        email: `stand-${Date.now()}@test.com`,
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

describe('Stands API', () => {
    it('lists stands (empty)', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/stands');
        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('lists stands with data', async () => {
        app = createTestApp();
        await StandModel.create({ name: 'Test Stand' });

        const res = await request(app).get('/api/stands');
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0]!.name).toBe('Test Stand');
    });

    it('filters stands by eventId', async () => {
        app = createTestApp();
        const event = await EventModel.create({
            name: 'Test Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        await StandModel.create({ name: 'Matching' });
        await StandModel.create({ name: 'Linked', eventIds: [event._id] });
        await StandModel.create({ name: 'Other' });

        const res = await request(app).get(`/api/stands?eventId=${event._id}`);
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0]!.name).toBe('Linked');
    });

    it('creates a stand when authenticated', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .post('/api/stands')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'New Stand', slogan: 'Tasty!' });

        expect(res.status).toBe(201);
        expect(res.body.item.name).toBe('New Stand');
        expect(res.body.item.slogan).toBe('Tasty!');
    });

    it('creates a stand with type artigianato and defaults to food', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const craftRes = await request(app)
            .post('/api/stands')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Craft Stand', type: 'artigianato' });

        expect(craftRes.status).toBe(201);
        expect(craftRes.body.item.type).toBe('artigianato');

        const funRes = await request(app)
            .post('/api/stands')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Fun Stand', type: 'divertimento' });

        expect(funRes.status).toBe(201);
        expect(funRes.body.item.type).toBe('divertimento');

        const foodRes = await request(app)
            .post('/api/stands')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Food Stand' });

        expect(foodRes.status).toBe(201);
        expect(foodRes.body.item.type).toBe('food');
    });

    it('rejects an invalid stand type', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .post('/api/stands')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Bad Stand', type: 'boh' });

        expect(res.status).toBe(400);
    });

    it('returns 401 for create without auth', async () => {
        app = createTestApp();
        const res = await request(app)
            .post('/api/stands')
            .send({ name: 'Test' });
        expect(res.status).toBe(401);
    });

    it('updates a stand', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const stand = await StandModel.create({ name: 'Original' });

        const res = await request(app)
            .patch(`/api/stands/${stand._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Updated', slogan: 'New!' });

        expect(res.status).toBe(200);
        expect(res.body.item.name).toBe('Updated');
        expect(res.body.item.slogan).toBe('New!');
    });

    it('updates a stand type', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const stand = await StandModel.create({ name: 'Misto' });

        const res = await request(app)
            .patch(`/api/stands/${stand._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ type: 'artigianato' });

        expect(res.status).toBe(200);
        expect(res.body.item.type).toBe('artigianato');
    });

    it('updates stand eventIds to associate with events', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Evento',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({ name: 'Associabile', eventIds: [] });

        const res = await request(app)
            .patch(`/api/stands/${stand._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventIds: [event._id.toString()] });

        expect(res.status).toBe(200);
        expect(res.body.item.eventIds).toHaveLength(1);
        expect(res.body.item.eventIds[0]).toBe(event._id.toString());
        expect(res.body.item.numbers).toEqual([
            { eventId: event._id.toString(), number: 1, showOnMap: true, feePercent: null, feeFlat: null }
        ]);
    });

    it('auto-assigns progressive stand numbers per event', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Evento',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        await request(app)
            .post('/api/stands')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Primo', eventIds: [event._id.toString()] });

        const res2 = await request(app)
            .post('/api/stands')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Secondo', eventIds: [event._id.toString()] });

        expect(res2.status).toBe(201);
        expect(res2.body.item.numbers).toEqual([
            { eventId: event._id.toString(), number: 2, showOnMap: true, feePercent: null, feeFlat: null }
        ]);

        const listed = await request(app).get(`/api/stands?eventId=${event._id}`);
        const numbers = listed.body.items.map((s: { numbers: { number: number }[] }) => s.numbers[0]?.number);
        expect([...numbers].sort((a, b) => a - b)).toEqual([1, 2]);
    });

    it('reorders stands and reassigns numbers', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Evento',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const s1 = await StandModel.create({ name: 'Uno', eventIds: [event._id], numbers: [{ eventId: event._id, number: 1 }] });
        const s2 = await StandModel.create({ name: 'Due', eventIds: [event._id], numbers: [{ eventId: event._id, number: 2 }] });

        const res = await request(app)
            .patch('/api/stands/reorder')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                items: [
                    { standId: s2._id.toString(), number: 1 },
                    { standId: s1._id.toString(), number: 2 }
                ]
            });

        expect(res.status).toBe(204);

        const s1After = await StandModel.findById(s1._id);
        const s2After = await StandModel.findById(s2._id);
        const num = (stand: Awaited<typeof s1After>) =>
            (stand!.numbers ?? []).find((n) => n.eventId.toString() === event._id.toString())?.number;
        expect(num(s1After)).toBe(2);
        expect(num(s2After)).toBe(1);
    });

    it('toggles showOnMap for a stand via reorder', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Evento',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const s1 = await StandModel.create({ name: 'Uno', eventIds: [event._id], numbers: [{ eventId: event._id, number: 1 }] });

        const res = await request(app)
            .patch('/api/stands/reorder')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                items: [
                    { standId: s1._id.toString(), number: 1, showOnMap: false }
                ]
            });

        expect(res.status).toBe(204);

        const listed = await request(app).get(`/api/stands?eventId=${event._id}`);
        expect(listed.body.items[0]!.numbers).toEqual([
            { eventId: event._id.toString(), number: 1, showOnMap: false, feePercent: null, feeFlat: null }
        ]);
    });

    it('rejects reorder with invalid showOnMap type', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Evento',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const s1 = await StandModel.create({ name: 'Uno', eventIds: [event._id], numbers: [{ eventId: event._id, number: 1 }] });

        const res = await request(app)
            .patch('/api/stands/reorder')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                items: [
                    { standId: s1._id.toString(), number: 1, showOnMap: 'yes' }
                ]
            });

        expect(res.status).toBe(400);
    });

    it('rejects reorder with stands not part of the event', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Evento',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const inside = await StandModel.create({ name: 'Dentro', eventIds: [event._id] });
        const outside = await StandModel.create({ name: 'Fuori' });

        const res = await request(app)
            .patch('/api/stands/reorder')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                items: [
                    { standId: inside._id.toString(), number: 1 },
                    { standId: outside._id.toString(), number: 2 }
                ]
            });

        expect(res.status).toBe(404);
    });

    it('deletes a stand', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const stand = await StandModel.create({ name: 'To Delete' });

        const res = await request(app)
            .delete(`/api/stands/${stand._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);

        const found = await StandModel.findById(stand._id);
        expect(found).toBeNull();
    });
});
