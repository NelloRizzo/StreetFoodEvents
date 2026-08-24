import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/email.service', () => ({
    isEmailConfigured: () => false,
    sendPhotoEmail: vi.fn(),
    sendPhotosEmail: vi.fn()
}));

import { EventModel } from '../../models/event.model';
import { EventUserModel } from '../../models/event-user.model';
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

async function createExchangeAdmin() {
    const user = await UserModel.create({
        firstName: 'Cambio',
        lastName: 'Tester',
        email: `cambio-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        isActive: true
    });

    const role = await RoleModel.create({
        name: 'exchange-admin',
        slug: 'exchange-admin',
        scope: 'platform',
        permissions: ['manage']
    });
    await UserRoleModel.create({ userId: user._id, roleId: role._id, isActive: true });

    const sessionToken = generateSessionToken();
    await SessionModel.create({
        userId: user._id,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: getSessionExpiryDate(),
        lastActivityAt: new Date()
    });

    return { cookie: `sid=${sessionToken}` };
}

async function createEvent() {
    return EventModel.create({
        name: 'Sagra Cassa',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC',
        exchangeRate: 2
    });
}

async function createAnonymousWallet(eventId: string) {
    return EventUserModel.create({ eventId, userId: null, balance: 0 });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Integration: cash register float and movements', () => {
    it('forbids non exchange-admin users', async () => {
        app = createTestApp();
        const event = await createEvent();

        const res = await request(app)
            .post(`/api/exchange/${event._id}/cash-float`)
            .send({ euro: 100 });

        expect(res.status).toBe(401);
    });

    it('validates float and movement payloads', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();

        const resBadFloat = await request(app)
            .post(`/api/exchange/${event._id}/cash-float`)
            .set('Cookie', cookie)
            .send({ euro: -5 });
        expect(resBadFloat.status).toBe(400);

        const resBadCurrency = await request(app)
            .post(`/api/exchange/${event._id}/cash-movements`)
            .set('Cookie', cookie)
            .send({ currency: 'dollars', direction: 'in', amount: 10 });
        expect(resBadCurrency.status).toBe(400);

        const resBadDirection = await request(app)
            .post(`/api/exchange/${event._id}/cash-movements`)
            .set('Cookie', cookie)
            .send({ currency: 'euro', direction: 'sideways', amount: 10 });
        expect(resBadDirection.status).toBe(400);

        const resBadAmount = await request(app)
            .post(`/api/exchange/${event._id}/cash-movements`)
            .set('Cookie', cookie)
            .send({ currency: 'euro', direction: 'in', amount: 0 });
        expect(resBadAmount.status).toBe(400);
    });

    it('computes separate euro and credits content from float, top-ups and movements', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();
        const wallet = await createAnonymousWallet(event._id.toString());

        await request(app)
            .post(`/api/exchange/${event._id}/top-up`)
            .set('Cookie', cookie)
            .send({ eventUserId: wallet._id.toString(), amount: 50, description: '' })
            .expect((res) => {
                if (res.status !== 201 && res.status !== 200) throw new Error(`top-up failed: ${res.status}`);
            });

        await request(app)
            .post(`/api/exchange/${event._id}/refund`)
            .set('Cookie', cookie)
            .send({ eventUserId: wallet._id.toString(), amount: 10 });

        const setRes = await request(app)
            .post(`/api/exchange/${event._id}/cash-float`)
            .set('Cookie', cookie)
            .send({ euro: 200, credits: 300 });
        expect(setRes.status).toBe(200);
        expect(setRes.body.item).toMatchObject({ euro: 200, credits: 300 });

        await request(app)
            .post(`/api/exchange/${event._id}/cash-movements`)
            .set('Cookie', cookie)
            .send({ currency: 'euro', direction: 'out', amount: 50, description: 'Trasferimento ad altra cassa' });

        await request(app)
            .post(`/api/exchange/${event._id}/cash-movements`)
            .set('Cookie', cookie)
            .send({ currency: 'credits', direction: 'in', amount: 40, description: 'Rifornimento token' });

        const balRes = await request(app)
            .get(`/api/exchange/${event._id}/balance`)
            .set('Cookie', cookie);
        expect(balRes.status).toBe(200);

        expect(balRes.body.cashFloat).toMatchObject({ euro: 200, credits: 300 });
        expect(balRes.body.euroContent).toBe(200 + 50 - 5 - 50);
        expect(balRes.body.creditsContent).toBe(300 - 100 + 10 + 40);
        expect(balRes.body.cashMovements).toEqual({
            euroIn: 0,
            euroOut: 50,
            creditsIn: 40,
            creditsOut: 0
        });
    });

    it('lists cash movements paginated', async () => {
        app = createTestApp();
        const event = await createEvent();
        const { cookie } = await createExchangeAdmin();

        for (let i = 1; i <= 3; i += 1) {
            await request(app)
                .post(`/api/exchange/${event._id}/cash-movements`)
                .set('Cookie', cookie)
                .send({ currency: 'euro', direction: 'out', amount: i });
        }

        const list = await request(app)
            .get(`/api/exchange/${event._id}/cash-movements?page=1&limit=2`)
            .set('Cookie', cookie);
        expect(list.status).toBe(200);
        expect(list.body.items).toHaveLength(2);
        expect(list.body.pagination.totalPages).toBe(2);
    });
});
