import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { AdhesionFormModel } from '../../models/adhesion-form.model';
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
        firstName: 'Adhesion',
        lastName: 'Tester',
        email: `adhesion-${Date.now()}@test.com`,
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

async function setupAdhesionEnvironment() {
    app = createTestApp();
    const { user, sessionToken } = await createAuthSession();

    const event = await EventModel.create({
        name: 'Adhesion Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-07'),
        currencyName: 'StreetCoin',
        exchangeRate: 2,
        feeBands: [{ maxAmount: 1000, feePercent: 10, feeFlat: 20 }],
        cashPaymentsEnabled: true
    });

    const eventAdminRole = await RoleModel.create({
        name: 'Event Admin',
        scope: 'event',
        slug: 'event-admin',
        permissions: ['events:read', 'events:update'],
        isSystem: true,
        isActive: true
    });

    await UserRoleModel.create({
        userId: user._id,
        roleId: eventAdminRole._id,
        eventId: event._id,
        isActive: true
    });

    return { user, sessionToken, event, eventAdminRole };
}

describe('Integration — Adhesion Form', () => {
    it('returns 404 for ungenerated form and 400 for invalid event id', async () => {
        const env = await setupAdhesionEnvironment();

        const missing = await request(app).get(`/api/events/${env.event._id}/adhesion-form`);
        expect(missing.status).toBe(404);

        const invalid = await request(app).get('/api/events/not-an-id/adhesion-form');
        expect(invalid.status).toBe(400);
    });

    it('generates the form from event settings (guided + static sections)', async () => {
        const env = await setupAdhesionEnvironment();

        const res = await request(app)
            .post(`/api/events/${env.event._id}/adhesion-form/generate`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(res.status).toBe(201);

        const item = res.body.item;
        expect(item.eventId).toBe(env.event._id.toString());
        expect(item.generatedAt).toBeTruthy();
        expect(item.stale).toBe(false);
        expect(item.eventFingerprint).toBeTruthy();

        const slugs = item.sections.map((s: { slug: string }) => s.slug);
        expect(slugs).toEqual([
            'event-header',
            'stand-data',
            'products',
            'haccp',
            'currency',
            'energy',
            'fees',
            'participation-price',
            'deposit',
            'regulation',
            'outcome'
        ]);

        const header = item.sections.find((s: { slug: string }) => s.slug === 'event-header');
        expect(header.generatedFrom).toBe('event-header');
        expect(header.content).toContain('Adhesion Event');

        const currency = item.sections.find((s: { slug: string }) => s.slug === 'currency');
        expect(currency.generatedFrom).toBe('currency');
        expect(currency.content).toContain('<mark><strong>StreetCoin</strong></mark>');
        expect(currency.content).toContain('StreetCoin');
        expect(currency.content).toContain('1 \u20AC = 2 StreetCoin');

        const fees = item.sections.find((s: { slug: string }) => s.slug === 'fees');
        expect(fees.generatedFrom).toBe('fees');
        expect(fees.content).toContain('10%');
        expect(fees.content).toContain('20 \u20AC quota fissa');

        const standData = item.sections.find((s: { slug: string }) => s.slug === 'stand-data');
        expect(standData.generatedFrom).toBeNull();
    });

    it('exposes the generated form publicly', async () => {
        const env = await setupAdhesionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/adhesion-form/generate`)
            .set('Cookie', `sid=${env.sessionToken}`);

        const res = await request(app).get(`/api/events/${env.event._id}/adhesion-form`);
        expect(res.status).toBe(200);
        expect(res.body.item.sections).toHaveLength(11);
    });

    it('highlights the currency name and embeds its logo', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Logo Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-09-01'),
            endDate: new Date('2026-09-07'),
            currencyName: 'StreetCoin',
            exchangeRate: 2,
            currencySymbol: {
                url: 'https://cdn.example.com/streetcoin.png',
                publicId: 'streetcoin',
                width: 128,
                height: 128,
                format: 'png',
                bytes: 2048
            },
            cashPaymentsEnabled: true
        });

        const adminRole = await RoleModel.create({
            name: 'Event Admin',
            scope: 'event',
            slug: 'event-admin',
            permissions: ['events:read', 'events:update'],
            isSystem: true,
            isActive: true
        });

        await UserRoleModel.create({
            userId: user._id,
            roleId: adminRole._id,
            eventId: event._id,
            isActive: true
        });

        const res = await request(app)
            .post(`/api/events/${event._id}/adhesion-form/generate`)
            .set('Cookie', `sid=${sessionToken}`);
        expect(res.status).toBe(201);

        const currency = res.body.item.sections.find((s: { slug: string }) => s.slug === 'currency');
        expect(currency.content).toContain('<img src="https://cdn.example.com/streetcoin.png"');
        expect(currency.content).toContain('<mark><strong>StreetCoin</strong></mark>');
        expect(currency.content).toContain('StreetCoin');
        expect(currency.content).toContain('1 \u20AC = 2 StreetCoin');

        const patch = await request(app)
            .patch(`/api/events/${event._id}/adhesion-form`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ sections: [{ slug: 'currency', title: currency.title, content: currency.content }] });
        expect(patch.status).toBe(200);
        const patchedContent = patch.body.item.sections.find((s: { slug: string }) => s.slug === 'currency').content;
        expect(patchedContent).toContain('<img src="https://cdn.example.com/streetcoin.png"');
        expect(patchedContent).toContain('<mark><strong>StreetCoin</strong></mark>');
    });

    it('rejects unauthenticated and unauthorized writes', async () => {
        const env = await setupAdhesionEnvironment();
        const { sessionToken: plainToken } = await createAuthSession();

        const anon = await request(app).post(`/api/events/${env.event._id}/adhesion-form/generate`);
        expect(anon.status).toBe(401);

        const noRole = await request(app)
            .post(`/api/events/${env.event._id}/adhesion-form/generate`)
            .set('Cookie', `sid=${plainToken}`);
        expect(noRole.status).toBe(403);
    });

    it('updates a section manually and preserves it across regeneration', async () => {
        const env = await setupAdhesionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/adhesion-form/generate`)
            .set('Cookie', `sid=${env.sessionToken}`);

        const customTitle = 'Sezione A — Dati personalizzati';
        const customContent = '<p>Contenuto manuale dello stand</p>';

        const patch = await request(app)
            .patch(`/api/events/${env.event._id}/adhesion-form`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({
                sections: [{ slug: 'stand-data', title: customTitle, content: customContent }]
            });
        expect(patch.status).toBe(200);
        expect(patch.body.item.sections.find((s: { slug: string }) => s.slug === 'stand-data').title).toBe(customTitle);
        expect(patch.body.item.stale).toBe(false);

        const regenerate = await request(app)
            .post(`/api/events/${env.event._id}/adhesion-form/generate`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(regenerate.status).toBe(200);

        const after = regenerate.body.item.sections.find((s: { slug: string }) => s.slug === 'stand-data');
        expect(after.title).toBe(customTitle);
        expect(after.content).toBe(customContent);

        const header = regenerate.body.item.sections.find((s: { slug: string }) => s.slug === 'event-header');
        expect(header.content).toContain('Adhesion Event');
    });

    it('rejects PATCH with invalid slug or empty sections', async () => {
        const env = await setupAdhesionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/adhesion-form/generate`)
            .set('Cookie', `sid=${env.sessionToken}`);

        const badSlug = await request(app)
            .patch(`/api/events/${env.event._id}/adhesion-form`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ sections: [{ slug: 'nope', title: 'X', content: 'Y' }] });
        expect(badSlug.status).toBe(400);

        const empty = await request(app)
            .patch(`/api/events/${env.event._id}/adhesion-form`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ sections: [] });
        expect(empty.status).toBe(400);
    });

    it('marks the form stale when guided event settings change', async () => {
        const env = await setupAdhesionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/adhesion-form/generate`)
            .set('Cookie', `sid=${env.sessionToken}`);

        const res = await request(app)
            .patch(`/api/events/${env.event._id}`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ feeBands: [{ maxAmount: 5000, feePercent: 15, feeFlat: 50 }] });
        expect(res.status).toBe(200);
        expect(res.body.adhesionFormStale).toBe(true);

        const form = await request(app).get(`/api/events/${env.event._id}/adhesion-form`);
        expect(form.status).toBe(200);
        expect(form.body.item.stale).toBe(true);

        const regenerate = await request(app)
            .post(`/api/events/${env.event._id}/adhesion-form/generate`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(regenerate.status).toBe(200);
        expect(regenerate.body.item.stale).toBe(false);

        const fees = regenerate.body.item.sections.find((s: { slug: string }) => s.slug === 'fees');
        expect(fees.content).toContain('15%');
        expect(fees.content).toContain('50 \u20AC quota fissa');
    });

    it('does not mark stale when non-guided event fields change', async () => {
        const env = await setupAdhesionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/adhesion-form/generate`)
            .set('Cookie', `sid=${env.sessionToken}`);

        const res = await request(app)
            .patch(`/api/events/${env.event._id}`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ shortDescription: 'Solo descrizione' });
        expect(res.status).toBe(200);
        expect(res.body.adhesionFormStale).toBeUndefined();

        const form = await request(app).get(`/api/events/${env.event._id}/adhesion-form`);
        expect(form.body.item.stale).toBe(false);
    });

    it('deletes the form and re-generates as 201', async () => {
        const env = await setupAdhesionEnvironment();

        await request(app)
            .post(`/api/events/${env.event._id}/adhesion-form/generate`)
            .set('Cookie', `sid=${env.sessionToken}`);

        const res = await request(app)
            .delete(`/api/events/${env.event._id}/adhesion-form`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(res.status).toBe(204);

        const missing = await request(app).get(`/api/events/${env.event._id}/adhesion-form`);
        expect(missing.status).toBe(404);

        const again = await request(app)
            .post(`/api/events/${env.event._id}/adhesion-form/generate`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(again.status).toBe(201);

        const stored = await AdhesionFormModel.findOne({ eventId: env.event._id });
        expect(stored).toBeTruthy();
        expect(stored?.sections).toHaveLength(11);
    });

    it('returns 404 when generating for a missing event', async () => {
        const env = await setupAdhesionEnvironment();
        const fakeEventId = new (await import('mongoose')).Types.ObjectId();

        await UserRoleModel.create({
            userId: env.user._id,
            roleId: env.eventAdminRole._id,
            eventId: fakeEventId,
            isActive: true
        });

        const res = await request(app)
            .post(`/api/events/${fakeEventId.toString()}/adhesion-form/generate`)
            .set('Cookie', `sid=${env.sessionToken}`);
        expect(res.status).toBe(404);
    });
});