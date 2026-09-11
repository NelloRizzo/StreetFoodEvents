import { createHash, randomBytes } from 'node:crypto';

export function hashAdhesionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function generateAdhesionAccessToken(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('hex');
    return { token, tokenHash: hashAdhesionToken(token) };
}
