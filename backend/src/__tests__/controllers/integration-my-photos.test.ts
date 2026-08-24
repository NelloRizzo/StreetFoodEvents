import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { EventPhotoModel } from '../../models/event-photo.model';
import { EventModel } from '../../models/event.model';
import { SessionModel } from '../../models/session.model';
import { UserModel } from '../../models/user.model';
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
        lastName: 'Shooter',
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

async function createEvent(name: string) {
    return EventModel.create({
        name,
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC'
    });
}

function imageMedia(publicId: string) {
    return {
        url: `https://cloudinary.test/${publicId}.jpg`,
        publicId,
        width: 800,
        height: 600,
        format: 'jpg',
        bytes: 1234
    };
}

describe('Integration: my photos dashboard endpoint', () => {
    it('requires authentication', async () => {
        app = createTestApp();

        const res = await request(app).get('/api/photos/mine');

        expect(res.status).toBe(401);
    });

    it('returns empty list for user without photos', async () => {
        app = createTestApp();
        const { cookie } = await createAuthSession('Empty');

        const res = await request(app).get('/api/photos/mine').set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('returns only own photos grouped per event with numbers and thumbnails', async () => {
        app = createTestApp();
        const shooter = await createAuthSession('Anna');
        const other = await createAuthSession('Marco');

        const olderEvent = await createEvent('Sagra Vecchia');
        const latestEvent = await createEvent('Sagra Nuova');

        await EventPhotoModel.create({
            eventId: olderEvent._id,
            type: 'image',
            image: imageMedia('events/e1/p2'),
            sequenceNumber: 2,
            takenAt: new Date('2026-06-02T10:00:00Z'),
            createdBy: shooter.user._id
        });
        await EventPhotoModel.create({
            eventId: olderEvent._id,
            type: 'image',
            image: imageMedia('events/e1/p5'),
            sequenceNumber: 5,
            takenAt: new Date('2026-06-02T11:00:00Z'),
            createdBy: shooter.user._id
        });
        await EventPhotoModel.create({
            eventId: latestEvent._id,
            type: 'video',
            video: {
                url: 'https://cloudinary.test/clip.mp4',
                publicId: 'events/e2/vid1',
                width: 1920,
                height: 1080,
                format: 'mp4',
                bytes: 98765,
                duration: 8
            },
            sequenceNumber: 9,
            takenAt: new Date('2026-08-01T12:00:00Z'),
            createdBy: shooter.user._id
        });
        await EventPhotoModel.create({
            eventId: olderEvent._id,
            type: 'image',
            image: imageMedia('events/e1/alien'),
            sequenceNumber: 99,
            takenAt: new Date('2026-06-02T12:00:00Z'),
            createdBy: other.user._id
        });

        const res = await request(app).get('/api/photos/mine').set('Cookie', shooter.cookie);

        expect(res.status).toBe(200);
        const items = res.body.items as Array<{
            eventId: string;
            eventName: string;
            totalCount: number;
            photos: Array<{ id: string; sequenceNumber: number; thumbnail: string | null }>;
        }>;

        const latestGroup = items[0]!;
        const olderGroup = items[1]!;

        expect(items).toHaveLength(2);
        expect(latestGroup.eventName).toBe('Sagra Nuova');
        expect(latestGroup.totalCount).toBe(1);
        expect(latestGroup.photos[0]!.sequenceNumber).toBe(9);
        expect(latestGroup.photos[0]!.thumbnail).toContain('/video/upload/so_1,w_320,h_320,c_fill,q_auto,f_auto/events/e2/vid1.jpg');

        expect(olderGroup.eventName).toBe('Sagra Vecchia');
        expect(olderGroup.totalCount).toBe(2);
        expect(olderGroup.photos.map((p) => p.sequenceNumber)).toEqual([5, 2]);
        expect(olderGroup.photos[0]!.thumbnail).toContain('/image/upload/w_320,h_320,c_fill,q_auto,f_auto/events/e1/p5.jpg');
    });

    it('caps returned thumbnails per event but keeps full count', async () => {
        app = createTestApp();
        const { user, cookie } = await createAuthSession('Cap');
        const event = await createEvent('Sagra Cap');

        await EventPhotoModel.insertMany(
            Array.from({ length: 33 }, (_, index) => ({
                eventId: event._id,
                type: 'image' as const,
                image: imageMedia(`events/cap/p${index}`),
                sequenceNumber: index + 1,
                takenAt: new Date(2026, 5, 1, 9, index),
                createdBy: user._id
            }))
        );

        const res = await request(app).get('/api/photos/mine').set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);

        const group = res.body.items[0] as { totalCount: number; photos: Array<{ sequenceNumber: number }> };
        expect(group.totalCount).toBe(33);
        expect(group.photos).toHaveLength(30);
        expect(group.photos[0]!.sequenceNumber).toBe(33);
        expect(group.photos[29]!.sequenceNumber).toBe(4);
    });
});
