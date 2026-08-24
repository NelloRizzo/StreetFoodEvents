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
const deleteVideoMock = vi.fn().mockResolvedValue(undefined);
const uploadImageBufferMock = vi.fn().mockResolvedValue({
    url: 'https://cloudinary.test/image.jpg',
    publicId: 'img-1',
    width: 800,
    height: 600,
    format: 'jpg',
    bytes: 1234
});
const uploadVideoBufferMock = vi.fn().mockResolvedValue({
    url: 'https://cloudinary.test/clip.mp4',
    publicId: 'vid-1',
    width: 1920,
    height: 1080,
    format: 'mp4',
    bytes: 98765,
    duration: 12.5
});

vi.mock('@/services/cloudinary-upload.service', () => ({
    deleteImage: (...args: unknown[]) => deleteImageMock(...args),
    deleteVideo: (...args: unknown[]) => deleteVideoMock(...args),
    deleteMedia: vi.fn().mockResolvedValue(undefined),
    deleteImages: vi.fn().mockResolvedValue(undefined),
    uploadImageBuffer: (...args: unknown[]) => uploadImageBufferMock(...args),
    uploadVideoBuffer: (...args: unknown[]) => uploadVideoBufferMock(...args)
}));

const sendPhotoEmailMock = vi.fn().mockResolvedValue(undefined);
const sendPhotosEmailMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/email.service', () => ({
    isEmailConfigured: () => true,
    sendPhotoEmail: (...args: unknown[]) => sendPhotoEmailMock(...args),
    sendPhotosEmail: (...args: unknown[]) => sendPhotosEmailMock(...args)
}));

import { Types } from 'mongoose';

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
        firstName: 'Photo',
        lastName: 'Tester',
        email: `photo-${Date.now()}@test.com`,
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

async function createEvent() {
    return EventModel.create({
        name: 'Photo Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC'
    });
}

describe('Integration: event photos with videos', () => {
    beforeEach(() => {
        deleteImageMock.mockClear();
        deleteVideoMock.mockClear();
        uploadImageBufferMock.mockClear();
        uploadVideoBufferMock.mockClear();
    });

    it('lists photos (empty, public)', async () => {
        app = createTestApp();
        const event = await createEvent();

        const res = await request(app).get(`/api/events/${event._id}/photos`);
        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('requires authentication to upload', async () => {
        app = createTestApp();
        const event = await createEvent();

        const res = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .attach('video', Buffer.from('fake-video'), { filename: 'clip.mp4', contentType: 'video/mp4' });

        expect(res.status).toBe(401);
    });

    it('allows anonymous image upload with null createdBy', async () => {
        app = createTestApp();
        const event = await createEvent();

        const res = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .attach('image', Buffer.from('fake-image'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(201);
        expect(res.body.item.type).toBe('image');
        expect(res.body.item.createdBy).toBeNull();
        expect(uploadImageBufferMock).toHaveBeenCalledTimes(1);

        const list = await request(app).get(`/api/events/${event._id}/photos`);
        expect(list.status).toBe(200);
        expect(list.body.items).toHaveLength(1);
        expect(list.body.items[0].createdBy).toBeNull();
    });

    it('sets and clears defaultFrameId on the event via PATCH and exposes it publicly', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { sessionToken } = await createAuthSession();

        const initial = await request(app).get(`/api/events/${event._id}`);
        expect(initial.status).toBe(200);
        expect(initial.body.item.defaultFrameId).toBeNull();

        const frameId = new Types.ObjectId().toString();
        const patched = await request(app)
            .patch(`/api/events/${event._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ defaultFrameId: frameId });
        expect(patched.status).toBe(200);
        expect(patched.body.item.defaultFrameId).toBe(frameId);

        const fetched = await request(app).get(`/api/events/${event._id}`);
        expect(fetched.status).toBe(200);
        expect(fetched.body.item.defaultFrameId).toBe(frameId);

        const cleared = await request(app)
            .patch(`/api/events/${event._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ defaultFrameId: null });
        expect(cleared.status).toBe(200);
        expect(cleared.body.item.defaultFrameId).toBeNull();

        const invalid = await request(app)
            .patch(`/api/events/${event._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ defaultFrameId: 'not-an-id' });
        expect(invalid.status).toBe(200);
        expect(invalid.body.item.defaultFrameId).toBeNull();
    });

    it('returns 400 when no file is provided', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('Image or video file is required');
    });

    it('uploads a video and exposes it with type video', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`)
            .attach('video', Buffer.from('fake-video'), { filename: 'clip.mp4', contentType: 'video/mp4' });

        expect(res.status).toBe(201);
        expect(uploadVideoBufferMock).toHaveBeenCalledTimes(1);
        expect(res.body.item.type).toBe('video');
        expect(res.body.item.video).toMatchObject({ publicId: 'vid-1', duration: 12.5 });
        expect(res.body.item.image).toBeNull();
        expect(res.body.item.sequenceNumber).toBe(1);

        const list = await request(app).get(`/api/events/${event._id}/photos`);
        expect(list.status).toBe(200);
        expect(list.body.items).toHaveLength(1);
        expect(list.body.items[0].type).toBe('video');
    });

    it('uploads an image (backward compatible, no video field)', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`)
            .attach('image', Buffer.from('fake-image'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(201);
        expect(uploadImageBufferMock).toHaveBeenCalledTimes(1);
        expect(res.body.item.type).toBe('image');
        expect(res.body.item.image).toMatchObject({ publicId: 'img-1' });
        expect(res.body.item.video).toBeNull();
    });

    it('assigns increasing sequence numbers across image and video', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { sessionToken } = await createAuthSession();

        await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`)
            .attach('image', Buffer.from('fake-image'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

        const res = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`)
            .attach('video', Buffer.from('fake-video'), { filename: 'clip.mp4', contentType: 'video/mp4' });

        expect(res.status).toBe(201);
        expect(res.body.item.sequenceNumber).toBe(2);
    });

    it('deletes a single video using video resource type', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { sessionToken } = await createAuthSession();

        const created = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`)
            .attach('video', Buffer.from('fake-video'), { filename: 'clip.mp4', contentType: 'video/mp4' });

        const photoId = created.body.item.id;

        const res = await request(app)
            .delete(`/api/events/${event._id}/photos/${photoId}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);
        expect(deleteVideoMock).toHaveBeenCalledTimes(1);
        expect(deleteVideoMock).toHaveBeenCalledWith('vid-1');

        const list = await request(app).get(`/api/events/${event._id}/photos`);
        expect(list.body.items).toHaveLength(0);
    });

    it('deletes all photos using the correct resource type per item', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'photo-admin', 'event', event._id.toString());

        const created = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`)
            .attach('video', Buffer.from('fake-video'), { filename: 'clip.mp4', contentType: 'video/mp4' });

        expect(created.status).toBe(201);
        const { sessionToken: sessionToken2 } = await createAuthSession();
        await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken2}`)
            .attach('image', Buffer.from('fake-image'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

        deleteImageMock.mockClear();
        deleteVideoMock.mockClear();

        const res = await request(app)
            .delete(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);
        expect(deleteVideoMock).toHaveBeenCalledTimes(1);
        expect(deleteVideoMock).toHaveBeenCalledWith('vid-1');
        expect(deleteImageMock).toHaveBeenCalledTimes(1);
        expect(deleteImageMock).toHaveBeenCalledWith('img-1');

        const list = await request(app).get(`/api/events/${event._id}/photos`);
        expect(list.body.items).toHaveLength(0);
    });

    it('rejects email sending for videos', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'photo-print', 'event', event._id.toString());

        const created = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`)
            .attach('video', Buffer.from('fake-video'), { filename: 'clip.mp4', contentType: 'video/mp4' });

        const res = await request(app)
            .post(`/api/events/${event._id}/photos/${created.body.item.id}/send-email`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ email: 'test@test.com' });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('email');
    });

    it('sends all selected photos to a single email address', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'photo-print', 'event', event._id.toString());

        const first = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`)
            .attach('image', Buffer.from('fake-image'), { filename: 'photo.jpg', contentType: 'image/jpeg' });
        const second = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`)
            .attach('image', Buffer.from('fake-image'), { filename: 'photo2.jpg', contentType: 'image/jpeg' });

        sendPhotosEmailMock.mockClear();
        const res = await request(app)
            .post(`/api/events/${event._id}/photos/send-email`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                email: 'customer@test.com',
                photoIds: [first.body.item.id, second.body.item.id],
                marketingConsent: true
            });

        expect(res.status).toBe(200);
        expect(sendPhotosEmailMock).toHaveBeenCalledTimes(1);
        expect(sendPhotosEmailMock).toHaveBeenCalledWith(
            'customer@test.com',
            ['https://cloudinary.test/image.jpg', 'https://cloudinary.test/image.jpg'],
            'Photo Event',
            'Loc'
        );
    });

    it('rejects bulk email when a video is among the selected photos', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'photo-print', 'event', event._id.toString());

        const image = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`)
            .attach('image', Buffer.from('fake-image'), { filename: 'photo.jpg', contentType: 'image/jpeg' });
        const video = await request(app)
            .post(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`)
            .attach('video', Buffer.from('fake-video'), { filename: 'clip.mp4', contentType: 'video/mp4' });

        sendPhotosEmailMock.mockClear();
        const res = await request(app)
            .post(`/api/events/${event._id}/photos/send-email`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                email: 'customer@test.com',
                photoIds: [image.body.item.id, video.body.item.id]
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('solo per le foto');
        expect(sendPhotosEmailMock).not.toHaveBeenCalled();
    });

    it('rejects bulk email with invalid photo ids', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'photo-print', 'event', event._id.toString());

        const res = await request(app)
            .post(`/api/events/${event._id}/photos/send-email`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ email: 'customer@test.com', photoIds: [] });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('photo ids');
    });
});
