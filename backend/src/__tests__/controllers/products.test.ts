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

import { ProductModel } from '../../models/product.model';
import { SessionModel } from '../../models/session.model';
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
        firstName: 'Product',
        lastName: 'Tester',
        email: `product-${Date.now()}@test.com`,
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

describe('Products API', () => {
    it('lists products (empty)', async () => {
        app = createTestApp();
        const res = await request(app).get('/api/products');
        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    it('lists products with data', async () => {
        app = createTestApp();
        await ProductModel.create({ name: 'Burger', price: 10 });

        const res = await request(app).get('/api/products');
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0]!.name).toBe('Burger');
    });

    it('creates a product when authenticated', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const res = await request(app)
            .post('/api/products')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Pizza', price: 12.5, ingredients: ['Farina', 'Mozzarella'] });

        expect(res.status).toBe(201);
        expect(res.body.item.name).toBe('Pizza');
        expect(res.body.item.price).toBe(12.5);
        expect(res.body.item.ingredients).toEqual(['Farina', 'Mozzarella']);
    });

    it('returns 401 for create without auth', async () => {
        app = createTestApp();
        const res = await request(app)
            .post('/api/products')
            .send({ name: 'Test', price: 5 });
        expect(res.status).toBe(401);
    });

    it('updates a product', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const product = await ProductModel.create({ name: 'Old', price: 5 });

        const res = await request(app)
            .patch(`/api/products/${product._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Updated', price: 8 });

        expect(res.status).toBe(200);
        expect(res.body.item.name).toBe('Updated');
        expect(res.body.item.price).toBe(8);
    });

    it('deletes a product', async () => {
        app = createTestApp();
        const { sessionToken } = await createAuthSession();

        const product = await ProductModel.create({ name: 'To Delete', price: 3 });

        const res = await request(app)
            .delete(`/api/products/${product._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(204);

        const found = await ProductModel.findById(product._id);
        expect(found).toBeNull();
    });

    /* La descrizione e' HTML reso come markup nel menu: va sanificata in
       scrittura e anche in lettura, perche' un record scritto prima della
       regola (o modificato fuori dall'app) non deve poter iniettare script. */
    describe('descrizione HTML', () => {
        it('sanifica la descrizione alla creazione', async () => {
            app = createTestApp();
            const { sessionToken } = await createAuthSession();

            const res = await request(app)
                .post('/api/products')
                .set('Cookie', `sid=${sessionToken}`)
                .send({
                    name: 'Panino',
                    price: 5,
                    description: '<p>Pane</p><script>alert(1)</script>'
                });

            expect(res.status).toBe(201);
            expect(res.body.item.description).toContain('<p>Pane</p>');
            expect(res.body.item.description).not.toContain('<script');
            expect(res.body.item.description).not.toContain('alert');
        });

        it('sanifica la descrizione in modifica', async () => {
            app = createTestApp();
            const { sessionToken } = await createAuthSession();
            const product = await ProductModel.create({ name: 'Panino', price: 5 });

            const res = await request(app)
                .patch(`/api/products/${product._id}`)
                .set('Cookie', `sid=${sessionToken}`)
                .send({ description: '<img src=x onerror=alert(1)>' });

            expect(res.status).toBe(200);
            expect(res.body.item.description).not.toContain('onerror');
            expect(res.body.item.description).not.toContain('alert');
        });

        it('sanifica la descrizione anche in lettura su record non filtrati', async () => {
            app = createTestApp();
            /* Scritto direttamente sul modello, come un record storico:
               la lettura non deve fidarsi di cio' che trova. */
            await ProductModel.create({
                name: 'Legacy',
                price: 5,
                description: '<p>Ok</p><script>alert(1)</script>'
            });

            const res = await request(app).get('/api/products');
            expect(res.status).toBe(200);
            expect(res.body.items[0]!.description).not.toContain('<script');
            expect(res.body.items[0]!.description).not.toContain('alert');
        });
    });
});
