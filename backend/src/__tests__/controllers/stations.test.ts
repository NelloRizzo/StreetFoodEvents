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

describe('Stations API', () => {
    it('lists stations filtered by standId', async () => {
        app = createTestApp();
        const stand = await StandModel.create({ name: 'Stand' });
        const otherStand = await StandModel.create({ name: 'Other' });

        await StationModel.create({ standId: stand._id, name: 'Cucina' });
        await StationModel.create({ standId: stand._id, name: 'Griglia' });
        await StationModel.create({ standId: otherStand._id, name: 'Bar' });

        const res = await request(app).get(`/api/stations?standId=${stand._id}`);
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(2);
        expect(res.body.items[0]!.name).toBe('Cucina');
        expect(res.body.items[1]!.name).toBe('Griglia');
    });

    it('creates a station when authenticated', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const stand = await StandModel.create({ name: 'Stand' });

        const res = await request(app)
            .post('/api/stations')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ standId: stand._id.toString(), name: 'Cucina' });

        expect(res.status).toBe(201);
        expect(res.body.item.name).toBe('Cucina');
    });

    it('returns 401 for create without auth', async () => {
        app = createTestApp();
        const res = await request(app)
            .post('/api/stations')
            .send({ standId: 'x', name: 'Test' });
        expect(res.status).toBe(401);
    });

    it('updates a station', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const stand = await StandModel.create({ name: 'Stand' });

        const station = await StationModel.create({ standId: stand._id, name: 'Vecchia' });

        const res = await request(app)
            .patch(`/api/stations/${station._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Nuova' });

        expect(res.status).toBe(200);
        expect(res.body.item.name).toBe('Nuova');
    });

    it('deletes a station', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const stand = await StandModel.create({ name: 'Stand' });

        const station = await StationModel.create({ standId: stand._id, name: 'Da Eliminare' });

        const res = await request(app)
            .delete(`/api/stations/${station._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);

        const found = await StationModel.findById(station._id);
        expect(found).toBeNull();
    });
});
