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
import { assignPlatformAdmin } from '../helpers/factory';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession(opts: { platformAdmin?: boolean } = {}) {
    const user = await UserModel.create({
        firstName: 'Int',
        lastName: 'Tester',
        email: `int-${Date.now()}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        isActive: true
    });

    if (opts.platformAdmin) {
        await assignPlatformAdmin(user._id);
    }

    const sessionToken = generateSessionToken();
    await SessionModel.create({
        userId: user._id,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: getSessionExpiryDate(),
        lastActivityAt: new Date()
    });

    return { user, sessionToken };
}

async function createRoleWithUser(
    scope: 'event' | 'stand' | 'platform',
    slug: string,
    userId: string,
    eventId?: string
) {
    const role = await RoleModel.create({
        name: `Role ${slug}`,
        slug,
        scope,
        permissions: ['manage']
    });

    const assignment = await UserRoleModel.create({
        userId,
        roleId: role._id,
        eventId: eventId ?? undefined,
        isActive: true
    });

    return { role, assignment };
}

describe('Integration: role-based access across controllers', () => {
    it('user with no admin role cannot list user-roles (platform-admin only)', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .get('/api/user-roles')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(403);
    });

    it('platform-admin can list user-roles', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession({ platformAdmin: true });

        const res = await request(app)
            .get('/api/user-roles')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].roleId.slug).toBe('platform-admin');
    });

    it('user with no admin role cannot create a role assignment', async () => {
        app = createTestApp();
        const { sessionToken, user } = await createAuthSession();

        const role = await RoleModel.create({
            name: 'Role X',
            slug: 'role-x',
            scope: 'event',
            permissions: ['manage']
        });

        const res = await request(app)
            .post('/api/user-roles')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                userId: user._id.toString(),
                roleId: role._id.toString()
            });

        expect(res.status).toBe(403);
    });

    it('creates a role assignment and verifies it via filter', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession({ platformAdmin: true });

        const event = await EventModel.create({
            name: 'Integration Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const { role } = await createRoleWithUser('event', 'event-admin', user._id.toString(), event._id.toString());

        const res = await request(app)
            .get(`/api/user-roles?userId=${user._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(2);
        const eventAdminAssignment = res.body.items.find((item: { roleId: { slug: string } }) => item.roleId.slug === 'event-admin');
        expect(eventAdminAssignment).toBeDefined();
        expect(String(eventAdminAssignment.roleId._id ?? eventAdminAssignment.roleId)).toBe(role._id.toString());
        expect(eventAdminAssignment.isActive).toBe(true);
    });

    it('toggle disables role and reactivation re-enables it', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession({ platformAdmin: true });

        const event = await EventModel.create({
            name: 'Toggle Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const { assignment } = await createRoleWithUser('event', 'toggle-role', user._id.toString(), event._id.toString());

        const toggleRes = await request(app)
            .patch(`/api/user-roles/${assignment._id}/toggle`)
            .set('Cookie', `sid=${sessionToken}`);
        expect(toggleRes.status).toBe(200);
        expect(toggleRes.body.item.isActive).toBe(false);

        const verify = await UserRoleModel.findById(assignment._id);
        expect(verify?.isActive).toBe(false);

        const reactivateRes = await request(app)
            .patch(`/api/user-roles/${assignment._id}/toggle`)
            .set('Cookie', `sid=${sessionToken}`);
        expect(reactivateRes.status).toBe(200);
        expect(reactivateRes.body.item.isActive).toBe(true);
    });

    it('deletes a role assignment and confirms removal', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession({ platformAdmin: true });

        const event = await EventModel.create({
            name: 'Delete Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const { assignment } = await createRoleWithUser('event', 'delete-role', user._id.toString(), event._id.toString());

        const deleteRes = await request(app)
            .delete(`/api/user-roles/${assignment._id}`)
            .set('Cookie', `sid=${sessionToken}`);
        expect(deleteRes.status).toBe(204);

        const found = await UserRoleModel.findById(assignment._id);
        expect(found).toBeNull();
    });

    it('filters user roles by eventId', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession({ platformAdmin: true });

        const eventA = await EventModel.create({
            name: 'Event A',
            location: { label: 'Loc A', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });
        const eventB = await EventModel.create({
            name: 'Event B',
            location: { label: 'Loc B', coordinates: { type: 'Point', coordinates: [13.0, 42.0] } },
            startDate: new Date('2026-07-01'),
            endDate: new Date('2026-07-07'),
            currencyName: 'TC'
        });

        await createRoleWithUser('event', 'role-a', user._id.toString(), eventA._id.toString());
        await createRoleWithUser('event', 'role-b', user._id.toString(), eventB._id.toString());

        const res = await request(app)
            .get(`/api/user-roles?eventId=${eventA._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].eventId.toString()).toBe(eventA._id.toString());
    });
});
