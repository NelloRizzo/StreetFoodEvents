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
import { EventUserModel } from '../../models/event-user.model';
import { EventUserTransactionModel } from '../../models/event-user-transaction.model';
import { SessionModel } from '../../models/session.model';
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
        firstName: 'EU',
        lastName: 'Tester',
        email: `eu-${Date.now()}@test.com`,
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

describe('EventUsers API', () => {
    it('creates an event-user', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const user2 = await UserModel.create({
            firstName: 'Target',
            lastName: 'User',
            email: `target-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });

        const res = await request(app)
            .post('/api/event-users')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString(), userId: user2._id.toString() });

        expect(res.status).toBe(201);
        expect(res.body.item.eventId).toBe(event._id.toString());
        expect(res.body.item.userId).toBe(user2._id.toString());
        expect(res.body.item.balance).toBe(0);
    });

    it('rejects duplicate event-user', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const user2 = await UserModel.create({
            firstName: 'Target',
            lastName: 'User',
            email: `target-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });

        await request(app)
            .post('/api/event-users')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString(), userId: user2._id.toString() });

        const res = await request(app)
            .post('/api/event-users')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString(), userId: user2._id.toString() });

        expect(res.status).toBe(409);
    });

    it('gets event-user by id', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const user2 = await UserModel.create({
            firstName: 'Target',
            lastName: 'User',
            email: `target-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });

        const eu = await EventUserModel.create({
            eventId: event._id,
            userId: user2._id
        });

        const res = await request(app)
            .get(`/api/event-users/${eu._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.item.id).toBe(eu._id.toString());
    });

    it('returns 401 without auth', async () => {
        app = createTestApp();

        const res = await request(app)
            .get('/api/event-users/000000000000000000000001');

        expect(res.status).toBe(401);
    });

    it('lists wallet transactions (empty)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const user2 = await UserModel.create({
            firstName: 'Target',
            lastName: 'User',
            email: `target-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });

        const eu = await EventUserModel.create({
            eventId: event._id,
            userId: user2._id
        });

        const res = await request(app)
            .get(`/api/event-users/${eu._id}/transactions`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(0);
    });

    it('creates a wallet transaction', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const user2 = await UserModel.create({
            firstName: 'Target',
            lastName: 'User',
            email: `target-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });

        const eu = await EventUserModel.create({
            eventId: event._id,
            userId: user2._id
        });

        const res = await request(app)
            .post(`/api/event-users/${eu._id}/transactions`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ type: 'adjustment', direction: 'credit', amount: 100 });

        expect(res.status).toBe(201);
        expect(res.body.transaction.type).toBe('adjustment');
        expect(res.body.transaction.direction).toBe('credit');
        expect(res.body.transaction.amount).toBe(100);
        expect(res.body.transaction.balanceAfter).toBe(100);
    });

    it('creates transaction then verifies balance update', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const user2 = await UserModel.create({
            firstName: 'Target',
            lastName: 'User',
            email: `target-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });

        const eu = await EventUserModel.create({
            eventId: event._id,
            userId: user2._id
        });

        await request(app)
            .post(`/api/event-users/${eu._id}/transactions`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ type: 'adjustment', direction: 'credit', amount: 50 });

        const updated = await EventUserModel.findById(eu._id);
        expect(updated!.balance).toBe(50);
    });

    it('rejects transaction with insufficient balance', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const user2 = await UserModel.create({
            firstName: 'Target',
            lastName: 'User',
            email: `target-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });

        const eu = await EventUserModel.create({
            eventId: event._id,
            userId: user2._id
        });

        const res = await request(app)
            .post(`/api/event-users/${eu._id}/transactions`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ type: 'purchase', direction: 'debit', amount: 50 });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/insufficient/i);
    });
});
