import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { EventModel } from '../../models/event.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { StandAdhesionModel } from '../../models/stand-adhesion.model';
import { StandModel } from '../../models/stand.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession(scope: 'admin' | 'stand') {
    const user = await UserModel.create({
        firstName: 'Adh',
        lastName: 'User',
        email: `adh-${scope}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
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

async function setupEnvironment() {
    app = createTestApp();
    const { user: adminUser, sessionToken: adminToken } = await createAuthSession('admin');
    const { user: standUser, sessionToken: standToken } = await createAuthSession('stand');

    const event = await EventModel.create({
        name: 'Wizard Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-07'),
        currencyName: 'StreetCoin',
        exchangeRate: 2,
        participationFee: 150,
        deposit: 300,
        feeBands: [{ maxAmount: 1000, feePercent: 10, feeFlat: 20 }],
        cashPaymentsEnabled: true
    });

    const eventAdminRole = await RoleModel.create({
        name: 'Event Admin',
        scope: 'event',
        slug: 'event-admin',
        permissions: ['events:read', 'events:update'],
        isSystem: true,
        isActive: true
    });

    const standRole = await RoleModel.create({
        name: 'Stand Admin',
        scope: 'stand',
        slug: 'stand-admin',
        permissions: ['stands:read', 'stands:update'],
        isSystem: true,
        isActive: true
    });

    await UserRoleModel.create({
        userId: adminUser._id,
        roleId: eventAdminRole._id,
        eventId: event._id,
        isActive: true
    });

    const stand = await StandModel.create({
        name: 'Stand Burger',
        description: 'Panini al burger',
        eventIds: [event._id],
        numbers: [{ eventId: event._id, number: 1 }]
    });

    await UserRoleModel.create({
        userId: standUser._id,
        roleId: standRole._id,
        standId: stand._id,
        isActive: true
    });

    return { adminToken, standToken, event, stand, standUser, adminUser };
}

const completePayload = (standId: string) => ({
    standId,
    standName: 'Stand Burger',
    standType: 'food',
    slogan: 'Il meglio del burger',
    description: 'Descrizione dello stand',
    contactName: 'Mario Rossi',
    contactEmail: 'mario@example.com',
    contactPhone: '3331234567',
    products: [
        {
            name: 'Burger classico',
            description: 'Burger 100% manzo',
            price: 8,
            ingredients: 'Pane, manzo, formaggio',
            allergens: ['gluten', 'milk'],
            isFrozen: false
        }
    ],
    haccpConfirmed: true,
    haccpNote: 'STP in regola',
    acceptsPointLight: true,
    energyNeeds: [{ equipment: 'Friggitrice', powerKw: 3, connectionType: 'monofase' }],
    participationFeeAccepted: true,
    depositAccepted: true,
    regulationAccepted: true,
    exclusionAccepted: true,
    signature: 'Mario Rossi'
});

describe('Integration — Stand Adhesions', () => {
    it('create: admin creates adhesion for an event', async () => {
        const { adminToken, event, stand } = await setupEnvironment();

        const res = await request(app)
            .post(`/api/events/${event._id}/adhesions`)
            .set('Cookie', [`sid=${adminToken}`])
            .send(completePayload(stand._id.toString()));

        expect(res.status).toBe(201);
        expect(res.body.item).toMatchObject({
            status: 'draft',
            standName: 'Stand Burger',
            signature: 'Mario Rossi'
        });
        expect(res.body.item.standId).toBe(stand._id.toString());
    });

    it('create: stand user cannot attach an adhesion to another stand (403)', async () => {
        const { standToken, event } = await setupEnvironment();
        const otherStand = await StandModel.create({
            name: 'Altro Stand',
            eventIds: [event._id],
            numbers: [{ eventId: event._id, number: 2 }]
        });

        const res = await request(app)
            .post(`/api/events/${event._id}/adhesions`)
            .set('Cookie', [`sid=${standToken}`])
            .send(completePayload(otherStand._id.toString()));

        expect(res.status).toBe(403);
    });

    it('create: stand user creates adhesion for own stand (201)', async () => {
        const { standToken, event, stand } = await setupEnvironment();

        const res = await request(app)
            .post(`/api/events/${event._id}/adhesions`)
            .set('Cookie', [`sid=${standToken}`])
            .send(completePayload(stand._id.toString()));

        expect(res.status).toBe(201);
        expect(res.body.item.status).toBe('draft');
    });

    it('list: admin sees all, stand user sees only own', async () => {
        const { adminToken, standToken, event } = await setupEnvironment();
        const otherStand = await StandModel.create({
            name: 'Altro Stand',
            eventIds: [event._id],
            numbers: [{ eventId: event._id, number: 2 }]
        });

        await request(app)
            .post(`/api/events/${event._id}/adhesions`)
            .set('Cookie', [`sid=${standToken}`])
            .send(completePayload(stand._id.toString()));

        const payload = completePayload(otherStand._id.toString());
        delete payload.standId;
        await StandAdhesionModel.create({
            eventId: event._id,
            standId: otherStand._id,
            standName: payload.standName,
            standType: payload.standType,
            status: 'submitted',
            haccpConfirmed: true,
            acceptsPointLight: true,
            participationFeeAccepted: true,
            depositAccepted: true,
            regulationAccepted: true,
            exclusionAccepted: true,
            signature: payload.signature,
            submittedAt: new Date()
        });

        const adminRes = await request(app)
            .get(`/api/events/${event._id}/adhesions`)
            .set('Cookie', [`sid=${adminToken}`]);
        expect(adminRes.status).toBe(200);
        expect(adminRes.body.items).toHaveLength(2);

        const standRes = await request(app)
            .get(`/api/events/${event._id}/adhesions`)
            .set('Cookie', [`sid=${standToken}`]);
        expect(standRes.status).toBe(200);
        expect(standRes.body.items).toHaveLength(1);
        expect(standRes.body.items[0].standId).toBe(stand._id.toString());
    });

    it('submit: incomplete adhesion → 400 with missing fields', async () => {
        const { adminToken, event } = await setupEnvironment();
        const res = await request(app)
            .post(`/api/events/${event._id}/adhesions`)
            .set('Cookie', [`sid=${adminToken}`])
            .send({ standName: 'Stand incompleto', signature: 'Firma sola' });
        const adhesionId = res.body.item.id;

        const submitRes = await request(app)
            .post(`/api/events/${event._id}/adhesions/${adhesionId}/submit`)
            .set('Cookie', [`sid=${adminToken}`]);
        expect(submitRes.status).toBe(400);
        expect(submitRes.body.message).toMatch(/Compilazione incompleta/);
    });

    it('submit: complete adhesion → submitted; approve by event-admin → approved; edit → 409', async () => {
        const { adminToken, event, stand } = await setupEnvironment();
        const created = await request(app)
            .post(`/api/events/${event._id}/adhesions`)
            .set('Cookie', [`sid=${adminToken}`])
            .send(completePayload(stand._id.toString()));
        const adhesionId = created.body.item.id;

        const submitRes = await request(app)
            .post(`/api/events/${event._id}/adhesions/${adhesionId}/submit`)
            .set('Cookie', [`sid=${adminToken}`]);
        expect(submitRes.status).toBe(200);
        expect(submitRes.body.item.status).toBe('submitted');

        const approveRes = await request(app)
            .post(`/api/events/${event._id}/adhesions/${adhesionId}/approve`)
            .set('Cookie', [`sid=${adminToken}`])
            .send({ reviewNote: 'Ok' });
        expect(approveRes.status).toBe(200);
        expect(approveRes.body.item.status).toBe('approved');
        expect(approveRes.body.item.reviewNote).toBe('Ok');

        const editRes = await request(app)
            .patch(`/api/events/${event._id}/adhesions/${adhesionId}`)
            .set('Cookie', [`sid=${adminToken}`])
            .send({ slogan: 'nuovo slogan' });
        expect(editRes.status).toBe(409);
    });

    it('withdraw: submitted → draft', async () => {
        const { adminToken, event, stand } = await setupEnvironment();
        const created = await request(app)
            .post(`/api/events/${event._id}/adhesions`)
            .set('Cookie', [`sid=${adminToken}`])
            .send(completePayload(stand._id.toString()));
        const adhesionId = created.body.item.id;

        await request(app)
            .post(`/api/events/${event._id}/adhesions/${adhesionId}/submit`)
            .set('Cookie', [`sid=${adminToken}`]);

        const withdrawRes = await request(app)
            .post(`/api/events/${event._id}/adhesions/${adhesionId}/withdraw`)
            .set('Cookie', [`sid=${adminToken}`]);
        expect(withdrawRes.status).toBe(200);
        expect(withdrawRes.body.item.status).toBe('draft');
        expect(withdrawRes.body.item.submittedAt).toBeNull();
    });

    it('reject: requires event-admin; sets reviewNote', async () => {
        const { adminToken, event, stand } = await setupEnvironment();
        const created = await request(app)
            .post(`/api/events/${event._id}/adhesions`)
            .set('Cookie', [`sid=${adminToken}`])
            .send(completePayload(stand._id.toString()));
        const adhesionId = created.body.item.id;

        const rejectRes = await request(app)
            .post(`/api/events/${event._id}/adhesions/${adhesionId}/reject`)
            .set('Cookie', [`sid=${adminToken}`])
            .send({ reviewNote: 'Manca licenza' });
        expect(rejectRes.status).toBe(200);
        expect(rejectRes.body.item.status).toBe('rejected');
        expect(rejectRes.body.item.reviewNote).toBe('Manca licenza');
    });

    it('approve: stand user without event role → 403', async () => {
        const { standToken, event, stand } = await setupEnvironment();
        const created = await request(app)
            .post(`/api/events/${event._id}/adhesions`)
            .set('Cookie', [`sid=${standToken}`])
            .send(completePayload(stand._id.toString()));
        const adhesionId = created.body.item.id;

        const approveRes = await request(app)
            .post(`/api/events/${event._id}/adhesions/${adhesionId}/approve`)
            .set('Cookie', [`sid=${standToken}`]);
        expect(approveRes.status).toBe(403);
    });

    it('events: participationFee and deposit round-trip through create and read', async () => {
        app = createTestApp();
        const { adminToken } = await setupEnvironment();

        const createRes = await request(app)
            .post('/api/events')
            .set('Cookie', [`sid=${adminToken}`])
            .send({
                name: 'Fee Event',
                location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
                startDate: '2026-10-01',
                endDate: '2026-10-05',
                currencyName: 'Coin',
                participationFee: 200,
                deposit: 250
            });
        expect(createRes.status).toBe(201);
        expect(createRes.body.item.participationFee).toBe(200);
        expect(createRes.body.item.deposit).toBe(250);

        const eventId = createRes.body.item.id;
        const getRes = await request(app).get(`/api/events/${eventId}`);
        expect(getRes.body.item.participationFee).toBe(200);
        expect(getRes.body.item.deposit).toBe(250);
    });
});