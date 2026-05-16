import { Router } from 'express';

import {
    createStand,
    deleteStand,
    getStandById,
    listStands,
    standQrCode,
    updateStand
} from '../controllers/stands.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const standsRouter = Router();

standsRouter.get('/', asyncHandler(listStands));
standsRouter.get('/:standId', asyncHandler(getStandById));
standsRouter.get('/:standId/qrcode', asyncHandler(standQrCode));

standsRouter.post('/', asyncHandler(authMiddleware), asyncHandler(createStand));
standsRouter.patch('/:standId', asyncHandler(authMiddleware), asyncHandler(updateStand));
standsRouter.delete('/:standId', asyncHandler(authMiddleware), asyncHandler(deleteStand));
