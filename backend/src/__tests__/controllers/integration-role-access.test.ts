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
import { StandModel } from '../../models/stand.model';
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

async function createEvent(name: string) {
    return EventModel.create({
        name,
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC'
    });
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

    describe('event-admin: potere pieno sul proprio evento, nessun accesso agli altri', () => {
        it('un event-admin puo\' usare le funzioni di cambio del proprio evento senza essere exchange-admin', async () => {
            app = createTestApp();
            const event = await createEvent('Sagra Mia');
            const { user, sessionToken } = await createAuthSession();
            await createRoleWithUser('event', 'event-admin', user._id.toString(), event._id.toString());

            /* exchange-admin di norma: senza il superset sarebbe 403. */
            const balance = await request(app)
                .get(`/api/exchange/${event._id}/balance`)
                .set('Cookie', `sid=${sessionToken}`);
            expect(balance.status).toBe(200);

            const registers = await request(app)
                .get(`/api/exchange/${event._id}/cash-registers`)
                .set('Cookie', `sid=${sessionToken}`);
            expect(registers.status).toBe(200);

            /* Stessa cosa su di un altro evento: resta negato. */
            const other = await createEvent('Altra Sagra');
            const forbidden = await request(app)
                .get(`/api/exchange/${other._id}/balance`)
                .set('Cookie', `sid=${sessionToken}`);
            expect(forbidden.status).toBe(403);
        });

        it('la lista eventi restituisce solo gli eventi su cui l\'utente ha ruoli', async () => {
            app = createTestApp();
            const mine = await createEvent('Il Mio Evento');
            await createEvent('Evento Di Un Altro');
            const { user, sessionToken } = await createAuthSession();
            await createRoleWithUser('event', 'event-admin', user._id.toString(), mine._id.toString());

            const res = await request(app)
                .get('/api/events')
                .set('Cookie', `sid=${sessionToken}`);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].id).toBe(mine._id.toString());
        });

        it('un utente senza ruoli non vede eventi pubblici nella lista amministrativa', async () => {
            app = createTestApp();
            await createEvent('Pubblico A');
            await createEvent('Pubblico B');
            const { sessionToken } = await createAuthSession();

            const res = await request(app)
                .get('/api/events')
                .set('Cookie', `sid=${sessionToken}`);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(2);
        });

        it('il platform-admin vede tutti gli eventi', async () => {
            app = createTestApp();
            await createEvent('Uno');
            await createEvent('Due');
            const { sessionToken } = await createAuthSession({ platformAdmin: true });

            const res = await request(app)
                .get('/api/events')
                .set('Cookie', `sid=${sessionToken}`);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(2);
        });

        it('lo stand-admin vede gli eventi dei propri stand', async () => {
            app = createTestApp();
            const event = await createEvent('Evento dello Stand');
            const { user, sessionToken } = await createAuthSession();

            const stand = await StandModel.create({
                name: 'Stand Uno',
                eventIds: [event._id]
            });
            await createRoleWithUser('stand', 'stand-admin', user._id.toString());
            await UserRoleModel.updateOne(
                { userId: user._id, eventId: { $exists: false } },
                { $set: { standId: stand._id } }
            );

            const res = await request(app)
                .get('/api/events')
                .set('Cookie', `sid=${sessionToken}`);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].id).toBe(event._id.toString());
        });
    });
});
