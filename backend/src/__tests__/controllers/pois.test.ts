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
import { POIModel } from '../../models/poi.model';
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
        firstName: 'Poi',
        lastName: 'Tester',
        email: `poi-${Date.now()}@test.com`,
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

describe('POIs API', () => {
    it('lists POIs (empty)', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/pois');
        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('creates a POI', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const event = await EventModel.create({
            name: 'POI Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .post('/api/pois')
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                eventId: event._id.toString(),
                name: 'Bagno 1',
                location: { type: 'Point', coordinates: [12.5, 41.9] }
            });

        expect(res.status).toBe(201);
        expect(res.body.item.name).toBe('Bagno 1');
        expect(res.body.item.eventId).toBe(event._id.toString());
    });

    it('filters POIs by eventId', async () => {
        app = createTestApp();
        const eventA = await EventModel.create({
            name: 'Event A',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });
        const eventB = await EventModel.create({
            name: 'Event B',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        await POIModel.create({ eventId: eventA._id, name: 'POI A1', location: { type: 'Point', coordinates: [12.5, 41.9] } });
        await POIModel.create({ eventId: eventA._id, name: 'POI A2', location: { type: 'Point', coordinates: [12.5, 41.9] } });
        await POIModel.create({ eventId: eventB._id, name: 'POI B1', location: { type: 'Point', coordinates: [12.5, 41.9] } });

        const res = await request(app).get(`/api/pois?eventId=${eventA._id}`);
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(2);
        expect(res.body.items[0]!.name).toBe('POI A1');
        expect(res.body.items[1]!.name).toBe('POI A2');
    });

    it('gets POI by id', async () => {
        app = createTestApp();
        const event = await EventModel.create({
            name: 'POI Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });
        const poi = await POIModel.create({
            eventId: event._id,
            name: 'Info Point',
            location: { type: 'Point', coordinates: [12.5, 41.9] }
        });

        const res = await request(app).get(`/api/pois/${poi._id}`);
        expect(res.status).toBe(200);
        expect(res.body.item.name).toBe('Info Point');
        expect(res.body.item.id).toBe(poi._id.toString());
    });

    it('updates POI', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const event = await EventModel.create({
            name: 'POI Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });
        const poi = await POIModel.create({
            eventId: event._id,
            name: 'Vecchio Nome',
            location: { type: 'Point', coordinates: [12.5, 41.9] }
        });

        const res = await request(app)
            .patch(`/api/pois/${poi._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Updated' });

        expect(res.status).toBe(200);
        expect(res.body.item.name).toBe('Updated');
    });

    it('deletes POI', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const event = await EventModel.create({
            name: 'POI Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });
        const poi = await POIModel.create({
            eventId: event._id,
            name: 'Da Eliminare',
            location: { type: 'Point', coordinates: [12.5, 41.9] }
        });

        const res = await request(app)
            .delete(`/api/pois/${poi._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);

        const found = await POIModel.findById(poi._id);
        expect(found).toBeNull();
    });

    it('returns 401 for create without auth', async () => {
        app = createTestApp();
        const res = await request(app)
            .post('/api/pois')
            .send({
                eventId: '000000000000000000000001',
                name: 'Test',
                location: { type: 'Point', coordinates: [12.5, 41.9] }
            });
        expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent POI', async () => {
        app = createTestApp();
        const fakeId = '000000000000000000000001';
        const res = await request(app).get(`/api/pois/${fakeId}`);
        expect(res.status).toBe(404);
    });
});
