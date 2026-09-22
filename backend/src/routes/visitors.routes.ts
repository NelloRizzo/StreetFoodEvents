import { Router } from 'express';

import { getVisitorEstimate } from '../controllers/visitors.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const visitorsRouter = Router({ mergeParams: true });

visitorsRouter.get(
    '/',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['event-admin', 'event-cashier', 'platform-admin'], { eventParam: 'eventId' })),
    asyncHandler(getVisitorEstimate)
);