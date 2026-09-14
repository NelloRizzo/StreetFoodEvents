import { createHash, randomBytes } from 'node:crypto';

export function hashReviewerToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function generateReviewerToken(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('hex');
    return { token, tokenHash: hashReviewerToken(token) };
}