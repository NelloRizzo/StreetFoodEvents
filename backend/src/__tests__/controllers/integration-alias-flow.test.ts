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

import { AliasModel } from '../../models/alias.model';
import { EventModel } from '../../models/event.model';
import { StandModel } from '../../models/stand.model';
import { UserModel } from '../../models/user.model';
import { SessionModel } from '../../models/session.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession() {
    const user = await UserModel.create({
        firstName: 'Flow',
        lastName: 'Tester',
        email: `flow-${Date.now()}@test.com`,
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

describe('Alias creation → resolution integration', () => {
    it('creates event alias and resolves it', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Festa di Sara',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const createRes = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'festasara', entityType: 'event', entityRef: event._id.toString() });

        expect(createRes.status).toBe(201);

        const resolveRes = await request(app).get('/api/resolve/event/festasara');

        expect(resolveRes.status).toBe(200);
        expect(resolveRes.body.entityType).toBe('event');
        expect(resolveRes.body.entityId).toBe(event._id.toString());
        expect(resolveRes.body.entityName).toBe('Festa di Sara');
    });

    it('creates stand alias and resolves it', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const stand = await StandModel.create({
            name: 'Pizza Mania'
        });

        const createRes = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'pizzamania', entityType: 'stand', entityRef: stand._id.toString() });

        expect(createRes.status).toBe(201);

        const resolveRes = await request(app).get('/api/resolve/stand/pizzamania');

        expect(resolveRes.status).toBe(200);
        expect(resolveRes.body.entityType).toBe('stand');
        expect(resolveRes.body.entityId).toBe(stand._id.toString());
        expect(resolveRes.body.entityName).toBe('Pizza Mania');
    });

    it('resolve returns entity name from the referenced entity', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Summer Food Festival 2026',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-07-01'),
            endDate: new Date('2026-07-07'),
            currencyName: 'TC'
        });

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'summer2026', entityType: 'event', entityRef: event._id.toString() });

        const resolveRes = await request(app).get('/api/resolve/event/summer2026');

        expect(resolveRes.status).toBe(200);
        expect(resolveRes.body.entityName).toBe('Summer Food Festival 2026');
    });

    /* Link breve annidato: /show/stand/<alias evento>/<alias stand>.
       I due alias restano segmenti singoli e vengono composti qui. */
    it('resolves the nested stand link inside its event', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Street Food 2027',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2027-06-01'),
            endDate: new Date('2027-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({
            name: 'Panino d\'Oro',
            eventIds: [event._id]
        });

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'sf2027', entityType: 'event', entityRef: event._id.toString() });

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'panino-d-oro', entityType: 'stand', entityRef: stand._id.toString() });

        const res = await request(app).get('/api/resolve/stand/sf2027/panino-d-oro');

        expect(res.status).toBe(200);
        expect(res.body.eventId).toBe(event._id.toString());
        expect(res.body.standId).toBe(stand._id.toString());
        expect(res.body.entityName).toBe('Panino d\'Oro');
    });

    /* Il controllo che conta: lo stand deve essere di quell'evento. Senza,
       un link breve porterebbe alla pagina di uno stand estraneo al contesto
       per cui e' stato scritto. */
    it('rejects the nested link when the stand is not in that event', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const eventA = await EventModel.create({
            name: 'Evento A',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2027-06-01'),
            endDate: new Date('2027-06-07'),
            currencyName: 'TC'
        });
        const eventB = await EventModel.create({
            name: 'Evento B',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2027-07-01'),
            endDate: new Date('2027-07-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({
            name: 'Solo di B',
            eventIds: [eventB._id]
        });

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'evento-a', entityType: 'event', entityRef: eventA._id.toString() });

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'solo-di-b', entityType: 'stand', entityRef: stand._id.toString() });

        const res = await request(app).get('/api/resolve/stand/evento-a/solo-di-b');

        expect(res.status).toBe(404);
    });

    /* Lo stand puo' essere collegato a un evento anche solo da `locations`
       (la numerazione per evento): il collegamento non si legge solo da
       `eventIds`. */
    it('accepts the nested link when the event is linked via locations', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Solo locations',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2027-06-01'),
            endDate: new Date('2027-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({
            name: 'Collegato per location',
            locations: [{ eventId: event._id, location: { type: 'Point', coordinates: [12.5, 41.9] } }]
        });

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'sl', entityType: 'event', entityRef: event._id.toString() });

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'per-location', entityType: 'stand', entityRef: stand._id.toString() });

        const res = await request(app).get('/api/resolve/stand/sl/per-location');

        expect(res.status).toBe(200);
        expect(res.body.eventId).toBe(event._id.toString());
    });

    /* La rotta semplice deve continuare a funzionare: `/stand/sf2027` non e'
       un alias annidato, e' quello dello stand. */
    it('the plain stand alias still resolves on its own', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const stand = await StandModel.create({ name: 'Semplice' });

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'semplice', entityType: 'stand', entityRef: stand._id.toString() });

        const res = await request(app).get('/api/resolve/stand/semplice');

        expect(res.status).toBe(200);
        expect(res.body.entityId).toBe(stand._id.toString());
    });

    it('nested link 404 when one of the two aliases is missing', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Evento',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2027-06-01'),
            endDate: new Date('2027-06-07'),
            currencyName: 'TC'
        });
        const stand = await StandModel.create({ name: 'Stand', eventIds: [event._id] });

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'ev', entityType: 'event', entityRef: event._id.toString() });

        /* Manca l'alias dello stand. */
        expect((await request(app).get('/api/resolve/stand/ev/non-esiste')).status).toBe(404);

        await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'st', entityType: 'stand', entityRef: stand._id.toString() });

        /* Manca l'alias dell'evento. */
        expect((await request(app).get('/api/resolve/stand/non-esiste/st')).status).toBe(404);
    });

    it('update alias text — old text no longer resolves', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Rename Me Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const createRes = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'old-name', entityType: 'event', entityRef: event._id.toString() });

        expect(createRes.status).toBe(201);
        const aliasId = createRes.body.item.id;

        const patchRes = await request(app)
            .patch(`/api/aliases/${aliasId}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'new-name' });

        expect(patchRes.status).toBe(200);

        const oldRes = await request(app).get('/api/resolve/event/old-name');
        expect(oldRes.status).toBe(404);

        const newRes = await request(app).get('/api/resolve/event/new-name');
        expect(newRes.status).toBe(200);
        expect(newRes.body.entityId).toBe(event._id.toString());
    });

    it('delete alias — resolution fails with 404', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const event = await EventModel.create({
            name: 'Delete Me Event',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const createRes = await request(app)
            .post('/api/aliases')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ text: 'doomed-alias', entityType: 'event', entityRef: event._id.toString() });

        expect(createRes.status).toBe(201);
        const aliasId = createRes.body.item.id;

        const deleteRes = await request(app)
            .delete(`/api/aliases/${aliasId}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(deleteRes.status).toBe(204);

        const found = await AliasModel.findById(aliasId);
        expect(found).toBeNull();

        const resolveRes = await request(app).get('/api/resolve/event/doomed-alias');
        expect(resolveRes.status).toBe(404);
    });
});
