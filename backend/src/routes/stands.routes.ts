import { Router } from 'express';

import {
    createStand,
    deleteStand,
    getStandById,
    listStands,
    reorderStands,
    standQrCode,
    updateStand
} from '../controllers/stands.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const standsRouter = Router();

standsRouter.get('/', asyncHandler(listStands));
standsRouter.get('/:standId', asyncHandler(getStandById));
standsRouter.get('/:standId/qrcode', asyncHandler(standQrCode));

standsRouter.post('/', asyncHandler(authMiddleware), asyncHandler(hasRole(['platform-admin', 'event-admin'])), asyncHandler(createStand));
standsRouter.patch('/reorder', asyncHandler(authMiddleware), asyncHandler(hasRole(['platform-admin', 'event-admin'])), asyncHandler(reorderStands));
standsRouter.patch('/:standId', asyncHandler(authMiddleware), asyncHandler(hasRole(['platform-admin', 'event-admin', 'stand-admin'], { standParam: 'standId' })), asyncHandler(updateStand));
standsRouter.delete('/:standId', asyncHandler(authMiddleware), asyncHandler(hasRole(['platform-admin', 'event-admin', 'stand-admin'], { standParam: 'standId' })), asyncHandler(deleteStand));
