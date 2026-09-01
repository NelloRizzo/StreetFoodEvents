import { Router } from 'express';

import {
    getSyncSnapshot,
    listSyncEvents,
    listSyncStands,
    pushSyncChanges,
    syncAuthMiddleware
} from '../controllers/sync.controller';
import { asyncHandler } from '../utils/async-handler';

export const syncRouter = Router();

syncRouter.use(syncAuthMiddleware);

syncRouter.get('/events', asyncHandler(listSyncEvents));
syncRouter.get('/events/:eventId/stands', asyncHandler(listSyncStands));
syncRouter.get('/events/:eventId/stands/:standId', asyncHandler(getSyncSnapshot));
syncRouter.post('/push', asyncHandler(pushSyncChanges));

export default syncRouter;
