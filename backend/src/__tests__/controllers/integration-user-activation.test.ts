import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const emailState = vi.hoisted(() => ({
    sendActivationEmail: vi.fn()
}));

vi.mock('@/services/email.service', () => ({
    isEmailConfigured: () => false,
    sendPhotoEmail: vi.fn(),
    sendPhotosEmail: vi.fn(),
    sendActivationEmail: emailState.sendActivationEmail
}));

import { SessionModel } from '../../models/session.model';
import { UserModel } from '../../models/user.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createPlatformAdmin() {
    const user = await UserModel.create({
        firstName: 'Admin',
        lastName: 'Piattaforma',
        email: `admin-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`,
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

    return `sid=${sessionToken}`;
}

beforeEach(() => {
    vi.clearAllMocks();
    emailState.sendActivationEmail.mockRejectedValue(new Error('Brevo non configurato'));
});

describe('Integration: user invitation and activation', () => {
    it('creates invited user without password, inactive, with activation url fallback when email fails', async () => {
        app = createTestApp();
        const cookie = await createPlatformAdmin();

        const res = await request(app)
            .post('/api/users')
            .set('Cookie', cookie)
            .send({ firstName: 'Mario', lastName: 'Rossi', email: 'mario@test.com' });

        expect(res.status).toBe(201);
        expect(res.body.item.isActive).toBe(false);
        expect(res.body.item.activatedAt).toBeNull();
        expect(res.body.item.passwordHash).toBeUndefined();
        expect(emailState.sendActivationEmail).toHaveBeenCalledOnce();
        expect(res.body.emailSent).toBe(false);
        expect(typeof res.body.activationUrl).toBe('string');
        expect(res.body.activationUrl).toContain('/attiva/');
    });

    it('rejects creation without valid email or duplicate email', async () => {
        app = createTestApp();
        const cookie = await createPlatformAdmin();

        const noEmail = await request(app)
            .post('/api/users')
            .set('Cookie', cookie)
            .send({ firstName: 'A', lastName: 'B' });
        expect(noEmail.status).toBe(400);

        const first = await request(app)
            .post('/api/users')
            .set('Cookie', cookie)
            .send({ firstName: 'A', lastName: 'B', email: 'dup@test.com' });
        expect(first.status).toBe(201);

        const dup = await request(app)
            .post('/api/users')
            .set('Cookie', cookie)
            .send({ firstName: 'C', lastName: 'D', email: 'dup@test.com' });
        expect(dup.status).toBe(409);
    });

    it('blocks login until activation, then activates and allows login', async () => {
        app = createTestApp();
        const cookie = await createPlatformAdmin();

        const created = await request(app)
            .post('/api/users')
            .set('Cookie', cookie)
            .send({ firstName: 'Luigi', lastName: 'Verdi', email: 'luigi@test.com' });
        const activationUrl: string = created.body.activationUrl;
        const token = activationUrl.split('/attiva/')[1];

        const blocked = await request(app)
            .post('/api/auth/login')
            .send({ email: 'luigi@test.com', password: 'MiaPassword1!' });
        expect(blocked.status).toBe(403);
        expect(blocked.body.message).toContain('non ancora attivato');

        const weak = await request(app)
            .post('/api/auth/activate')
            .send({ token, password: 'corta' });
        expect(weak.status).toBe(400);

        const badToken = await request(app)
            .post('/api/auth/activate')
            .send({ token: 'nope', password: 'MiaPassword1!' });
        expect(badToken.status).toBe(400);

        const ok = await request(app)
            .post('/api/auth/activate')
            .send({ token, password: 'MiaPassword1!' });
        expect(ok.status).toBe(200);
        expect(ok.body.success).toBe(true);

        const reuseToken = await request(app)
            .post('/api/auth/activate')
            .send({ token, password: 'AltraPassword1!' });
        expect(reuseToken.status).toBe(400);

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'luigi@test.com', password: 'MiaPassword1!' });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.user.email).toBe('luigi@test.com');
    });

    it('resend-invite invalidates the old token', async () => {
        app = createTestApp();
        const cookie = await createPlatformAdmin();

        const created = await request(app)
            .post('/api/users')
            .set('Cookie', cookie)
            .send({ firstName: 'Anna', lastName: 'Bianchi', email: 'anna@test.com' });
        const oldToken = created.body.activationUrl.split('/attiva/')[1];

        const resent = await request(app)
            .post(`/api/users/${created.body.item.id}/resend-invite`)
            .set('Cookie', cookie);
        expect(resent.status).toBe(200);
        expect(resent.body.emailSent).toBe(false);

        const newToken = resent.body.activationUrl.split('/attiva/')[1];
        expect(newToken).not.toBe(oldToken);

        const oldActivate = await request(app)
            .post('/api/auth/activate')
            .send({ token: oldToken, password: 'MiaPassword1!' });
        expect(oldActivate.status).toBe(400);

        const newActivate = await request(app)
            .post('/api/auth/activate')
            .send({ token: newToken, password: 'MiaPassword1!' });
        expect(newActivate.status).toBe(200);

        const again = await request(app)
            .post(`/api/users/${created.body.item.id}/resend-invite`)
            .set('Cookie', cookie);
        expect(again.status).toBe(400);
    });
});
