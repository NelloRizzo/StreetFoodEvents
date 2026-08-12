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
        lastName: 'Tester',
        email: `contest-${Date.now()}@test.com`,
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
        name: `Contest Event ${Date.now()}`,
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC'
    });
}

describe('Integration: contest POI linked to stand', () => {
    it('creates a contest POI linked to a stand and returns standId', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        const stand = await StandModel.create({ name: 'Pizzeria Test', eventIds: [event._id] });
        await assignContestAdmin(user._id.toString(), event._id.toString());

        const res = await request(app)
            .post('/api/contests/contest-pois')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString(), standId: stand._id.toString(), hints: ['Dove si mangia la pizza?'] });

        expect(res.status).toBe(201);
        expect(res.body.item.standId).toBe(stand._id.toString());
        expect(res.body.item.name).toBe('Pizzeria Test');
    });

    it('rejects a stand not belonging to the event', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        const otherEvent = await createEvent();
        const stand = await StandModel.create({ name: 'Altro Stand', eventIds: [otherEvent._id] });
        await assignContestAdmin(user._id.toString(), event._id.toString());

        const res = await request(app)
            .post('/api/contests/contest-pois')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString(), standId: stand._id.toString(), name: 'POI' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Stand not found for this event');
    });

    it('updates standId and clears it to null', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        const stand = await StandModel.create({ name: 'Griglia', eventIds: [event._id] });
        const poi = await ContestPOIModel.create({
            eventId: event._id,
            name: 'POI Libero',
            hints: [],
            groups: [],
            sequenceOrder: 1
        });
        await assignContestAdmin(user._id.toString(), event._id.toString());

        const setRes = await request(app)
            .patch(`/api/contests/contest-pois/${poi._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ standId: stand._id.toString() });

        expect(setRes.status).toBe(200);
        expect(setRes.body.item.standId).toBe(stand._id.toString());
        expect(setRes.body.item.name).toBe('Griglia');

        const clearRes = await request(app)
            .patch(`/api/contests/contest-pois/${poi._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ standId: null });

        expect(clearRes.status).toBe(200);
        expect(clearRes.body.item.standId).toBeNull();
    });

    it('public getContest resolves the stand name for linked POIs', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        const stand = await StandModel.create({ name: 'Paninoteca', eventIds: [event._id] });
        const poi = await ContestPOIModel.create({
            eventId: event._id,
            standId: stand._id,
            name: 'Vecchio Nome',
            hints: ['Indizio segreto'],
            groups: [],
            sequenceOrder: 1
        });
        const contest = await ContestModel.create({
            eventId: event._id,
            name: 'Caccia 1',
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
        expect(res.body.pois[0].name).toBe('Paninoteca');
        expect(res.body.pois[0].standId).toBe(stand._id.toString());
        expect(res.body.pois[0].hint).toBe('Indizio segreto');
    });

    it('creates a free POI without standId', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        await assignContestAdmin(user._id.toString(), event._id.toString());

        const res = await request(app)
            .post('/api/contests/contest-pois')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ eventId: event._id.toString(), name: 'Fontana' });

        expect(res.status).toBe(201);
        expect(res.body.item.standId).toBeNull();
        expect(res.body.item.name).toBe('Fontana');
    });

    it('poi-qrcodes: linked POI uses the stand event QR, free POI uses the contest scan URL', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();

        const event = await createEvent();
        const stand = await StandModel.create({ name: 'Fritti', eventIds: [event._id] });
        const linkedPoi = await ContestPOIModel.create({
            eventId: event._id,
            standId: stand._id,
            name: 'Fritti',
            hints: ['Un tuffo nel fritto'],
            groups: [],
            sequenceOrder: 1
        });
        const freePoi = await ContestPOIModel.create({
            eventId: event._id,
            standId: null,
            name: 'Fontana',
            hints: [],
            groups: [],
            sequenceOrder: 2
        });
        const contest = await ContestModel.create({
            eventId: event._id,
            name: 'QR Contest',
            durationMinutes: 30,
            requireSequence: false,
            prizes: [],
            isActive: true,
            orderedPOIIds: [linkedPoi._id, freePoi._id],
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
        const linked = res.body.items.find((i: { poiId: string }) => i.poiId === linkedPoi._id.toString());
        const free = res.body.items.find((i: { poiId: string }) => i.poiId === freePoi._id.toString());
        expect(linked).toBeTruthy();
        expect(free).toBeTruthy();
        expect(linked.standId).toBe(stand._id.toString());
        expect(free.standId).toBeNull();
        expect(linked.poiName).toBe('Fritti');

        const standQr = await request(app)
            .get(`/api/stands/${stand._id}/qrcode?eventId=${event._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .set('Origin', 'http://test.local');

        expect(standQr.status).toBe(200);
        expect(linked.qrCode).toBe(standQr.body.qrCode);
        expect(free.qrCode).not.toBe(standQr.body.qrCode);
    });
});
