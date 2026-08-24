import { createHash, randomBytes } from 'node:crypto';

export function hashActivationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function generateActivationToken(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = randomBytes(32).toString('hex');
    return {
        token,
        tokenHash: hashActivationToken(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
}
