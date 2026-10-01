import { Router } from 'express';

import { getEventAnalytics } from '../controllers/analytics.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const analyticsRouter = Router({ mergeParams: true });

/* Stessi guard di /visitors: chi amministra l'evento vede le sue vendite.
   `event-cashier` incluso per coerenza con la sezione Statistiche. */
analyticsRouter.get(
    '/',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['event-admin', 'event-cashier', 'platform-admin'], { eventParam: 'eventId' })),
    asyncHandler(getEventAnalytics)
);