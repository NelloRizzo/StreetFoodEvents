import * as argon2 from 'argon2';
import type { Express } from 'express';
import { Types } from 'mongoose';
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
    deleteVideo: vi.fn().mockResolvedValue(undefined),
    deleteMedia: vi.fn().mockResolvedValue(undefined),
    deleteImages: vi.fn().mockResolvedValue(undefined),
    uploadImageBuffer: vi.fn(),
    uploadVideoBuffer: vi.fn()
}));

import { EventModel } from '../../models/event.model';
import { EventPhotoModel } from '../../models/event-photo.model';
import { PhotoContestModel } from '../../models/photo-contest.model';
import { PhotoContestVoteModel } from '../../models/photo-contest-vote.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { hashDeviceId } from '../../utils/device-hash';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession() {
    const user = await UserModel.create({
        firstName: 'Contest',
        lastName: 'Tester',
        email: `contest-${Date.now()}-${Math.random()}@test.com`,
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

async function assignRole(userId: string, slug: string, scope: 'event' | 'platform' = 'event', eventId?: string) {
    const role = await RoleModel.create({
        name: `Role ${slug}`,
        slug,
        scope,
        permissions: ['manage']
    });

    await UserRoleModel.create({
        userId,
        roleId: role._id,
        eventId: eventId ?? undefined,
        isActive: true
    });
}

async function createEvent(name = 'Contest Event') {
    return EventModel.create({
        name,
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC'
    });
}

async function createPhoto(eventId: Types.ObjectId | string, sequenceNumber: number) {
    return EventPhotoModel.create({
        eventId,
        type: 'image',
        image: {
            url: `https://cloudinary.test/photo-${sequenceNumber}.jpg`,
            publicId: `photo-${sequenceNumber}`,
            width: 800,
            height: 600,
            format: 'jpg',
            bytes: 1234
        },
        sequenceNumber,
        takenAt: new Date()
    });
}

async function createContest(
    eventId: Types.ObjectId | string,
    overrides: Record<string, unknown> = {}
) {
    return PhotoContestModel.create({
        eventId,
        title: 'Contest',
        status: 'open',
        votingEnabled: true,
        showVotesCount: false,
        ...overrides
    });
}

async function vote(contestId: Types.ObjectId | string, photoId: Types.ObjectId | string, device: string) {
    return PhotoContestVoteModel.create({
        contestId,
        photoId,
        deviceIdHash: hashDeviceId(device)
    });
}

describe('Integration: classifica del contest fotografico (pannello Info)', () => {
    it('espone la classifica con i conteggi anche con showVotesCount spento', async () => {
        app = createTestApp();
        const event = await createEvent();
        const first = await createPhoto(event._id, 1);
        const second = await createPhoto(event._id, 2);
        const contest = await createContest(event._id, { showVotesCount: false });

        await vote(contest._id, second._id, 'a');
        await vote(contest._id, second._id, 'b');
        await vote(contest._id, first._id, 'c');

        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'photo-admin', 'event', event._id.toString());

        const res = await request(app)
            .get(`/api/events/${event._id}/photo-contests/${contest._id}/results`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.isOpen).toBe(true);
        expect(res.body.totalVotes).toBe(3);
        expect(res.body.ranking).toEqual([
            {
                photoId: second._id.toString(),
                sequenceNumber: 2,
                imageUrl: 'https://cloudinary.test/photo-2.jpg',
                voteCount: 2,
                rank: 1
            },
            {
                photoId: first._id.toString(),
                sequenceNumber: 1,
                imageUrl: 'https://cloudinary.test/photo-1.jpg',
                voteCount: 1,
                rank: 2
            }
        ]);
    });

    it('mette gli ex aequo sullo stesso gradino, ordinati per numero di scatto', async () => {
        app = createTestApp();
        const event = await createEvent();
        const first = await createPhoto(event._id, 1);
        const second = await createPhoto(event._id, 2);
        const third = await createPhoto(event._id, 3);
        const contest = await createContest(event._id);

        await vote(contest._id, third._id, 'f');
        await vote(contest._id, first._id, 'd');
        await vote(contest._id, second._id, 'a');
        await vote(contest._id, second._id, 'b');
        await vote(contest._id, first._id, 'e');
        await vote(contest._id, second._id, 'c');

        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'photo-admin', 'event', event._id.toString());

        const res = await request(app)
            .get(`/api/events/${event._id}/photo-contests/${contest._id}/results`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.ranking.map((row: { sequenceNumber: number; voteCount: number; rank: number }) => [
            row.sequenceNumber,
            row.voteCount,
            row.rank
        ])).toEqual([
            [2, 3, 1],
            [1, 2, 2],
            [3, 1, 3]
        ]);
    });

    it('esclude dalla classifica le foto senza voti', async () => {
        app = createTestApp();
        const event = await createEvent();
        const voted = await createPhoto(event._id, 1);
        await createPhoto(event._id, 2);
        const contest = await createContest(event._id);
        await vote(contest._id, voted._id, 'a');

        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'platform-admin', 'platform');

        const res = await request(app)
            .get(`/api/events/${event._id}/photo-contests/${contest._id}/results`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.ranking).toHaveLength(1);
        expect(res.body.ranking[0].photoId).toBe(voted._id.toString());
    });

    it('riporta isOpen a false quando il contest è chiuso', async () => {
        app = createTestApp();
        const event = await createEvent();
        const photo = await createPhoto(event._id, 1);
        const contest = await createContest(event._id, { status: 'closed', votingEnabled: false });
        await vote(contest._id, photo._id, 'a');

        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'photo-admin', 'event', event._id.toString());

        const res = await request(app)
            .get(`/api/events/${event._id}/photo-contests/${contest._id}/results`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.isOpen).toBe(false);
        expect(res.body.ranking).toHaveLength(1);
    });

    it('richiede autenticazione e un ruolo di gestione dell\'evento', async () => {
        app = createTestApp();
        const event = await createEvent();
        const otherEvent = await createEvent('Other Event');
        const contest = await createContest(event._id);

        const anonymous = await request(app).get(
            `/api/events/${event._id}/photo-contests/${contest._id}/results`
        );
        expect(anonymous.status).toBe(401);

        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'photo-admin', 'event', otherEvent._id.toString());

        const forbidden = await request(app)
            .get(`/api/events/${event._id}/photo-contests/${contest._id}/results`)
            .set('Cookie', `sid=${sessionToken}`);
        expect(forbidden.status).toBe(403);
    });

    it('risponde 404 per un contest di un altro evento', async () => {
        app = createTestApp();
        const event = await createEvent();
        const otherEvent = await createEvent('Other Event');
        const contest = await createContest(otherEvent._id);

        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'platform-admin', 'platform');

        const res = await request(app)
            .get(`/api/events/${event._id}/photo-contests/${contest._id}/results`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(404);
    });

    it('il dettaglio pubblico continua a nascondere i voti con showVotesCount spento', async () => {
        app = createTestApp();
        const event = await createEvent();
        const photo = await createPhoto(event._id, 1);
        const contest = await createContest(event._id, { showVotesCount: false });
        await vote(contest._id, photo._id, 'a');

        const res = await request(app).get(`/api/events/${event._id}/photo-contests/${contest._id}`);

        expect(res.status).toBe(200);
        /* il conteggio non deve esistere nella risposta pubblica: la classifica
           completa passa solo dalla rotta admin */
        expect(res.body.items[0].voteCount).toBeUndefined();
        expect(res.body.items[0].rank).toBe(1);
    });
});
