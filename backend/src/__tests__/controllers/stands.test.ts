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
