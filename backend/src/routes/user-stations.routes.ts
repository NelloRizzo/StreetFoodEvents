import { Router } from 'express';

import {
    createUserStation,
    deleteUserStation,
    getUserStationById,
    listUserStations
} from '../controllers/user-stations.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const userStationsRouter = Router();

userStationsRouter.use(asyncHandler(authMiddleware));

userStationsRouter.get('/', asyncHandler(listUserStations));
userStationsRouter.get('/:userStationId', asyncHandler(getUserStationById));
userStationsRouter.post('/', asyncHandler(createUserStation));
userStationsRouter.delete('/:userStationId', asyncHandler(deleteUserStation));
