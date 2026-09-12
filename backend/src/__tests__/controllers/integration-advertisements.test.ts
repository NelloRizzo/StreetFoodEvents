import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/cloudinary', () => ({
    cloudinary: {
        upload: { stream: vi.fn() },
        api: { delete_resources: vi.fn() }
    }
}));

const deleteImageMock = vi.fn().mockResolvedValue(undefined);
const uploadImageBufferMock = vi.fn().mockResolvedValue({
    url: 'https://cloudinary.test/ad.jpg',
    publicId: 'ad-1',
    width: 800,
    height: 1200,
    format: 'jpg',
    bytes: 1234
});

vi.mock('@/services/cloudinary-upload.service', () => ({
    deleteImage: (...args: unknown[]) => deleteImageMock(...args),
    deleteMedia: vi.fn().mockResolvedValue(undefined),
    deleteImages: vi.fn().mockResolvedValue(undefined),
    uploadImageBuffer: (...args: unknown[]) => uploadImageBufferMock(...args)
}));

import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import { AdvertisementModel } from '../../models/advertisement.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession() {
    const user = await UserModel.create({
        firstName: 'Ad',
        lastName: 'Tester',
        email: `ad-${Date.now()}@test.com`,
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

async function assignPlatformAdmin(userId: string) {
    const role = await RoleModel.create({
        name: 'Platform Admin',
        slug: 'platform-admin',
        scope: 'platform',
        permissions: ['manage']
    });

    await UserRoleModel.create({
        userId,
        roleId: role._id,
        isActive: true
    });
}

async function createAdvertisement(enabled = true, weight = 1) {
    return AdvertisementModel.create({
        name: 'Pubblicità',
        image: {
            url: 'https://cloudinary.test/ad.jpg',
            publicId: 'ad-1',
            width: 800,
            height: 1200,
            format: 'jpg',
            bytes: 1234
        },
        enabled,
        weight
    });
}

describe('Integration: advertisements', () => {
    beforeEach(() => {
        deleteImageMock.mockClear();
        uploadImageBufferMock.mockClear();
    });

    it('lists only enabled advertisements publicly', async () => {
        app = createTestApp();
        const enabled = await createAdvertisement(true);
        await createAdvertisement(false);

        const res = await request(app).get('/api/advertisements');
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].id).toBe(enabled._id.toString());
        expect(res.body.items[0].enabled).toBe(true);
        expect(res.body.items[0].weight).toBe(1);
    });

    it('requires authentication for manage list', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/advertisements/manage');
        expect(res.status).toBe(401);
    });

    it('lists all advertisements for platform admin manage', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const adminSession = await createAuthSession();
        await assignPlatformAdmin(adminSession.user._id.toString());

        await createAdvertisement(false);

        const unauthorized = await request(app)
            .get('/api/advertisements/manage')
            .set('Cookie', `sid=${sessionToken}`);
        expect(unauthorized.status).toBe(403);

        const res = await request(app)
            .get('/api/advertisements/manage')
            .set('Cookie', `sid=${adminSession.sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].enabled).toBe(false);
    });

    it('requires authentication to create', async () => {
        app = createTestApp();
        const res = await request(app)
            .post('/api/advertisements')
            .attach('image', Buffer.from('fake-image'), { filename: 'ad.jpg', contentType: 'image/jpeg' });
        expect(res.status).toBe(401);
    });

    it('creates an advertisement as platform admin', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();
        await assignPlatformAdmin(user._id.toString());

        const res = await request(app)
            .post('/api/advertisements')
            .set('Cookie', `sid=${sessionToken}`)
            .field('name', 'Sponsor test')
            .attach('image', Buffer.from('fake-image'), { filename: 'ad.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(201);
        expect(uploadImageBufferMock).toHaveBeenCalledTimes(1);
        expect(res.body.item.enabled).toBe(true);
        expect(res.body.item.name).toBe('Sponsor test');
        expect(res.body.item.weight).toBe(1);

        const list = await request(app).get('/api/advertisements');
        expect(list.body.items).toHaveLength(1);
    });

    it('creates an advertisement with a custom weight', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();
        await assignPlatformAdmin(user._id.toString());

        const res = await request(app)
            .post('/api/advertisements')
            .set('Cookie', `sid=${sessionToken}`)
            .field('name', 'Sponsor fortissimo')
            .field('weight', '5')
            .attach('image', Buffer.from('fake-image'), { filename: 'ad.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(201);
        expect(res.body.item.weight).toBe(5);
    });

    it('rejects invalid weight on create and defaults to 1', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();
        await assignPlatformAdmin(user._id.toString());

        const res = await request(app)
            .post('/api/advertisements')
            .set('Cookie', `sid=${sessionToken}`)
            .field('weight', '0')
            .attach('image', Buffer.from('fake-image'), { filename: 'ad.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(201);
        expect(res.body.item.weight).toBe(1);
    });

    it('toggles enabled via PATCH', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();
        await assignPlatformAdmin(user._id.toString());
        const item = await createAdvertisement(true);

        const res = await request(app)
            .patch(`/api/advertisements/${item._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ enabled: false });

        expect(res.status).toBe(200);
        expect(res.body.item.enabled).toBe(false);

        const list = await request(app).get('/api/advertisements');
        expect(list.body.items).toHaveLength(0);
    });

    it('updates weight via PATCH', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();
        await assignPlatformAdmin(user._id.toString());
        const item = await createAdvertisement(true, 1);

        const res = await request(app)
            .patch(`/api/advertisements/${item._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ weight: 3 });

        expect(res.status).toBe(200);
        expect(res.body.item.weight).toBe(3);
    });

    it('registers an appearance publicly (no auth) and increments the counter', async () => {
        app = createTestApp();
        const item = await createAdvertisement(true);

        const res = await request(app)
            .post(`/api/advertisements/${item._id}/appearance`);
        expect(res.status).toBe(204);

        const fresh = await AdvertisementModel.findById(item._id);
        expect(fresh!.appearances).toBe(1);

        await request(app).post(`/api/advertisements/${item._id}/appearance`);
        const fresh2 = await AdvertisementModel.findById(item._id);
        expect(fresh2!.appearances).toBe(2);
    });

    it('returns 400/404 for appearance on invalid or unknown ids', async () => {
        app = createTestApp();

        const invalid = await request(app)
            .post('/api/advertisements/not-an-id/appearance');
        expect(invalid.status).toBe(400);

        const missing = await request(app)
            .post('/api/advertisements/507f1f77bcf86cd799439011/appearance');
        expect(missing.status).toBe(404);
    });

    it('resets all appearance counters as platform admin', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();
        await assignPlatformAdmin(user._id.toString());
        const item = await createAdvertisement(true);
        await request(app).post(`/api/advertisements/${item._id}/appearance`);
        await request(app).post(`/api/advertisements/${item._id}/appearance`);

        const res = await request(app)
            .post('/api/advertisements/reset-appearances')
            .set('Cookie', `sid=${sessionToken}`);
        expect(res.status).toBe(200);

        const fresh = await AdvertisementModel.findById(item._id);
        expect(fresh!.appearances).toBe(0);
    });

    it('requires auth to reset appearance counters', async () => {
        app = createTestApp();
        const res = await request(app)
            .post('/api/advertisements/reset-appearances');
        expect(res.status).toBe(401);
    });

    it('deletes an advertisement and removes the cloudinary asset', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();
        await assignPlatformAdmin(user._id.toString());
        const item = await createAdvertisement(true);

        const res = await request(app)
            .delete(`/api/advertisements/${item._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);
        expect(deleteImageMock).toHaveBeenCalledTimes(1);
        expect(deleteImageMock).toHaveBeenCalledWith('ad-1');

        const list = await request(app).get('/api/advertisements');
        expect(list.body.items).toHaveLength(0);
    });

    it('returns 400/404 for unknown or invalid ids', async () => {
        app = createTestApp();
        const { user, sessionToken } = await createAuthSession();
        await assignPlatformAdmin(user._id.toString());

        const invalid = await request(app)
            .delete('/api/advertisements/not-an-id')
            .set('Cookie', `sid=${sessionToken}`);
        expect(invalid.status).toBe(400);

        const missing = await request(app)
            .delete('/api/advertisements/507f1f77bcf86cd799439011')
            .set('Cookie', `sid=${sessionToken}`);
        expect(missing.status).toBe(404);
    });
});