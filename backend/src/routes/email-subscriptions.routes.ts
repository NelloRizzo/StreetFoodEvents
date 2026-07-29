import { Router } from 'express';

import {
    exportCsv,
    listSubscriptions,
    subscribe,
    unsubscribe,
    unsubscribeByEmail
} from '../controllers/email-subscriptions.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const emailSubscriptionsRouter = Router();

emailSubscriptionsRouter.post('/', asyncHandler(subscribe));

emailSubscriptionsRouter.post('/unsubscribe', asyncHandler(unsubscribeByEmail));

emailSubscriptionsRouter.get(
    '/',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin'])),
    asyncHandler(listSubscriptions)
);

emailSubscriptionsRouter.get(
    '/export/csv',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin'])),
    asyncHandler(exportCsv)
);

emailSubscriptionsRouter.delete(
    '/:id',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin'])),
    asyncHandler(unsubscribe)
);
