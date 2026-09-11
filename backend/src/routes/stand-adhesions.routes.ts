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
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const standAdhesionsRouter = Router({ mergeParams: true });

standAdhesionsRouter.get('/', asyncHandler(authMiddleware), asyncHandler(listAdhesions));
standAdhesionsRouter.get('/mine', asyncHandler(optionalAuthMiddleware), asyncHandler(getMyAdhesion));
standAdhesionsRouter.post('/', asyncHandler(optionalAuthMiddleware), asyncHandler(createAdhesion));
standAdhesionsRouter.get('/:adhesionId', asyncHandler(optionalAuthMiddleware), asyncHandler(getAdhesion));
standAdhesionsRouter.patch('/:adhesionId', asyncHandler(optionalAuthMiddleware), asyncHandler(updateAdhesion));
standAdhesionsRouter.post('/:adhesionId/submit', asyncHandler(optionalAuthMiddleware), asyncHandler(submitAdhesion));
standAdhesionsRouter.post('/:adhesionId/withdraw', asyncHandler(optionalAuthMiddleware), asyncHandler(withdrawAdhesion));
standAdhesionsRouter.post(
    '/:adhesionId/approve',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['event-admin'], { eventParam: 'eventId' })),
    asyncHandler(approveAdhesion)
);
standAdhesionsRouter.post(
    '/:adhesionId/reject',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['event-admin'], { eventParam: 'eventId' })),
    asyncHandler(rejectAdhesion)
);