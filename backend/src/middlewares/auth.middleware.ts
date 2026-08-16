import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { SessionModel } from '../models/session.model';
import { UserModel } from '../models/user.model';
import { hashSessionToken } from '../utils/session';

async function resolveAuthenticatedUser(req: Request) {
    const sessionToken = req.cookies?.[env.AUTH_SESSION_COOKIE_NAME];

    if (typeof sessionToken !== 'string' || !sessionToken) {
        return null;
    }

    const session = await SessionModel.findOne({
        tokenHash: hashSessionToken(sessionToken),
        isRevoked: false,
        expiresAt: { $gt: new Date() }
    }).select('_id userId expiresAt');

    if (!session) {
        return null;
    }

    const user = await UserModel.findOne({
        _id: session.userId,
        isActive: true
    }).select('_id email');

    if (!user) {
        return null;
    }

    session.lastActivityAt = new Date();
    await session.save();

    return {
        id: user._id.toString(),
        email: user.email,
        sessionId: session._id.toString()
    };
}

export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const user = await resolveAuthenticatedUser(req);

    if (!user) {
        return res.status(401).json({
            message: 'Authentication required'
        });
    }

    req.user = user;

    return next();
}

export async function optionalAuthMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
) {
    const user = await resolveAuthenticatedUser(req);
    if (user) {
        req.user = user;
    }
    return next();
}
