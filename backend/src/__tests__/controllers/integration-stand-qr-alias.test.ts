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

/* Il QR e' una data URL: l'indirizzo che ci sta dentro non si puo' leggere dai
 * test. Il mock lo restituisce in chiaro **proprio per poterlo verificare**: e'
 * la cosa che questi test devono controllare. */
vi.mock('qrcode', () => ({
    toDataURL: vi.fn(async (url: string) => `data:url:${url}`)
}));

import { AliasModel } from '../../models/alias.model';
import { EventModel } from '../../models/event.model';
import { StandModel } from '../../models/stand.model';
import { createTestApp } from '../helpers/test-app';

let app: Express;

const ORIGIN = 'https://app.example.com';

async function createEvent(name: string) {
    return EventModel.create({
        name,
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2027-06-01'),
        endDate: new Date('2027-06-07'),
        currencyName: 'TC'
    });
}

/* Il QR del menu non ha i due alias salvati da nessuna parte: il segmento
 * dello stand si ricava dal nome, quindi il server deve accettare anche quello
 * (non solo un alias esplicito). Senza, il QR ripiegherebbe sempre sul link
 * lungo pur essendoci lo shortlink dell'evento. */
describe('Stand QR — segmento ricavato dal nome', () => {
    it('usa il link annidato quando il segmento e\' il nome dello stand', async () => {
        app = createTestApp();
        const event = await createEvent('Street Food 2027');
        const stand = await StandModel.create({ name: "Panino d'Oro", eventIds: [event._id] });
        await AliasModel.create({ text: 'sf2027', entityType: 'event', entityRef: event._id });

        const res = await request(app)
            .get(`/api/stands/${stand._id}/qrcode?eventId=${event._id}&alias=panino-d-oro&eventAlias=sf2027`)
            .set('Origin', ORIGIN);

        expect(res.status).toBe(200);
        expect(res.body.qrCode).toBe(
            `data:url:${ORIGIN}/show/stand/sf2027/panino-d-oro`
        );
    });

    it('un segmento che non e\' il nome dello stand ripiega sul link lungo', async () => {
        app = createTestApp();
        const event = await createEvent('Street Food 2027');
        const stand = await StandModel.create({ name: "Panino d'Oro", eventIds: [event._id] });
        await AliasModel.create({ text: 'sf2027', entityType: 'event', entityRef: event._id });

        const res = await request(app)
            .get(`/api/stands/${stand._id}/qrcode?eventId=${event._id}&alias=inventato&eventAlias=sf2027`)
            .set('Origin', ORIGIN);

        expect(res.status).toBe(200);
        expect(res.body.qrCode).toBe(
            `data:url:${ORIGIN}/events/${event._id.toString()}/stands/${stand._id.toString()}`
        );
    });

    /* Il nome vale solo dentro il link dell'evento: da solo porterebbe a una
       pagina che non esiste, quindi senza l'alias dell'evento si ripiega. */
    it('senza alias dell\'evento il nome non basta', async () => {
        app = createTestApp();
        const event = await createEvent('Street Food 2027');
        const stand = await StandModel.create({ name: "Panino d'Oro", eventIds: [event._id] });

        const res = await request(app)
            .get(`/api/stands/${stand._id}/qrcode?eventId=${event._id}&alias=panino-d-oro`)
            .set('Origin', ORIGIN);

        expect(res.status).toBe(200);
        expect(res.body.qrCode).toBe(
            `data:url:${ORIGIN}/events/${event._id.toString()}/stands/${stand._id.toString()}`
        );
    });

    /* Con l'alias dell'evento di **un altro** evento il link non si compone:
       sarebbe un link breve che porta fuori dal contesto. */
    it('con l\'alias di un altro evento ripiega sul link lungo', async () => {
        app = createTestApp();
        const event = await createEvent('Street Food 2027');
        const other = await createEvent('Altro evento');
        const stand = await StandModel.create({ name: "Panino d'Oro", eventIds: [event._id] });
        await AliasModel.create({ text: 'altro', entityType: 'event', entityRef: other._id });

        const res = await request(app)
            .get(`/api/stands/${stand._id}/qrcode?eventId=${event._id}&alias=panino-d-oro&eventAlias=altro`)
            .set('Origin', ORIGIN);

        expect(res.status).toBe(200);
        expect(res.body.qrCode).toBe(
            `data:url:${ORIGIN}/events/${event._id.toString()}/stands/${stand._id.toString()}`
        );
    });

    /* L'alias esplicito (creato in passato) ha la precedenza sul nome. */
    it('l\'alias esplicito dello stand resta valido', async () => {
        app = createTestApp();
        const event = await createEvent('Street Food 2027');
        const stand = await StandModel.create({ name: "Panino d'Oro", eventIds: [event._id] });
        await AliasModel.create({ text: 'sf2027', entityType: 'event', entityRef: event._id });
        await AliasModel.create({ text: 'oro', entityType: 'stand', entityRef: stand._id });

        const res = await request(app)
            .get(`/api/stands/${stand._id}/qrcode?eventId=${event._id}&alias=oro&eventAlias=sf2027`)
            .set('Origin', ORIGIN);

        expect(res.status).toBe(200);
        expect(res.body.qrCode).toBe(`data:url:${ORIGIN}/show/stand/sf2027/oro`);
    });
});
