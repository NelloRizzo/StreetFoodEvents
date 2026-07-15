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
import { FavoriteModel } from '../../models/favorite.model';
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
        firstName: 'Fav',
        lastName: 'Tester',
        email: `fav-${Date.now()}@test.com`,
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

describe('Favorites API', () => {
    it('lists favorites (empty)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .get('/api/favorites')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('creates a favorite for event', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Fav Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .post('/api/favorites')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString() });

        expect(res.status).toBe(201);
        expect(res.body.item.event.id).toBe(event._id.toString());
    });

    it('creates a favorite for stand', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const stand = await StandModel.create({ name: 'Fav Stand' });

        const res = await request(app)
            .post('/api/favorites')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ standId: stand._id.toString() });

        expect(res.status).toBe(201);
        expect(res.body.item.stand.id).toBe(stand._id.toString());
    });

    it('rejects duplicate favorite', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Dupe Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        await request(app)
            .post('/api/favorites')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString() });

        const res = await request(app)
            .post('/api/favorites')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString() });

        expect(res.status).toBe(409);
    });

    it('deletes a favorite', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Del Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const fav = await FavoriteModel.create({
            userId: user._id,
            eventId: event._id,
            standId: null
        });

        const res = await request(app)
            .delete(`/api/favorites/${fav._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);

        const found = await FavoriteModel.findById(fav._id);
        expect(found).toBeNull();
    });

    it('returns 401 without auth', async () => {
        app = createTestApp();

        const res = await request(app)
            .get('/api/favorites');

        expect(res.status).toBe(401);
    });
});
