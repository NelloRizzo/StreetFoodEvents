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

import { UserModel } from '../../models/user.model';
import { SessionModel } from '../../models/session.model';
import { RoleModel } from '../../models/role.model';
import { UserRoleModel } from '../../models/user-role.model';
import { EventModel } from '../../models/event.model';
import { StandModel } from '../../models/stand.model';
import { StationModel } from '../../models/station.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

describe('Auth API', () => {
    it('rejects login with invalid credentials', async () => {
        app = createTestApp();
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'none@test.com', password: 'wrong' });
        expect(res.status).toBe(401);
    });

    it('rejects login with missing fields', async () => {
        app = createTestApp();
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: '', password: '' });
        expect(res.status).toBe(400);
    });

    it('logs in with valid credentials', async () => {
        app = createTestApp();
        const email = `login-${Date.now()}@test.com`;

        await UserModel.create({
            firstName: 'Login',
            lastName: 'Test',
            email,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password: 'Password123!' });

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe(email);
        expect(res.body.user.firstName).toBe('Login');
        expect(res.headers['set-cookie']).toBeDefined();
    });

    it('returns /me when authenticated', async () => {
        app = createTestApp();
        const email = `me-${Date.now()}@test.com`;

        const user = await UserModel.create({
            firstName: 'Me',
            lastName: 'Test',
            email,
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
            .get('/api/auth/me')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe(email);
    });

    it('returns 401 for /me without auth', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });

    it('returns 401 for /me with invalid session', async () => {
        app = createTestApp();
        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', 'sid=invalidtoken');
        expect(res.status).toBe(401);
    });

    it('logs out and revokes session', async () => {
        app = createTestApp();
        const email = `logout-${Date.now()}@test.com`;

        const user = await UserModel.create({
            firstName: 'Logout',
            lastName: 'Test',
            email,
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
            .post('/api/auth/logout')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);

        const session = await SessionModel.findOne({
            tokenHash: hashSessionToken(sessionToken)
        });
        expect(session!.isRevoked).toBe(true);
    });

    async function createAuthedUser(scratchEmail: string) {
        const user = await UserModel.create({
            firstName: 'Stand',
            lastName: 'User',
            email: scratchEmail,
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

    async function seedRole(scope: string, slug: string) {
        return RoleModel.create({
            name: slug,
            scope,
            slug,
            permissions: [],
            isSystem: true,
            isActive: true
        });
    }

    async function seedStandAndStation() {
        const event = await EventModel.create({
            name: 'My Stands Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-09-01'),
            endDate: new Date('2026-09-07'),
            currencyName: 'Coin'
        });
        const stand = await StandModel.create({
            name: 'Stand A',
            type: 'food',
            eventIds: [event._id]
        });
        const station = await StationModel.create({
            name: 'Postazione A',
            standId: stand._id
        });
        return { event, stand, station };
    }

    it('returns ALL stands for a platform admin (no explicit role link needed)', async () => {
        app = createTestApp();
        const platformRole = await seedRole('platform', 'platform-admin');
        const { user, sessionToken } = await createAuthedUser(`platform-${Date.now()}@test.com`);
        await UserRoleModel.create({
            userId: user._id,
            roleId: platformRole._id,
            isActive: true
        });
        const { stand, station } = await seedStandAndStation();

        const res = await request(app)
            .get('/api/auth/me/stands')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.stands.some((s: { id: string }) => s.id === stand._id.toString())).toBe(true);
        expect(res.body.stands[0].eventIds).toContain((stand.eventIds[0] as unknown as { toString(): string }).toString());
        expect(res.body.stations.some((st: { id: string }) => st.id === station._id.toString())).toBe(true);
    });

    it('returns only role-linked stands for a regular user', async () => {
        app = createTestApp();
        await seedRole('platform', 'platform-admin');
        await seedRole('stand', 'cashier');
        const { stand } = await seedStandAndStation();
        const { sessionToken } = await createAuthedUser(`regular-${Date.now()}@test.com`);

        const res = await request(app)
            .get('/api/auth/me/stands')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.stands.some((s: { id: string }) => s.id === stand._id.toString())).toBe(false);
    });
});
