import { Router } from 'express';

import {
    createEventFrame,
    deleteEventFrame,
    listEventFrames
} from '../controllers/event-frames.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { multerImageUpload } from '../middlewares/upload.middleware';
import { asyncHandler } from '../utils/async-handler';

export const eventFramesRouter = Router({ mergeParams: true });

eventFramesRouter.get('/', asyncHandler(listEventFrames));

eventFramesRouter.post(
    '/',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['photo-admin', 'platform-admin'], { eventParam: 'eventId' })),
    multerImageUpload.single('image'),
    asyncHandler(createEventFrame)
);

eventFramesRouter.delete(
    '/:frameId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['photo-admin', 'platform-admin'], { eventParam: 'eventId' })),
    asyncHandler(deleteEventFrame)
);
