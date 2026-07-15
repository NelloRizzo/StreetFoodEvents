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

import { RoleModel } from '../../models/role.model';
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
        firstName: 'Role',
        lastName: 'Tester',
        email: `role-${Date.now()}@test.com`,
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

describe('Roles API', () => {
    it('lists roles (empty)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .get('/api/roles')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('lists roles with data', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        await RoleModel.create({ name: 'Manager', slug: 'manager', scope: 'platform' });
        await RoleModel.create({ name: 'Operator', slug: 'operator', scope: 'event' });

        const res = await request(app)
            .get('/api/roles')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(2);
        expect(res.body.items[0]!.name).toBe('Operator');
        expect(res.body.items[1]!.name).toBe('Manager');
    });

    it('returns 401 without auth', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/roles');
        expect(res.status).toBe(401);
    });
});
