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
import { UsageContractModel } from '../../models/usage-contract.model';
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
        firstName: 'Contract',
        lastName: 'Tester',
        email: `contract-${Date.now()}@test.com`,
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

describe('Usage Contracts API', () => {
    it('lists usage contracts (empty)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .get('/api/usage-contracts')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('creates a usage contract', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Contract Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .post('/api/usage-contracts')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                userId: user._id.toString(),
                eventId: event._id.toString(),
                maxStands: 2
            });

        expect(res.status).toBe(201);
        expect(res.body.item.maxStands).toBe(2);
        expect(res.body.item.status).toBe('active');
        expect(res.body.item.userId).toBe(user._id.toString());
        expect(res.body.item.eventId).toBe(event._id.toString());
    });

    it('rejects duplicate contract', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Dup Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        await request(app)
            .post('/api/usage-contracts')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                userId: user._id.toString(),
                eventId: event._id.toString(),
                maxStands: 1
            });

        const res = await request(app)
            .post('/api/usage-contracts')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                userId: user._id.toString(),
                eventId: event._id.toString(),
                maxStands: 2
            });

        expect(res.status).toBe(409);
    });

    it('gets contract by id', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Get Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const contract = await UsageContractModel.create({
            userId: user._id,
            eventId: event._id,
            maxStands: 3,
            createdBy: user._id
        });

        const res = await request(app)
            .get(`/api/usage-contracts/${contract._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.item.id).toBe(contract._id.toString());
        expect(res.body.item.maxStands).toBe(3);
    });

    it('updates contract status', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Update Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const contract = await UsageContractModel.create({
            userId: user._id,
            eventId: event._id,
            maxStands: 1,
            createdBy: user._id
        });

        const res = await request(app)
            .patch(`/api/usage-contracts/${contract._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ status: 'suspended' });

        expect(res.status).toBe(200);
        expect(res.body.item.status).toBe('suspended');
    });

    it('deletes contract', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Delete Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const contract = await UsageContractModel.create({
            userId: user._id,
            eventId: event._id,
            maxStands: 1,
            createdBy: user._id
        });

        const res = await request(app)
            .delete(`/api/usage-contracts/${contract._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Usage contract deleted');

        const found = await UsageContractModel.findById(contract._id);
        expect(found).toBeNull();
    });

    it('returns 401 without auth', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/usage-contracts');
        expect(res.status).toBe(401);
    });
});
