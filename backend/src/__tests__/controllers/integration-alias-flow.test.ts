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

import { AliasModel } from '../../models/alias.model';
import { EventModel } from '../../models/event.model';
import { StandModel } from '../../models/stand.model';
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
        firstName: 'Flow',
        lastName: 'Tester',
        email: `flow-${Date.now()}@test.com`,
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

describe('Alias creation → resolution integration', () => {
    it('creates event alias and resolves it', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Festa di Sara',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const createRes = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'festasara', entityType: 'event', entityRef: event._id.toString() });

        expect(createRes.status).toBe(201);

        const resolveRes = await request(app).get('/api/resolve/event/festasara');

        expect(resolveRes.status).toBe(200);
        expect(resolveRes.body.entityType).toBe('event');
        expect(resolveRes.body.entityId).toBe(event._id.toString());
        expect(resolveRes.body.entityName).toBe('Festa di Sara');
    });

    it('creates stand alias and resolves it', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const stand = await StandModel.create({
            name: 'Pizza Mania'
        });

        const createRes = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'pizzamania', entityType: 'stand', entityRef: stand._id.toString() });

        expect(createRes.status).toBe(201);

        const resolveRes = await request(app).get('/api/resolve/stand/pizzamania');

        expect(resolveRes.status).toBe(200);
        expect(resolveRes.body.entityType).toBe('stand');
        expect(resolveRes.body.entityId).toBe(stand._id.toString());
        expect(resolveRes.body.entityName).toBe('Pizza Mania');
    });

    it('resolve returns entity name from the referenced entity', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Summer Food Festival 2026',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-07-01'),
            endDate: new Date('2026-07-07'),
            currencyName: 'TC'
        });

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'summer2026', entityType: 'event', entityRef: event._id.toString() });

        const resolveRes = await request(app).get('/api/resolve/event/summer2026');

        expect(resolveRes.status).toBe(200);
        expect(resolveRes.body.entityName).toBe('Summer Food Festival 2026');
    });

    it('update alias text — old text no longer resolves', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Rename Me Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const createRes = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'old-name', entityType: 'event', entityRef: event._id.toString() });

        expect(createRes.status).toBe(201);
        const aliasId = createRes.body.item.id;

        const patchRes = await request(app)
            .patch(`/api/aliases/${aliasId}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'new-name' });

        expect(patchRes.status).toBe(200);

        const oldRes = await request(app).get('/api/resolve/event/old-name');
        expect(oldRes.status).toBe(404);

        const newRes = await request(app).get('/api/resolve/event/new-name');
        expect(newRes.status).toBe(200);
        expect(newRes.body.entityId).toBe(event._id.toString());
    });

    it('delete alias — resolution fails with 404', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Delete Me Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const createRes = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'doomed-alias', entityType: 'event', entityRef: event._id.toString() });

        expect(createRes.status).toBe(201);
        const aliasId = createRes.body.item.id;

        const deleteRes = await request(app)
            .delete(`/api/aliases/${aliasId}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(deleteRes.status).toBe(204);

        const found = await AliasModel.findById(aliasId);
        expect(found).toBeNull();

        const resolveRes = await request(app).get('/api/resolve/event/doomed-alias');
        expect(resolveRes.status).toBe(404);
    });
});
