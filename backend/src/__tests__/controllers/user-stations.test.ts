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
import { StandModel } from '../../models/stand.model';
import { StationModel } from '../../models/station.model';
import { UserStationModel } from '../../models/user-station.model';
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
        firstName: 'Station',
        lastName: 'Tester',
        email: `station-${Date.now()}@test.com`,
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

describe('User Stations API', () => {
    it('lists user stations (empty)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .get('/api/user-stations')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(0);
    });

    it('creates a user station', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const stand = await StandModel.create({ name: 'Test Stand' });
        const station = await StationModel.create({ name: 'Cucina', standId: stand._id });

        const otherUser = await UserModel.create({
            firstName: 'Altro',
            lastName: 'Utente',
            email: `user-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });

        const res = await request(app)
            .post('/api/user-stations')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ userId: otherUser._id.toString(), stationId: station._id.toString() });

        expect(res.status).toBe(201);
        expect(res.body.item.stationId).toBe(station._id.toString());
    });

    it('rejects duplicate user station', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const otherUser = await UserModel.create({
            firstName: 'Dup',
            lastName: 'User',
            email: `dup-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });
        const stand = await StandModel.create({ name: 'Test Stand' });
        const station = await StationModel.create({ name: 'Griglia', standId: stand._id });

        const payload = {
            userId: otherUser._id.toString(),
            stationId: station._id.toString()
        };

        await request(app)
            .post('/api/user-stations')
            .set('Cookie', `sid=${sessionToken}`)
            .send(payload);

        const res = await request(app)
            .post('/api/user-stations')
            .set('Cookie', `sid=${sessionToken}`)
            .send(payload);

        expect(res.status).toBe(409);
    });

    it('deletes a user station', async () => {
        app = createTestApp();
        const { sessionToken, user } = await createAuthSession();
        const stand = await StandModel.create({ name: 'Test Stand' });
        const station = await StationModel.create({ name: 'Bar', standId: stand._id });
        const userStation = await UserStationModel.create({
            userId: user._id,
            stationId: station._id
        });

        const res = await request(app)
            .delete(`/api/user-stations/${userStation._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);

        const found = await UserStationModel.findById(userStation._id);
        expect(found).toBeNull();
    });

    it('returns 401 without auth', async () => {
        app = createTestApp();

        const res = await request(app).get('/api/user-stations');
        expect(res.status).toBe(401);
    });
});
