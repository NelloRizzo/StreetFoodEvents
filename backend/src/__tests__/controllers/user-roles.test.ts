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
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession() {
    const user = await UserModel.create({
        firstName: 'UR',
        lastName: 'Tester',
        email: `ur-${Date.now()}@test.com`,
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

describe('UserRoles API', () => {
    it('lists user roles (empty)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .get('/api/user-roles')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('creates a user role', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const role = await RoleModel.create({
            name: 'Event Admin',
            slug: 'event-admin',
            scope: 'event',
            permissions: ['manage']
        });

        const res = await request(app)
            .post('/api/user-roles')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                userId: user._id.toString(),
                roleId: role._id.toString(),
                eventId: event._id.toString()
            });

        expect(res.status).toBe(201);
        expect(res.body.item.roleId.toString()).toBe(role._id.toString());
        expect(res.body.item.isActive).toBe(true);
    });

    it('reactivates inactive user role', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const role = await RoleModel.create({
            name: 'Event Staff',
            slug: 'event-staff',
            scope: 'event',
            permissions: ['scan']
        });

        const createRes = await request(app)
            .post('/api/user-roles')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                userId: user._id.toString(),
                roleId: role._id.toString(),
                eventId: event._id.toString()
            });
        expect(createRes.status).toBe(201);
        const userRoleId = createRes.body.item.id;

        await request(app)
            .patch(`/api/user-roles/${userRoleId}/toggle`)
            .set('Cookie', `sid=${sessionToken}`);
        const toggled = await UserRoleModel.findById(userRoleId);
        expect(toggled?.isActive).toBe(false);

        const reactivateRes = await request(app)
            .post('/api/user-roles')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                userId: user._id.toString(),
                roleId: role._id.toString(),
                eventId: event._id.toString()
            });

        expect(reactivateRes.status).toBe(200);
        expect(reactivateRes.body.item.isActive).toBe(true);
    });

    it('gets user role by filter', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const roleA = await RoleModel.create({
            name: 'Role A',
            slug: 'role-a',
            scope: 'event',
            permissions: []
        });
        const roleB = await RoleModel.create({
            name: 'Role B',
            slug: 'role-b',
            scope: 'event',
            permissions: []
        });

        const otherUser = await UserModel.create({
            firstName: 'Other',
            lastName: 'User',
            email: `other-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });

        await UserRoleModel.create({
            userId: user._id,
            roleId: roleA._id,
            eventId: event._id,
            isActive: true
        });
        await UserRoleModel.create({
            userId: otherUser._id,
            roleId: roleB._id,
            eventId: event._id,
            isActive: true
        });

        const res = await request(app)
            .get(`/api/user-roles?userId=${user._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
    });

    it('toggles user role', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const role = await RoleModel.create({
            name: 'Toggle Role',
            slug: 'toggle-role',
            scope: 'event',
            permissions: []
        });

        const ur = await UserRoleModel.create({
            userId: user._id,
            roleId: role._id,
            eventId: event._id,
            isActive: true
        });

        const res = await request(app)
            .patch(`/api/user-roles/${ur._id}/toggle`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.item.isActive).toBe(false);

        const res2 = await request(app)
            .patch(`/api/user-roles/${ur._id}/toggle`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res2.status).toBe(200);
        expect(res2.body.item.isActive).toBe(true);
    });

    it('deletes user role', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const role = await RoleModel.create({
            name: 'Delete Role',
            slug: 'delete-role',
            scope: 'event',
            permissions: []
        });

        const ur = await UserRoleModel.create({
            userId: user._id,
            roleId: role._id,
            eventId: event._id,
            isActive: true
        });

        const res = await request(app)
            .delete(`/api/user-roles/${ur._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);

        const found = await UserRoleModel.findById(ur._id);
        expect(found).toBeNull();
    });

    it('returns 401 without auth', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/user-roles');
        expect(res.status).toBe(401);
    });
});
