import * as argon2 from 'argon2';
import type { Express } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { EventModel } from '../../models/event.model';
import { EventProductModel } from '../../models/event-product.model';
import { POIModel } from '../../models/poi.model';
import { ProductModel } from '../../models/product.model';
import { SessionModel } from '../../models/session.model';
import { StandModel } from '../../models/stand.model';
import { StationModel } from '../../models/station.model';
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
        firstName: 'Dup',
        lastName: 'Tester',
        email: `dup-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
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

describe('POST /api/events/:eventId/duplicate', () => {
    it('returns 401 without auth', async () => {
        app = createTestApp();
        const res = await request(app)
            .post(`/api/events/${new Types.ObjectId().toString()}/duplicate`)
            .send({});
        expect(res.status).toBe(401);
    });

    it('returns 404 for unknown event', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();
        const res = await request(app)
            .post(`/api/events/${new Types.ObjectId().toString()}/duplicate`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({});
        expect(res.status).toBe(404);
    });

    it('returns 400 when endDate is before startDate', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Sagra',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const res = await request(app)
            .post(`/api/events/${event._id}/duplicate`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ startDate: '2027-06-10', endDate: '2027-06-01' });
        expect(res.status).toBe(400);
    });

    it('duplicates configuration with defaults and links stands/products/pois', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Sagra della Porchetta',
            location: { label: 'Piazza Centrale', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'StreetCoin',
            currencySymbol: {
                url: 'https://cdn.example.com/coin.png',
                publicId: 'coin',
                width: 32,
                height: 32,
                format: 'png',
                bytes: 512
            },
            exchangeRate: 5,
            url: 'https://sagra.example.com',
            cashPaymentsEnabled: true,
            unifiedCashierEnabled: true,
            isPublic: true,
            cashRegisterResetAt: new Date('2026-06-03'),
            feeBands: [{ maxAmount: 100, feePercent: 10 }],
            denominations: [
                { label: 'Una moneta', value: 1, quantity: 100 },
                { label: 'Cinque monete', value: 5, quantity: 50 }
            ],
            categories: [
                { label: 'Panini', sortOrder: 0 },
                { label: 'Dolci', sortOrder: 1 }
            ]
        });

        const stand = await StandModel.create({
            name: 'Stand Uno',
            eventIds: [event._id],
            numbers: [{ eventId: event._id, number: 3, showOnMap: false, feePercent: 10 }]
        });
        const station = await StationModel.create({ standId: stand._id, name: 'Cucina' });
        const product = await ProductModel.create({ name: 'Burger', price: 10 });

        await EventProductModel.create({
            eventId: event._id,
            standId: stand._id,
            productId: product._id,
            stationIds: [station._id],
            priceOverride: 8,
            available: true,
            sequenceOrder: 2,
            categoryId: 'Panini'
        });

        await POIModel.create({
            eventId: event._id,
            name: 'Fontana',
            description: 'Punto ritrovo',
            iconType: 'info',
            iconImage: {
                url: 'https://cdn.example.com/icon.png',
                publicId: 'icon',
                width: 64,
                height: 64,
                format: 'png',
                bytes: 1024
            },
            coverImage: {
                url: 'https://cdn.example.com/cover.png',
                publicId: 'cover',
                width: 800,
                height: 600,
                format: 'png',
                bytes: 2048
            },
            location: { type: 'Point', coordinates: [12.5, 41.9] },
            gallery: [
                {
                    url: 'https://cdn.example.com/g1.png',
                    publicId: 'g1',
                    width: 400,
                    height: 300,
                    format: 'png',
                    bytes: 512
                }
            ]
        });

        const res = await request(app)
            .post(`/api/events/${event._id}/duplicate`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({});

        expect(res.status).toBe(201);
        expect(res.body.item.name).toBe('Sagra della Porchetta (copia)');
        expect(new Date(res.body.item.startDate).getFullYear()).toBe(2027);
        expect(new Date(res.body.item.endDate).getFullYear()).toBe(2027);
        expect(res.body.item.url).toBeNull();
        expect(res.body.item.currencySymbol?.publicId).toBe('coin');
        expect(res.body.item.exchangeRate).toBe(5);
        expect(res.body.item.unifiedCashierEnabled).toBe(true);
        expect(res.body.item.categories).toEqual([
            { label: 'Panini', sortOrder: 0 },
            { label: 'Dolci', sortOrder: 1 }
        ]);
        expect(res.body.stats).toEqual({ standsLinked: 1, productsCopied: 1, poisCopied: 1 });

        const duplicateId = res.body.item.id as string;

        const duplicated = await EventModel.findById(duplicateId);
        expect(duplicated).not.toBeNull();
        expect(duplicated!.cashRegisterResetAt ?? null).toBeNull();
        expect(duplicated!.feeBands).toHaveLength(1);
        expect(duplicated!.toObject().denominations).toEqual([
            { label: 'Una moneta', value: 1, quantity: 100 },
            { label: 'Cinque monete', value: 5, quantity: 50 }
        ]);

        const reloadedStand = await StandModel.findById(stand._id).lean();
        expect(reloadedStand!.eventIds.map((id) => id.toString())).toContain(duplicateId);
        expect(reloadedStand!.numbers).toHaveLength(2);
        const dupNumber = reloadedStand!.numbers!.find((n) => n.eventId.toString() === duplicateId);
        expect(dupNumber!.number).toBe(1);
        expect(dupNumber!.showOnMap).toBe(false);
        expect(dupNumber!.feePercent).toBe(10);

        const copiedProducts = await EventProductModel.find({ eventId: duplicateId }).lean();
        expect(copiedProducts).toHaveLength(1);
        expect(copiedProducts[0]!.standId.toString()).toBe(stand._id.toString());
        expect(copiedProducts[0]!.priceOverride).toBe(8);
        expect(copiedProducts[0]!.sequenceOrder).toBe(2);
        expect(copiedProducts[0]!.categoryId).toBe('Panini');

        const copiedPois = await POIModel.find({ eventId: duplicateId }).lean();
        expect(copiedPois).toHaveLength(1);
        expect(copiedPois[0]!.name).toBe('Fontana');
        expect(copiedPois[0]!.description).toBe('Punto ritrovo');
        expect(copiedPois[0]!.iconImage?.url).toBe('https://cdn.example.com/icon.png');
        expect(copiedPois[0]!.coverImage?.url).toBe('https://cdn.example.com/cover.png');
        expect(copiedPois[0]!.gallery).toHaveLength(1);

        // L'evento sorgente resta intatto
        const sourceProducts = await EventProductModel.countDocuments({ eventId: event._id });
        const sourcePois = await POIModel.countDocuments({ eventId: event._id });
        expect(sourceProducts).toBe(1);
        expect(sourcePois).toBe(1);
    });

    it('accepts name, dates and isPublic overrides', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Sagra',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC',
            isPublic: true
        });

        const res = await request(app)
            .post(`/api/events/${event._id}/duplicate`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({
                name: 'Sagra 2027',
                startDate: '2027-06-05',
                endDate: '2027-06-11',
                isPublic: false
            });

        expect(res.status).toBe(201);
        expect(res.body.item.name).toBe('Sagra 2027');
        expect(res.body.item.startDate.startsWith('2027-06-05')).toBe(true);
        expect(res.body.item.endDate.startsWith('2027-06-11')).toBe(true);
        expect(res.body.item.isPublic).toBe(false);
    });
});
