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

        /* Un event-admin puo' fare TUTTO sul proprio evento: e' il ruolo di
         * gestione dell'evento, quindi soddisfa anche i guard dei ruoli piu'
         * specifici (exchange-admin, contest-admin, photo-admin, ...).
         * Vale solo con eventParam, cosi' non si estende ad altri eventi.
         * NOTA: platform-admin NON viene aggiunto qui, perche' alcune route lo
         * escludono esplicitamente (es. approvazione adesioni) e devono
         * continuare a farlo. */
        const allowedSlugs = options.eventParam
            ? [...requiredRoles, 'event-admin']
            : requiredRoles;

        /* Ogni scope va in un $or DIVERSO, raccolto in un $and.
         * GOTCHA: due chiavi $or nello STESSO oggetto si sovrascrivono a
         * runtime (la seconda vince) e il primo scope verrebbe ignorato: su una
         * route con eventParam E standParam non si controllava piu' l'evento.
         * In $and le condizioni valgono sullo stesso documento, quindi un
         * ruolo "solo stand" passa lo scope stand ma deve passare anche quello
         * evento (e viceversa). */
        const scopeClauses: Record<string, unknown>[] = [];

        if (eventId) {
            scopeClauses.push({ $or: [{ eventId }, { eventId: { $exists: false } }, { eventId: null }] });
        }

        if (standId) {
            scopeClauses.push({ $or: [{ standId }, { standId: { $exists: false } }, { standId: null }] });
        }

        const userRole = await UserRoleModel.findOne({
            userId: req.user.id,
            isActive: true,
            ...(scopeClauses.length > 0 ? { $and: scopeClauses } : {})
        }).populate({
            path: 'roleId',
            match: {
                slug: { $in: allowedSlugs },
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
