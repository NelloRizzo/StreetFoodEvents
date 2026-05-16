import { Router } from 'express';

import {
    createStation,
    deleteStation,
    getStationById,
    listStations,
    updateStation
} from '../controllers/stations.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const stationsRouter = Router();

stationsRouter.get('/', asyncHandler(listStations));
stationsRouter.get('/:stationId', asyncHandler(getStationById));

stationsRouter.post('/', asyncHandler(authMiddleware), asyncHandler(createStation));
stationsRouter.patch('/:stationId', asyncHandler(authMiddleware), asyncHandler(updateStation));
stationsRouter.delete('/:stationId', asyncHandler(authMiddleware), asyncHandler(deleteStation));
