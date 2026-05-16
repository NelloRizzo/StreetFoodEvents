import { describe, expect, it } from 'vitest';

import {
    generateSessionToken,
    hashSessionToken,
    getSessionExpiryDate
} from '../../utils/session';

describe('Session utils', () => {
    it('generates a unique token each time', () => {
        const t1 = generateSessionToken();
        const t2 = generateSessionToken();
        expect(t1).not.toBe(t2);
    });

    it('generates a base64url string', () => {
        const token = generateSessionToken();
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('hashes a token to hex', () => {
        const token = generateSessionToken();
        const hash = hashSessionToken(token);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different hashes for different tokens', () => {
        const t1 = hashSessionToken('token-a');
        const t2 = hashSessionToken('token-b');
        expect(t1).not.toBe(t2);
    });

    it('produces consistent hash for same token', () => {
        const token = generateSessionToken();
        expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    });

    it('getSessionExpiryDate returns a future date', () => {
        const expiry = getSessionExpiryDate();
        expect(expiry.getTime()).toBeGreaterThan(Date.now());
    });
});
