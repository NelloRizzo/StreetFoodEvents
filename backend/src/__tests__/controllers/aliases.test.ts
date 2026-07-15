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

import { AliasModel } from '../../models/alias.model';
import { EventModel } from '../../models/event.model';
import { StandModel } from '../../models/stand.model';
import { UserModel } from '../../models/user.model';
import { SessionModel } from '../../models/session.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession() {
    const user = await UserModel.create({
        firstName: 'Alias',
        lastName: 'Tester',
        email: `alias-${Date.now()}@test.com`,
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

describe('Aliases API', () => {
    it('lists aliases (empty)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .get('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('creates an alias for event', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Alias Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'my-event', entityType: 'event', entityRef: event._id.toString() });

        expect(res.status).toBe(201);
        expect(res.body.item.text).toBe('my-event');
        expect(res.body.item.entityType).toBe('event');
        expect(res.body.item.entityRef).toBe(event._id.toString());
    });

    it('normalizes alias text to lowercase', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Upper Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'MY-EVENT', entityType: 'event', entityRef: event._id.toString() });

        expect(res.status).toBe(201);
        expect(res.body.item.text).toBe('my-event');
    });

    it('rejects duplicate alias text', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Dup Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'dup-alias', entityType: 'event', entityRef: event._id.toString() });

        const res = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'dup-alias', entityType: 'event', entityRef: event._id.toString() });

        expect(res.status).toBe(409);
    });

    it('rejects invalid alias text', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Invalid Text Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'Invalid Alias!', entityType: 'event', entityRef: event._id.toString() });

        expect(res.status).toBe(500);
    });

    it('updates alias text', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Update Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const createRes = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'old-name', entityType: 'event', entityRef: event._id.toString() });

        const aliasId = createRes.body.item.id;

        const res = await request(app)
            .patch(`/api/aliases/${aliasId}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'new-name' });

        expect(res.status).toBe(200);
        expect(res.body.item.text).toBe('new-name');
    });

    it('deletes alias', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Delete Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const createRes = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'del-alias', entityType: 'event', entityRef: event._id.toString() });

        const aliasId = createRes.body.item.id;

        const res = await request(app)
            .delete(`/api/aliases/${aliasId}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);

        const found = await AliasModel.findById(aliasId);
        expect(found).toBeNull();
    });

    it('resolves alias (public)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Resolve Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'resolve-event', entityType: 'event', entityRef: event._id.toString() });

        const res = await request(app).get('/api/resolve/event/resolve-event');

        expect(res.status).toBe(200);
        expect(res.body.entityType).toBe('event');
        expect(res.body.entityId).toBe(event._id.toString());
        expect(res.body.entityName).toBe('Resolve Event');
    });

    it('returns 404 for non-existent alias', async () => {
        app = createTestApp();

        const res = await request(app).get('/api/resolve/event/nope');

        expect(res.status).toBe(404);
    });

    it('returns 401 for aliases list without auth', async () => {
        app = createTestApp();

        const res = await request(app).get('/api/aliases');

        expect(res.status).toBe(401);
    });
});
