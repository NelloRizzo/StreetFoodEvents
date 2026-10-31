import * as argon2 from 'argon2';
import type { Express } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { EventPhotoLikeModel } from '../../models/event-photo-like.model';
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
        firstName: 'Like',
        lastName: 'Tester',
        email: `like-${Date.now()}-${Math.random()}@test.com`,
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

async function createEvent(name = 'Like Event') {
    return EventModel.create({
        name,
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC'
    });
}

async function createPhoto(eventId: Types.ObjectId | string, sequenceNumber: number, type: 'image' | 'video' = 'image') {
    return EventPhotoModel.create({
        eventId,
        type,
        image:
            type === 'image'
                ? {
                      url: `https://cloudinary.test/photo-${sequenceNumber}.jpg`,
                      publicId: `photo-${sequenceNumber}`,
                      width: 800,
                      height: 600,
                      format: 'jpg',
                      bytes: 1234
                  }
                : null,
        video:
            type === 'video'
                ? {
                      url: `https://cloudinary.test/clip-${sequenceNumber}.mp4`,
                      publicId: `clip-${sequenceNumber}`,
                      width: 1920,
                      height: 1080,
                      format: 'mp4',
                      bytes: 98765,
                      duration: 12.5
                  }
                : null,
        sequenceNumber,
        takenAt: new Date()
    });
}

describe('Integration: «mi piace» della galleria', () => {
    beforeEach(() => {
        app = createTestApp();
    });

    it('mette e toglie il «mi piace» con lo stesso dispositivo (toggle)', async () => {
        const event = await createEvent();
        const photo = await createPhoto(event._id, 1);

        const first = await request(app)
            .post(`/api/events/${event._id}/photos/${photo._id}/like`)
            .send({ deviceId: 'device-a' });

        expect(first.status).toBe(200);
        expect(first.body).toEqual({ liked: true, likeCount: 1 });
        expect(await EventPhotoLikeModel.countDocuments({ photoId: photo._id })).toBe(1);

        const second = await request(app)
            .post(`/api/events/${event._id}/photos/${photo._id}/like`)
            .send({ deviceId: 'device-a' });

        expect(second.status).toBe(200);
        expect(second.body).toEqual({ liked: false, likeCount: 0 });
        expect(await EventPhotoLikeModel.countDocuments({ photoId: photo._id })).toBe(0);
    });

    it('lo stesso dispositivo può mettere «mi piace» a più foto, una sola volta ciascuna', async () => {
        const event = await createEvent();
        const first = await createPhoto(event._id, 1);
        const second = await createPhoto(event._id, 2);

        await request(app)
            .post(`/api/events/${event._id}/photos/${first._id}/like`)
            .send({ deviceId: 'device-a' })
            .expect(200);
        const other = await request(app)
            .post(`/api/events/${event._id}/photos/${second._id}/like`)
            .send({ deviceId: 'device-a' });

        expect(other.status).toBe(200);
        expect(other.body).toEqual({ liked: true, likeCount: 1 });
        expect(await EventPhotoLikeModel.countDocuments({ eventId: event._id })).toBe(2);
    });

    it('due dispositivi sulla stessa foto contano due «mi piace»', async () => {
        const event = await createEvent();
        const photo = await createPhoto(event._id, 1);

        await request(app)
            .post(`/api/events/${event._id}/photos/${photo._id}/like`)
            .send({ deviceId: 'device-a' })
            .expect(200);
        const second = await request(app)
            .post(`/api/events/${event._id}/photos/${photo._id}/like`)
            .send({ deviceId: 'device-b' });

        expect(second.status).toBe(200);
        expect(second.body).toEqual({ liked: true, likeCount: 2 });
    });

    it('la lista espone conteggio, gradino ed ex aequo, e il "mio" like per dispositivo', async () => {
        const event = await createEvent();
        const first = await createPhoto(event._id, 1);
        const second = await createPhoto(event._id, 2);
        const third = await createPhoto(event._id, 3);
        const fourth = await createPhoto(event._id, 4);
        const unliked = await createPhoto(event._id, 5);

        // primo: 3 like, secondo: 2, terzo e quarto: 1 (ex aequo sul terzo gradino)
        for (const device of ['a', 'b', 'c']) {
            await EventPhotoLikeModel.create({
                eventId: event._id,
                photoId: first._id,
                deviceIdHash: hashDeviceId(device)
            });
        }
        for (const device of ['a', 'b']) {
            await EventPhotoLikeModel.create({
                eventId: event._id,
                photoId: second._id,
                deviceIdHash: hashDeviceId(device)
            });
        }
        await EventPhotoLikeModel.create({ eventId: event._id, photoId: third._id, deviceIdHash: hashDeviceId('a') });
        await EventPhotoLikeModel.create({ eventId: event._id, photoId: fourth._id, deviceIdHash: hashDeviceId('a') });

        const res = await request(app).get(`/api/events/${event._id}/photos`).query({ deviceId: 'a' });

        expect(res.status).toBe(200);
        const byId = new Map(res.body.items.map((item: { id: string }) => [item.id, item]));

        expect(byId.get(first._id.toString())).toMatchObject({ likeCount: 3, rank: 1, liked: true });
        expect(byId.get(second._id.toString())).toMatchObject({ likeCount: 2, rank: 2, liked: true });
        expect(byId.get(third._id.toString())).toMatchObject({ likeCount: 1, rank: 3, liked: true });
        expect(byId.get(fourth._id.toString())).toMatchObject({ likeCount: 1, rank: 3, liked: true });
        /* una foto senza like non è "prima": non ha gradino */
        expect(byId.get(unliked._id.toString())).toMatchObject({ likeCount: 0, rank: null, liked: false });
    });

    it('senza deviceId la lista non rivela il "mio" like ma mostra i conteggi', async () => {
        const event = await createEvent();
        const photo = await createPhoto(event._id, 1);
        await EventPhotoLikeModel.create({ eventId: event._id, photoId: photo._id, deviceIdHash: 'hash-a' });

        const res = await request(app).get(`/api/events/${event._id}/photos`);

        expect(res.status).toBe(200);
        expect(res.body.items[0]).toMatchObject({ likeCount: 1, rank: 1, liked: false });
    });

    it('rifiuta il like senza deviceId', async () => {
        const event = await createEvent();
        const photo = await createPhoto(event._id, 1);

        const res = await request(app).post(`/api/events/${event._id}/photos/${photo._id}/like`).send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('deviceId');
    });

    it('rifiuta il like su un video', async () => {
        const event = await createEvent();
        const video = await createPhoto(event._id, 1, 'video');

        const res = await request(app)
            .post(`/api/events/${event._id}/photos/${video._id}/like`)
            .send({ deviceId: 'device-a' });

        expect(res.status).toBe(400);
        expect(await EventPhotoLikeModel.countDocuments({ photoId: video._id })).toBe(0);
    });

    it('risponde 404 per una foto di un altro evento', async () => {
        const event = await createEvent();
        const otherEvent = await createEvent('Other Event');
        const photo = await createPhoto(otherEvent._id, 1);

        const res = await request(app)
            .post(`/api/events/${event._id}/photos/${photo._id}/like`)
            .send({ deviceId: 'device-a' });

        expect(res.status).toBe(404);
    });

    it('risponde 400 con id non validi', async () => {
        const event = await createEvent();

        const res = await request(app)
            .post(`/api/events/${event._id}/photos/not-an-id/like`)
            .send({ deviceId: 'device-a' });

        expect(res.status).toBe(400);
    });

    it('salva userId per gli utenti autenticati e null per gli anonimi', async () => {
        const event = await createEvent();
        const first = await createPhoto(event._id, 1);
        const second = await createPhoto(event._id, 2);
        const { user, sessionToken } = await createAuthSession();

        await request(app)
            .post(`/api/events/${event._id}/photos/${first._id}/like`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ deviceId: 'device-a' })
            .expect(200);

        await request(app)
            .post(`/api/events/${event._id}/photos/${second._id}/like`)
            .send({ deviceId: 'device-a' })
            .expect(200);

        const registered = await EventPhotoLikeModel.findOne({ photoId: first._id }).lean();
        const anonymous = await EventPhotoLikeModel.findOne({ photoId: second._id }).lean();

        expect(registered?.userId?.toString()).toBe(user._id.toString());
        expect(anonymous?.userId).toBeNull();
    });

    it('cancellando la foto spariscono i suoi «mi piace»', async () => {
        const event = await createEvent();
        const photo = await createPhoto(event._id, 1);
        await EventPhotoLikeModel.create({ eventId: event._id, photoId: photo._id, deviceIdHash: 'hash-a' });

        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'photo-admin', 'event', event._id.toString());

        const res = await request(app)
            .delete(`/api/events/${event._id}/photos/${photo._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);
        expect(await EventPhotoLikeModel.countDocuments({ eventId: event._id })).toBe(0);
    });

    it('cancellando tutte le foto spariscono anche tutti i «mi piace»', async () => {
        const event = await createEvent();
        const first = await createPhoto(event._id, 1);
        const second = await createPhoto(event._id, 2);
        await EventPhotoLikeModel.create({ eventId: event._id, photoId: first._id, deviceIdHash: 'hash-a' });
        await EventPhotoLikeModel.create({ eventId: event._id, photoId: second._id, deviceIdHash: 'hash-b' });

        const { user, sessionToken } = await createAuthSession();
        await assignRole(user._id.toString(), 'photo-admin', 'event', event._id.toString());

        const res = await request(app)
            .delete(`/api/events/${event._id}/photos`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);
        expect(await EventPhotoLikeModel.countDocuments({ eventId: event._id })).toBe(0);
    });
});
