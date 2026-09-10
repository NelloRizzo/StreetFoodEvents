import { Router } from 'express';

import {
    approveAdhesion,
    createAdhesion,
    getAdhesion,
    getMyAdhesion,
    listAdhesions,
    rejectAdhesion,
    submitAdhesion,
    updateAdhesion,
    withdrawAdhesion
} from '../controllers/stand-adhesions.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const standAdhesionsRouter = Router({ mergeParams: true });

standAdhesionsRouter.use(asyncHandler(authMiddleware));

standAdhesionsRouter.get('/', asyncHandler(listAdhesions));
standAdhesionsRouter.get('/mine', asyncHandler(getMyAdhesion));
standAdhesionsRouter.post('/', asyncHandler(createAdhesion));
standAdhesionsRouter.get('/:adhesionId', asyncHandler(getAdhesion));
standAdhesionsRouter.patch('/:adhesionId', asyncHandler(updateAdhesion));
standAdhesionsRouter.post('/:adhesionId/submit', asyncHandler(submitAdhesion));
standAdhesionsRouter.post('/:adhesionId/withdraw', asyncHandler(withdrawAdhesion));
standAdhesionsRouter.post(
    '/:adhesionId/approve',
    asyncHandler(hasRole(['event-admin', 'platform-admin'], { eventParam: 'eventId' })),
    asyncHandler(approveAdhesion)
);
standAdhesionsRouter.post(
    '/:adhesionId/reject',
    asyncHandler(hasRole(['event-admin', 'platform-admin'], { eventParam: 'eventId' })),
    asyncHandler(rejectAdhesion)
);