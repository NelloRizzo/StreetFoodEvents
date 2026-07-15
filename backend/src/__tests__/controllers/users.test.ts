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
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession() {
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

    return { user, sessionToken };
}

describe('Users API', () => {
    it('lists users (empty)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .get('/api/users')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0]!.firstName).toBe('Admin');
    });

    it('returns 401 without auth', async () => {
        app = createTestApp();

        const res = await request(app).get('/api/users');

        expect(res.status).toBe(401);
    });

    it('creates a user', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .post('/api/users')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                firstName: 'Mario',
                lastName: 'Rossi',
                email: `mario-${Date.now()}@test.com`,
                password: 'Password123!'
            });

        expect(res.status).toBe(201);
        expect(res.body.item.firstName).toBe('Mario');
        expect(res.body.item.lastName).toBe('Rossi');
        expect(res.body.item.isActive).toBe(true);
    });

    it('rejects create with short password', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .post('/api/users')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                firstName: 'Mario',
                lastName: 'Rossi',
                email: `mario-${Date.now()}@test.com`,
                password: 'short'
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/at least 8 characters/i);
    });

    it('rejects create with duplicate email', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const email = `dup-${Date.now()}@test.com`;

        const res = await request(app)
            .post('/api/users')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                firstName: 'Mario',
                lastName: 'Rossi',
                email,
                password: 'Password123!'
            });

        const res2 = await request(app)
            .post('/api/users')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                firstName: 'Luigi',
                lastName: 'Verdi',
                email,
                password: 'Password123!'
            });

        expect(res.status).toBe(201);
        expect(res2.status).toBe(409);
        expect(res2.body.message).toMatch(/already exists/i);
    });

    it('gets user by id', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const res = await request(app)
            .get(`/api/users/${user._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.item.firstName).toBe('Admin');
        expect(res.body.item.email).toBe(user.email);
    });

    it('updates user', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const res = await request(app)
            .patch(`/api/users/${user._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ firstName: 'Updated' });

        expect(res.status).toBe(200);
        expect(res.body.item.firstName).toBe('Updated');
    });

    it('deletes user and confirms removal', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const targetUser = await UserModel.create({
            firstName: 'ToDelete',
            lastName: 'User',
            email: `delete-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });

        const res = await request(app)
            .delete(`/api/users/${targetUser._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);

        const found = await UserModel.findById(targetUser._id);
        expect(found).toBeNull();
    });
});
