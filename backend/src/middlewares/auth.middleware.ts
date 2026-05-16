import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { SessionModel } from '../models/session.model';
import { UserModel } from '../models/user.model';
import { hashSessionToken } from '../utils/session';

export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const sessionToken = req.cookies?.[env.AUTH_SESSION_COOKIE_NAME];

    if (typeof sessionToken !== 'string' || !sessionToken) {
        return res.status(401).json({
            message: 'Authentication required'
        });
    }

    const session = await SessionModel.findOne({
        tokenHash: hashSessionToken(sessionToken),
        isRevoked: false,
        expiresAt: { $gt: new Date() }
    }).select('_id userId expiresAt');

    if (!session) {
        return res.status(401).json({
            message: 'Authentication required'
        });
    }

    const user = await UserModel.findOne({
        _id: session.userId,
        isActive: true
    }).select('_id email');

    if (!user) {
        return res.status(401).json({
            message: 'Authentication required'
        });
    }

    session.lastActivityAt = new Date();
    await session.save();

    req.user = {
        id: user._id.toString(),
        email: user.email,
        sessionId: session._id.toString()
    };

    return next();
}
