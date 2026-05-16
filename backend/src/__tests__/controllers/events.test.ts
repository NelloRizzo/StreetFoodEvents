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

import { SessionModel } from '../../models/session.model';
import { UserModel } from '../../models/user.model';
import {
    clearSessionCookie,
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken,
    setSessionCookie
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';
import { EventModel } from '../../models/event.model';

let app: Express;

describe('Events API', () => {
    it('returns health check', async () => {
        app = createTestApp();
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('lists events (empty)', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/events');
        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('lists events with data', async () => {
        app = createTestApp();
        await EventModel.create({
            name: 'Test Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app).get('/api/events');
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0]!.name).toBe('Test Event');
    });

    it('returns 400 for invalid event id on GET', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/events/invalid');
        expect(res.status).toBe(400);
    });

    it('creates an event when authenticated', async () => {
        app = createTestApp();

        const user = await UserModel.create({
            firstName: 'Admin',
            lastName: 'User',
            email: `admin-${Date.now()}@test.com`,
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

        const res = await request(app)
            .post('/api/events')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                name: 'New Event',
                location: { label: 'Piazza', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
                startDate: '2026-07-01',
                endDate: '2026-07-05',
                currencyName: 'Coin'
            });

        expect(res.status).toBe(201);
        expect(res.body.item.name).toBe('New Event');
    });

    it('returns 401 for create without auth', async () => {
        app = createTestApp();
        const res = await request(app)
            .post('/api/events')
            .send({ name: 'Test' });
        expect(res.status).toBe(401);
    });

    it('updates an event', async () => {
        app = createTestApp();

        const user = await UserModel.create({
            firstName: 'Admin',
            lastName: 'User',
            email: `admin-upd-${Date.now()}@test.com`,
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

        const event = await EventModel.create({
            name: 'Original',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .patch(`/api/events/${event._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Updated' });

        expect(res.status).toBe(200);
        expect(res.body.item.name).toBe('Updated');
    });

    it('deletes an event', async () => {
        app = createTestApp();

        const user = await UserModel.create({
            firstName: 'Admin',
            lastName: 'User',
            email: `admin-del-${Date.now()}@test.com`,
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

        const event = await EventModel.create({
            name: 'To Delete',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .delete(`/api/events/${event._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);

        const found = await EventModel.findById(event._id);
        expect(found).toBeNull();
    });
});
