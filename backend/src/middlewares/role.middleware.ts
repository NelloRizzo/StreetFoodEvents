import type { NextFunction, Request, Response } from 'express';
import { UserRoleModel } from '@/models/user-role.model';

type RoleInput = string | string[];

type HasRoleOptions = {
    eventParam?: string;
    standParam?: string;
};

export function hasRole(
    roles: RoleInput,
    options: HasRoleOptions = {}
) {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    return async function hasRoleMiddleware(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentication required'
            });
        }

        const eventId = options.eventParam
            ? req.params[options.eventParam]
            : null;

        const standId = options.standParam
            ? req.params[options.standParam]
            : null;

        const userRole = await UserRoleModel.findOne({
            userId: req.user.id,
            isActive: true,
            ...(eventId ? { eventId } : {}),
            ...(standId ? { standId } : {})
        }).populate({
            path: 'roleId',
            match: {
                slug: { $in: requiredRoles },
                isActive: true
            },
            select: 'slug scope isActive'
        });

        if (!userRole || !userRole.roleId) {
            return res.status(403).json({
                message: 'Insufficient role'
            });
        }

        return next();
    };
}
