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
import { UserModel } from '../../models/user.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';
import { assignPlatformAdmin } from '../helpers/factory';
import { EventModel } from '../../models/event.model';
import { RoleModel } from '../../models/role.model';
import { UserRoleModel } from '../../models/user-role.model';

let app: Express;

describe('Events API', () => {
    it('returns health check', async () => {
        app = createTestApp();
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('lists events (empty)', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/events');
        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('lists events with data', async () => {
        app = createTestApp();
        await EventModel.create({
            name: 'Test Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app).get('/api/events');
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0]!.name).toBe('Test Event');
    });

    it('returns 400 for invalid event id on GET', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/events/invalid');
        expect(res.status).toBe(400);
    });

    it('creates an event when authenticated', async () => {
        app = createTestApp();

        const user = await UserModel.create({
            firstName: 'Admin',
            lastName: 'User',
            email: `admin-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });
        await assignPlatformAdmin(user._id);

        const sessionToken = generateSessionToken();
        await SessionModel.create({
            userId: user._id,
            tokenHash: hashSessionToken(sessionToken),
            expiresAt: getSessionExpiryDate(),
            lastActivityAt: new Date()
        });

        const res = await request(app)
            .post('/api/events')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                name: 'New Event',
                location: { label: 'Piazza', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
                startDate: '2026-07-01',
                endDate: '2026-07-05',
                currencyName: 'Coin'
            });

        expect(res.status).toBe(201);
        expect(res.body.item.name).toBe('New Event');
    });

    describe('sponsor dell\'evento', () => {
        const logo = { url: 'https://cdn.example.com/logo.png', publicId: 'logo-1', width: 200, height: 80, format: 'png', bytes: 1000 };

        async function createEventWithSponsors(sponsors: unknown[]) {
            app = createTestApp();
            const user = await UserModel.create({
                firstName: 'Admin',
                lastName: 'Sponsors',
                email: `admin-sponsor-${Date.now()}@test.com`,
                passwordHash: await argon2.hash('Password123!'),
                isActive: true
            });
            await assignPlatformAdmin(user._id);
            const sessionToken = generateSessionToken();
            await SessionModel.create({
                userId: user._id,
                tokenHash: hashSessionToken(sessionToken),
                expiresAt: getSessionExpiryDate(),
                lastActivityAt: new Date()
            });

            const res = await request(app)
                .post('/api/events')
                .set('Cookie', `sid=${sessionToken}`)
                .send({
                    name: 'Event con sponsor',
                    location: { label: 'Piazza', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
                    startDate: '2026-07-01',
                    endDate: '2026-07-05',
                    currencyName: 'Coin',
                    sponsors
                });
            return { res, sessionToken };
        }

        it('crea e rilegge gli sponsor con livello e stato', async () => {
            const { res } = await createEventWithSponsors([
                { name: 'Main Partner', logo, url: 'https://main.example.com', tier: 'main', sortOrder: 0 },
                { name: 'Sponsor Uno', logo, url: 'http://uno.example.com', tier: 'sponsor', enabled: true, sortOrder: 1 },
                { name: 'Partner', logo, url: null, tier: 'partner', enabled: false, sortOrder: 2 }
            ]);

            expect(res.status).toBe(201);
            expect(res.body.item.sponsors).toHaveLength(3);
            expect(res.body.item.sponsors[0]).toMatchObject({
                name: 'Main Partner',
                tier: 'main',
                enabled: true,
                sortOrder: 0
            });
            expect(res.body.item.sponsors[1].tier).toBe('sponsor');
            /* enabled=false esplicitamente richiesto resta false. */
            expect(res.body.item.sponsors[2].enabled).toBe(false);
        });

        /* L'url finisce in un href sul volantino pubblico: un javascript:
         * inserito da un amministratore sarebbe uno stored-XSS. */
        it('scarta gli url non http(s) e forza i default del livello', async () => {
            const { res } = await createEventWithSponsors([
                { name: 'XSS', logo, url: 'javascript:alert(document.cookie)' },
                { name: 'Data', logo, url: 'data:text/html,<script>alert(1)</script>' },
                { name: 'Senza schema', logo, url: 'example.com' },
                { name: 'Livello strano', logo, url: 'https://ok.example.com', tier: 'pippo' }
            ]);

            expect(res.status).toBe(201);
            const sponsors = res.body.item.sponsors as Array<{ name: string; url: string | null; tier: string }>;
            const byName = new Map(sponsors.map((s) => [s.name, s]));
            expect(byName.get('XSS')?.url).toBeNull();
            expect(byName.get('Data')?.url).toBeNull();
            /* Senza schema non e' un URL assoluto valido: scartato. */
            expect(byName.get('Senza schema')?.url).toBeNull();
            expect(byName.get('Livello strano')?.tier).toBe('sponsor');
        });

        it('aggiorna gli sponsor con PATCH e li copia nella duplicazione evento', async () => {
            const { res, sessionToken } = await createEventWithSponsors([
                { name: 'Originale', logo, url: 'https://a.example.com', tier: 'sponsor' }
            ]);
            const eventId = res.body.item.id;

            const patch = await request(app)
                .patch(`/api/events/${eventId}`)
                .set('Cookie', `sid=${sessionToken}`)
                .send({ sponsors: [{ name: 'Aggiornato', logo, url: 'https://b.example.com', tier: 'main', sortOrder: 5 }] });
            expect(patch.status).toBe(200);
            expect(patch.body.item.sponsors).toHaveLength(1);
            expect(patch.body.item.sponsors[0]).toMatchObject({ name: 'Aggiornato', tier: 'main', sortOrder: 5 });

            /* Gli sponsor sono configurazione: la nuova edizione li eredita. */
            const dup = await request(app)
                .post(`/api/events/${eventId}/duplicate`)
                .set('Cookie', `sid=${sessionToken}`)
                .send({ name: 'Edizione duplicata' });
            expect(dup.status).toBe(201);
            expect(dup.body.item.sponsors).toHaveLength(1);
            expect(dup.body.item.sponsors[0].name).toBe('Aggiornato');
        });
    });

    it('returns 401 for create without auth', async () => {
        app = createTestApp();
        const res = await request(app)
            .post('/api/events')
            .send({ name: 'Test' });
        expect(res.status).toBe(401);
    });

    it('updates an event', async () => {
        app = createTestApp();

        const user = await UserModel.create({
            firstName: 'Admin',
            lastName: 'User',
            email: `admin-upd-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });
        await assignPlatformAdmin(user._id);

        const sessionToken = generateSessionToken();
        await SessionModel.create({
            userId: user._id,
            tokenHash: hashSessionToken(sessionToken),
            expiresAt: getSessionExpiryDate(),
            lastActivityAt: new Date()
        });

        const event = await EventModel.create({
            name: 'Original',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .patch(`/api/events/${event._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Updated' });

        expect(res.status).toBe(200);
        expect(res.body.item.name).toBe('Updated');
    });

    it('deletes an event', async () => {
        app = createTestApp();

        const user = await UserModel.create({
            firstName: 'Admin',
            lastName: 'User',
            email: `admin-del-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });
        await assignPlatformAdmin(user._id);

        const sessionToken = generateSessionToken();
        await SessionModel.create({
            userId: user._id,
            tokenHash: hashSessionToken(sessionToken),
            expiresAt: getSessionExpiryDate(),
            lastActivityAt: new Date()
        });

        const event = await EventModel.create({
            name: 'To Delete',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .delete(`/api/events/${event._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);

        const found = await EventModel.findById(event._id);
        expect(found).toBeNull();
    });

    it('hides non-public events from the public listing', async () => {
        app = createTestApp();

        await EventModel.create({
            name: 'Visible Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });
        await EventModel.create({
            name: 'Hidden Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-10'),
            endDate: new Date('2026-06-15'),
            currencyName: 'TC',
            isPublic: false
        });

        const res = await request(app).get('/api/events');
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].name).toBe('Visible Event');
    });

    it('shows non-public events to platform admins', async () => {
        app = createTestApp();

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

        const platformAdminRole = await RoleModel.create({
            name: 'Platform Admin',
            scope: 'platform',
            slug: 'platform-admin',
            permissions: [],
            isSystem: true,
            isActive: true
        });
        await UserRoleModel.create({
            userId: user._id,
            roleId: platformAdminRole._id,
            isActive: true
        });

        await EventModel.create({
            name: 'Hidden Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-10'),
            endDate: new Date('2026-06-15'),
            currencyName: 'TC',
            isPublic: false
        });

        const res = await request(app)
            .get('/api/events')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].name).toBe('Hidden Event');
        expect(res.body.items[0].isPublic).toBe(false);
    });

    it('shows non-public events to event-scoped admins', async () => {
        app = createTestApp();

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

        const event = await EventModel.create({
            name: 'Hidden Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-10'),
            endDate: new Date('2026-06-15'),
            currencyName: 'TC',
            isPublic: false
        });

        const eventAdminRole = await RoleModel.create({
            name: 'Event Admin',
            scope: 'event',
            slug: 'event-admin',
            permissions: [],
            isSystem: true,
            isActive: true
        });
        await UserRoleModel.create({
            userId: user._id,
            roleId: eventAdminRole._id,
            eventId: event._id,
            isActive: true
        });

        const res = await request(app)
            .get('/api/events')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].name).toBe('Hidden Event');
    });

    it('excludes non-public events even for admins when public=true', async () => {
        app = createTestApp();

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

        const platformAdminRole = await RoleModel.create({
            name: 'Platform Admin',
            scope: 'platform',
            slug: 'platform-admin',
            permissions: [],
            isSystem: true,
            isActive: true
        });
        await UserRoleModel.create({
            userId: user._id,
            roleId: platformAdminRole._id,
            isActive: true
        });

        await EventModel.create({
            name: 'Hidden Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-10'),
            endDate: new Date('2027-06-15'),
            currencyName: 'TC',
            isPublic: false
        });
        await EventModel.create({
            name: 'Visible Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-10'),
            endDate: new Date('2027-06-15'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .get('/api/events?public=true')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].name).toBe('Visible Event');
    });

    it('excludes non-public events from activeEvents in home endpoint', async () => {
        app = createTestApp();

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

        await EventModel.create({
            name: 'Hidden Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-09-01'),
            endDate: new Date('2026-09-07'),
            currencyName: 'TC',
            isPublic: false
        });

        const res = await request(app)
            .get('/api/events/home')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.activeEvents).toHaveLength(0);
    });

    it('creates and updates an event with isPublic flag', async () => {
        app = createTestApp();

        const user = await UserModel.create({
            firstName: 'Admin',
            lastName: 'User',
            email: `admin-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });
        await assignPlatformAdmin(user._id);

        const sessionToken = generateSessionToken();
        await SessionModel.create({
            userId: user._id,
            tokenHash: hashSessionToken(sessionToken),
            expiresAt: getSessionExpiryDate(),
            lastActivityAt: new Date()
        });

        const created = await request(app)
            .post('/api/events')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                name: 'Draft Event',
                location: { label: 'Piazza', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
                startDate: '2026-07-01',
                endDate: '2026-07-05',
                currencyName: 'Coin',
                isPublic: false
            });

        expect(created.status).toBe(201);
        expect(created.body.item.isPublic).toBe(false);

        const updated = await request(app)
            .patch(`/api/events/${created.body.item.id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ isPublic: true });

        expect(updated.status).toBe(200);
        expect(updated.body.item.isPublic).toBe(true);
    });

    it('round-trips the adhesionEnabled flag through create and read', async () => {
        app = createTestApp();

        const user = await UserModel.create({
            firstName: 'Admin',
            lastName: 'User',
            email: `admin-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });
        await assignPlatformAdmin(user._id);

        const sessionToken = generateSessionToken();
        await SessionModel.create({
            userId: user._id,
            tokenHash: hashSessionToken(sessionToken),
            expiresAt: getSessionExpiryDate(),
            lastActivityAt: new Date()
        });

        const created = await request(app)
            .post('/api/events')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                name: 'Adhesion Event',
                location: { label: 'Piazza', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
                startDate: '2026-07-01',
                endDate: '2026-07-05',
                currencyName: 'Coin',
                adhesionEnabled: true
            });

        expect(created.status).toBe(201);
        expect(created.body.item.adhesionEnabled).toBe(true);

        const createdDefault = await request(app)
            .post('/api/events')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                name: 'Default Event',
                location: { label: 'Piazza', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
                startDate: '2026-07-01',
                endDate: '2026-07-05',
                currencyName: 'Coin'
            });

        expect(createdDefault.status).toBe(201);
        expect(createdDefault.body.item.adhesionEnabled).toBe(false);

        const patched = await request(app)
            .patch(`/api/events/${created.body.item.id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ adhesionEnabled: false });

        expect(patched.status).toBe(200);
        expect(patched.body.item.adhesionEnabled).toBe(false);
    });

    it('orders the admin list by startDate descending', async () => {
        app = createTestApp();

        const user = await UserModel.create({
            firstName: 'Admin',
            lastName: 'User',
            email: `admin-${Date.now()}@test.com`,
            passwordHash: await argon2.hash('Password123!'),
            isActive: true
        });
        await assignPlatformAdmin(user._id);

        const sessionToken = generateSessionToken();
        await SessionModel.create({
            userId: user._id,
            tokenHash: hashSessionToken(sessionToken),
            expiresAt: getSessionExpiryDate(),
            lastActivityAt: new Date()
        });

        await EventModel.create({
            name: 'Older Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });
        await EventModel.create({
            name: 'Newer Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-09-01'),
            endDate: new Date('2026-09-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .get('/api/events')
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(['Newer Event', 'Older Event']);
    });

    it('keeps the public list ordered by startDate ascending', async () => {
        app = createTestApp();

        await EventModel.create({
            name: 'Newer Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-09-01'),
            endDate: new Date('2026-09-07'),
            currencyName: 'TC'
        });
        await EventModel.create({
            name: 'Older Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .get('/api/events?public=true');

        expect(res.status).toBe(200);
        expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(['Older Event', 'Newer Event']);
    });
});
