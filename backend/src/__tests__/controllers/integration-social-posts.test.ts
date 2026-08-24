import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const metaState = vi.hoisted(() => ({
    accessToken: '',
    pageId: '',
    igUserId: ''
}));

vi.mock('@/config/env', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/config/env')>();
    return {
        ...actual,
        env: {
            ...actual.env,
            get META_PAGE_ACCESS_TOKEN() {
                return metaState.accessToken;
            },
            get META_PAGE_ID() {
                return metaState.pageId;
            },
            get META_IG_USER_ID() {
                return metaState.igUserId;
            }
        }
    };
});

import { EventModel } from '../../models/event.model';
import { EventPhotoModel } from '../../models/event-photo.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import { runSocialPublishQueueOnce } from '../../services/social-publish.service';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession(firstName: string) {
    const user = await UserModel.create({
        firstName,
        lastName: 'Social',
        email: `${firstName.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`,
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

    return { user, cookie: `sid=${sessionToken}` };
}

async function assignRole(userId: string, slug: string, eventId?: string) {
    const role = await RoleModel.create({
        name: `Role ${slug}`,
        slug,
        scope: eventId ? 'event' : 'platform',
        permissions: ['manage']
    });

    await UserRoleModel.create({
        userId,
        roleId: role._id,
        eventId,
        isActive: true
    });
}

async function createEvent(name = 'Sagra Social') {
    return EventModel.create({
        name,
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC'
    });
}

async function createImagePhoto(eventId: string, createdBy: string) {
    return EventPhotoModel.create({
        eventId,
        type: 'image',
        image: {
            url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
            publicId: 'demo/photo',
            width: 1080,
            height: 1080,
            format: 'jpg',
            bytes: 5000
        },
        sequenceNumber: 1,
        takenAt: new Date(),
        createdBy
    });
}

function jsonResponse(payload: unknown) {
    return {
        ok: true,
        status: 200,
        json: async () => payload
    };
}

function installGraphFetchMock() {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = input.toString();
        calls.push(url);

        if (url.includes('/page-123/photos')) {
            return jsonResponse({ post_id: 'fb-post-1', id: 'photo-node-1' });
        }
        if (url.includes('/ig-456/media?') || url.endsWith('/ig-456/media')) {
            return jsonResponse({ id: 'container-1' });
        }
        if (url.includes('container-1?fields=status_code')) {
            return jsonResponse({ status_code: 'FINISHED' });
        }
        if (url.includes('/ig-456/media_publish')) {
            return jsonResponse({ id: 'ig-post-1' });
        }
        if (url.includes('ig-post-1')) {
            return jsonResponse({ permalink: 'https://instagram.com/p/ig-post-1' });
        }
        if (url.includes('fb-post-1')) {
            return jsonResponse({ permalink_url: 'https://facebook.com/fb-post-1' });
        }

        throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);
    return { fetchMock, calls };
}

beforeEach(() => {
    metaState.accessToken = '';
    metaState.pageId = '';
    metaState.igUserId = '';
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('Integration: social publish endpoints', () => {
    it('requires authentication for config', async () => {
        app = createTestApp();
        const event = await createEvent();

        const res = await request(app).get(`/api/events/${event._id}/social/config`);

        expect(res.status).toBe(401);
    });

    it('forbids users without photo-admin role', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { user, cookie } = await createAuthSession('Plain');

        const resPost = await request(app)
            .post(`/api/events/${event._id}/social/posts`)
            .set('Cookie', cookie)
            .send({ photoIds: ['x'], platforms: ['facebook'] });
        expect(resPost.status).toBe(403);

        await assignRole(user._id.toString(), 'photo-admin', event._id.toString());

        const resOk = await request(app)
            .get(`/api/events/${event._id}/social/config`)
            .set('Cookie', cookie);
        expect(resOk.status).toBe(200);
        expect(resOk.body).toEqual({ facebook: false, instagram: false });
    });

    it('validates payloads', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { user, cookie } = await createAuthSession('Validator');
        await assignRole(user._id.toString(), 'photo-admin', event._id.toString());
        metaState.accessToken = 'token';
        metaState.pageId = 'page-123';

        const resEmpty = await request(app)
            .post(`/api/events/${event._id}/social/posts`)
            .set('Cookie', cookie)
            .send({ photoIds: [], platforms: ['facebook'] });
        expect(resEmpty.status).toBe(400);

        const resPlatform = await request(app)
            .post(`/api/events/${event._id}/social/posts`)
            .set('Cookie', cookie)
            .send({ photoIds: [event._id.toString()], platforms: ['twitter'] });
        expect(resPlatform.status).toBe(400);
    });

    it('rejects photos of another event and videos', async () => {
        app = createTestApp();
        const eventA = await createEvent('Evento A');
        const eventB = await createEvent('Evento B');
        const { user, cookie } = await createAuthSession('Foreign');
        await assignRole(user._id.toString(), 'photo-admin', eventA._id.toString());

        const foreignPhoto = await createImagePhoto(eventB._id.toString(), user._id.toString());

        const resForeign = await request(app)
            .post(`/api/events/${eventA._id}/social/posts`)
            .set('Cookie', cookie)
            .send({ photoIds: [foreignPhoto._id.toString()], platforms: ['facebook'] });
        expect(resForeign.status).toBe(404);

        await EventPhotoModel.create({
            eventId: eventA._id,
            type: 'video',
            video: {
                url: 'https://res.cloudinary.com/demo/video/upload/clip.mp4',
                publicId: 'demo/clip',
                width: 1920,
                height: 1080,
                format: 'mp4',
                bytes: 90000,
                duration: 5
            },
            sequenceNumber: 1,
            takenAt: new Date(),
            createdBy: user._id
        });

        const videoDoc = await EventPhotoModel.findOne({ eventId: eventA._id, type: 'video' });
        const resVideo = await request(app)
            .post(`/api/events/${eventA._id}/social/posts`)
            .set('Cookie', cookie)
            .send({ photoIds: [videoDoc!._id.toString()], platforms: ['facebook'] });
        expect(resVideo.status).toBe(400);
        expect(resVideo.body.message).toContain('solo per le foto');
    });

    it('creates pending posts and publishes them to Facebook and Instagram', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { user, cookie } = await createAuthSession('Publisher');
        await assignRole(user._id.toString(), 'photo-admin', event._id.toString());

        metaState.accessToken = 'secret-token';
        metaState.pageId = 'page-123';
        metaState.igUserId = 'ig-456';

        const photo = await createImagePhoto(event._id.toString(), user._id.toString());
        const { calls } = installGraphFetchMock();

        const res = await request(app)
            .post(`/api/events/${event._id}/social/posts`)
            .set('Cookie', cookie)
            .send({
                photoIds: [photo._id.toString()],
                platforms: ['facebook', 'instagram'],
                caption: 'Sagra della porchetta!'
            });

        expect(res.status).toBe(201);
        expect(res.body.items).toHaveLength(2);
        expect(res.body.items.map((i: { status: string }) => i.status)).toEqual(['pending', 'pending']);

        const processed = await runSocialPublishQueueOnce();
        expect(processed).toBe(2);

        const fbCall = calls.find((c) => c.includes('/page-123/photos'));
        expect(fbCall).toBeTruthy();

        const igContainerCall = calls.find((c) => c.includes('/ig-456/media'));
        expect(igContainerCall).toBeTruthy();
        const igPublishCall = calls.find((c) => c.includes('/ig-456/media_publish'));
        expect(igPublishCall).toBeTruthy();

        const listRes = await request(app)
            .get(`/api/events/${event._id}/social/posts`)
            .set('Cookie', cookie);

        expect(listRes.status).toBe(200);
        const byPlatform = new Map<string, { status: string; remotePostId: string | null; permalink: string | null; attempts: number }>(
            listRes.body.items.map((i: { platform: string }) => [i.platform, i])
        );

        const fb = byPlatform.get('facebook')!;
        expect(fb.status).toBe('published');
        expect(fb.remotePostId).toBe('fb-post-1');
        expect(fb.permalink).toBe('https://facebook.com/fb-post-1');

        const ig = byPlatform.get('instagram')!;
        expect(ig.status).toBe('published');
        expect(ig.remotePostId).toBe('ig-post-1');
        expect(ig.permalink).toBe('https://instagram.com/p/ig-post-1');
        expect(ig.attempts).toBe(1);
    });

    it('marks posts failed immediately when platform is not configured', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { user, cookie } = await createAuthSession('NoConfig');
        await assignRole(user._id.toString(), 'photo-admin', event._id.toString());

        const photo = await createImagePhoto(event._id.toString(), user._id.toString());

        const res = await request(app)
            .post(`/api/events/${event._id}/social/posts`)
            .set('Cookie', cookie)
            .send({ photoIds: [photo._id.toString()], platforms: ['facebook', 'instagram'] });

        expect(res.status).toBe(201);
        const statuses = res.body.items.map((i: { status: string; lastError: string | null }) => ({
            status: i.status,
            lastError: i.lastError
        }));

        expect(statuses).toHaveLength(2);
        statuses.forEach((s: { status: string; lastError: string | null }) => {
            expect(s.status).toBe('failed');
            expect(s.lastError).toContain('non configurata');
        });

        const processed = await runSocialPublishQueueOnce();
        expect(processed).toBe(0);
    });
});
