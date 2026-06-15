import { Router } from 'express';

import {
    createPoi,
    deletePoi,
    getPoiById,
    listPois,
    updatePoi
} from '../controllers/pois.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const poisRouter = Router();

poisRouter.get('/', asyncHandler(listPois));
poisRouter.get('/:poiId', asyncHandler(getPoiById));

poisRouter.post('/', asyncHandler(authMiddleware), asyncHandler(createPoi));
poisRouter.patch('/:poiId', asyncHandler(authMiddleware), asyncHandler(updatePoi));
poisRouter.delete('/:poiId', asyncHandler(authMiddleware), asyncHandler(deletePoi));
