import { createHash, randomBytes } from 'node:crypto';

import type { Response } from 'express';

import { env, isProduction } from '../config/env';

export function generateSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function getSessionExpiryDate() {
  return new Date(Date.now() + env.AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000);
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(env.AUTH_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    expires: expiresAt,
    path: '/'
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(env.AUTH_SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/'
  });
}
