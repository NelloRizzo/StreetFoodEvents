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

import { ContestPOIModel } from '../../models/contest-poi.model';
import { ContestModel } from '../../models/contest.model';
import { EventModel } from '../../models/event.model';
import { POIModel } from '../../models/poi.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { StandModel } from '../../models/stand.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import { createTestApp } from '../helpers/test-app';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';

let app: Express;

async function createAuthSession() {
    const user = await UserModel.create({
        firstName: 'Contest',
        lastName: 'Sync',
        email: `contest-sync-${Date.now()}@test.com`,
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

async function assignContestAdmin(userId: string, eventId: string) {
    const role = await RoleModel.create({
        name: 'Contest Admin',
        slug: 'contest-admin',
        scope: 'event',
        permissions: ['manage']
    });
    await UserRoleModel.create({
        userId,
        roleId: role._id,
        eventId,
        isActive: true
    });
}

async function createEvent() {
    return EventModel.create({
        name: `Contest Sync Event ${Date.now()}`,
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC'
    });
}

describe('Integration: contest POI sync from event stands and POIs', () => {
    it('listContestPois auto-syncs all stands and event POIs into the pool', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        const stand1 = await StandModel.create({ name: 'Pizzeria', eventIds: [event._id] });
        const stand2 = await StandModel.create({ name: 'Paninoteca', eventIds: [event._id] });
        const poi1 = await POIModel.create({
            eventId: event._id,
            name: 'Fontana Centrale',
            location: { type: 'Point', coordinates: [12.5, 41.9] }
        });
        const poi2 = await POIModel.create({
            eventId: event._id,
            name: 'Palco Principale',
            location: { type: 'Point', coordinates: [12.51, 41.91] }
        });
        await assignContestAdmin(user._id.toString(), event._id.toString());

        const res = await request(app)
            .get(`/api/contests/contest-pois?eventId=${event._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        const items = res.body.items as Array<{
            standId: string | null;
            poiId: string | null;
            name: string;
        }>;
        expect(items).toHaveLength(4);

        const byStand = items.filter((i) => i.standId);
        const byPoi = items.filter((i) => i.poiId);
        expect(byStand.map((i) => i.name).sort()).toEqual(['Paninoteca', 'Pizzeria']);
        expect(byStand.map((i) => i.standId).sort()).toEqual([stand1._id.toString(), stand2._id.toString()].sort());
        expect(byPoi.map((i) => i.name).sort()).toEqual(['Fontana Centrale', 'Palco Principale']);
        expect(byPoi.map((i) => i.poiId).sort()).toEqual([poi1._id.toString(), poi2._id.toString()].sort());
    });

    it('sync is idempotent', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        await StandModel.create({ name: 'Pizzeria', eventIds: [event._id] });
        await POIModel.create({
            eventId: event._id,
            name: 'Fontana',
            location: { type: 'Point', coordinates: [12.5, 41.9] }
        });
        await assignContestAdmin(user._id.toString(), event._id.toString());

        await request(app)
            .get(`/api/contests/contest-pois?eventId=${event._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        const res = await request(app)
            .get(`/api/contests/contest-pois?eventId=${event._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(2);
        expect(await ContestPOIModel.countDocuments({ eventId: event._id })).toBe(2);
    });

    it('sync links an existing free POI with the same name instead of duplicating', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        const stand = await StandModel.create({ name: 'Griglia', eventIds: [event._id] });
        await ContestPOIModel.create({
            eventId: event._id,
            name: 'Griglia',
            hints: ['Tanto fumo'],
            groups: [],
            sequenceOrder: 1
        });
        await assignContestAdmin(user._id.toString(), event._id.toString());

        const res = await request(app)
            .get(`/api/contests/contest-pois?eventId=${event._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].standId).toBe(stand._id.toString());
        expect(res.body.items[0].poiId).toBeNull();
        expect(res.body.items[0].hints).toEqual(['Tanto fumo']);
    });

    it('creates a contest POI linked to an event POI and resolves its name', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        const eventPoi = await POIModel.create({
            eventId: event._id,
            name: 'Fontana Centrale',
            location: { type: 'Point', coordinates: [12.5, 41.9] }
        });
        await assignContestAdmin(user._id.toString(), event._id.toString());

        const res = await request(app)
            .post('/api/contests/contest-pois')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString(), poiId: eventPoi._id.toString(), hints: ['Cerca l\'acqua'] });

        expect(res.status).toBe(201);
        expect(res.body.item.poiId).toBe(eventPoi._id.toString());
        expect(res.body.item.standId).toBeNull();
        expect(res.body.item.name).toBe('Fontana Centrale');
    });

    it('rejects a POI not belonging to the event and dual stand+POI links', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        const otherEvent = await createEvent();
        const eventPoi = await POIModel.create({
            eventId: otherEvent._id,
            name: 'Altrove',
            location: { type: 'Point', coordinates: [12.5, 41.9] }
        });
        const stand = await StandModel.create({ name: 'Pizzeria', eventIds: [event._id] });
        await assignContestAdmin(user._id.toString(), event._id.toString());

        const notInEvent = await request(app)
            .post('/api/contests/contest-pois')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString(), poiId: eventPoi._id.toString(), name: 'POI' });

        expect(notInEvent.status).toBe(400);
        expect(notInEvent.body.message).toBe('POI not found for this event');

        const both = await request(app)
            .post('/api/contests/contest-pois')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString(), standId: stand._id.toString(), poiId: eventPoi._id.toString(), name: 'Doppio' });

        expect(both.status).toBe(400);
        expect(both.body.message).toBe('Cannot link a contest POI to both a stand and a POI');
    });

    it('public getContest resolves the event POI name for poi-linked entries', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        const eventPoi = await POIModel.create({
            eventId: event._id,
            name: 'Palco Principale',
            location: { type: 'Point', coordinates: [12.5, 41.9] }
        });
        const poi = await ContestPOIModel.create({
            eventId: event._id,
            poiId: eventPoi._id,
            name: 'Vecchio Nome',
            hints: ['Sotto i riflettori'],
            groups: [],
            sequenceOrder: 1
        });
        const contest = await ContestModel.create({
            eventId: event._id,
            name: 'Caccia POI',
            durationMinutes: 30,
            requireSequence: false,
            prizes: [],
            isActive: true,
            orderedPOIIds: [poi._id],
            pickConfig: null,
            autoPickedPOIIds: [],
            poiHintSelections: [{ poiId: poi._id, hintIndex: 0 }]
        });
        await assignContestAdmin(user._id.toString(), event._id.toString());

        const res = await request(app)
            .get(`/api/contests/${contest._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.pois).toHaveLength(1);
        expect(res.body.pois[0].name).toBe('Palco Principale');
        expect(res.body.pois[0].standId).toBeNull();
        expect(res.body.pois[0].poiId).toBe(eventPoi._id.toString());
        expect(res.body.pois[0].hint).toBe('Sotto i riflettori');
    });

    it('poi-qrcodes for an event-POI linked contest POI uses the contest scan URL', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        const eventPoi = await POIModel.create({
            eventId: event._id,
            name: 'Fontana',
            location: { type: 'Point', coordinates: [12.5, 41.9] }
        });
        const poi = await ContestPOIModel.create({
            eventId: event._id,
            poiId: eventPoi._id,
            name: 'Fontana',
            hints: [],
            groups: [],
            sequenceOrder: 1
        });
        const contest = await ContestModel.create({
            eventId: event._id,
            name: 'QR POI',
            durationMinutes: 30,
            requireSequence: false,
            prizes: [],
            isActive: true,
            orderedPOIIds: [poi._id],
            pickConfig: null,
            autoPickedPOIIds: [],
            poiHintSelections: []
        });
        await assignContestAdmin(user._id.toString(), event._id.toString());

        const res = await request(app)
            .get(`/api/contests/${contest._id}/poi-qrcodes`)
            .set('Cookie', `sid=${sessionToken}`)
            .set('Origin', 'http://test.local');

        expect(res.status).toBe(200);
        const item = res.body.items[0];
        expect(item.poiId).toBe(poi._id.toString());
        expect(item.standId).toBeNull();
        expect(item.eventPoiId).toBe(eventPoi._id.toString());
        expect(item.poiName).toBe('Fontana');
    });
});
