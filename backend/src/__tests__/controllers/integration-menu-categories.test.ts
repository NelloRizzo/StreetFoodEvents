import type { Express } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { CategoryModel } from '../../models/category.model';
import { EventModel } from '../../models/event.model';
import { EventProductModel } from '../../models/event-product.model';
import { ProductModel } from '../../models/product.model';
import { StandModel } from '../../models/stand.model';
import { StationModel } from '../../models/station.model';
import { createTestApp } from '../helpers/test-app';

let app: Express;

describe('GET /api/events/:eventId/menu with global categories', () => {
    it('distributes products into global categories and Senza categoria', async () => {
        app = createTestApp();

        await CategoryModel.create([
            { label: 'Panini', sortOrder: 1 },
            { label: 'Dolci', sortOrder: 2 }
        ]);

        const event = await EventModel.create({
            name: 'Menu Test',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({
            name: 'Stand Uno',
            eventIds: [event._id],
            numbers: [{ eventId: event._id, number: 2 }]
        });
        const station = await StationModel.create({ standId: stand._id, name: 'Cucina' });

        const product = await ProductModel.create({
            name: 'Panino alla porchetta',
            price: 5,
            allergens: [],
            isFrozen: false
        });
        const loneProduct = await ProductModel.create({
            name: 'Prodotto senza categoria',
            price: 3,
            allergens: [],
            isFrozen: false
        });

        await EventProductModel.create([
            {
                eventId: event._id,
                standId: stand._id,
                productId: product._id,
                stationIds: [station._id],
                categoryIds: ['Panini']
            },
            {
                eventId: event._id,
                standId: stand._id,
                productId: loneProduct._id,
                stationIds: [station._id],
                categoryIds: []
            }
        ]);

        const res = await request(app).get(`/api/events/${event._id}/menu`);
        expect(res.status).toBe(200);
        const body = res.body;

        expect(body.categories).toEqual(['Panini', 'Dolci']);
        expect(body.byCategory['Panini'].map((i: { name: string }) => i.name)).toEqual(['Panino alla porchetta']);
        expect(body.byCategory['Dolci']).toEqual([]);
        expect(body.byCategory['Senza categoria'].map((i: { name: string }) => i.name)).toEqual(['Prodotto senza categoria']);
    });

    it('puts products whose category is not a global category into Senza categoria', async () => {
        app = createTestApp();

        await CategoryModel.create([{ label: 'Panini', sortOrder: 1 }]);

        const event = await EventModel.create({
            name: 'Menu Test 2',
            location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-06-07'),
            currencyName: 'TC'
        });

        const stand = await StandModel.create({
            name: 'Stand Uno',
            eventIds: [event._id],
            numbers: [{ eventId: event._id, number: 1 }]
        });
        const station = await StationModel.create({ standId: stand._id, name: 'Cucina' });

        const product = await ProductModel.create({
            name: 'Piatto orfano',
            price: 4,
            allergens: [],
            isFrozen: false
        });

        await EventProductModel.create({
            eventId: event._id,
            standId: stand._id,
            productId: product._id,
            stationIds: [station._id],
            categoryIds: ['CategoriaInesistente']
        });

        const res = await request(app).get(`/api/events/${event._id}/menu`);
        expect(res.status).toBe(200);
        expect(res.body.byCategory['Senza categoria'].map((i: { name: string }) => i.name)).toEqual(['Piatto orfano']);
    });

    it('returns 404 for unknown event', async () => {
        app = createTestApp();
        const res = await request(app).get(`/api/events/${new Types.ObjectId().toString()}/menu`);
        expect(res.status).toBe(404);
    });
});
