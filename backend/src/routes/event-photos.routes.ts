import { Router } from 'express';

import {
    createEventPhoto,
    deleteAllEventPhotos,
    deleteEventPhoto,
    listEventPhotos
} from '../controllers/event-photos.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { multerImageUpload } from '../middlewares/upload.middleware';
import { asyncHandler } from '../utils/async-handler';

export const eventPhotosRouter = Router({ mergeParams: true });

eventPhotosRouter.get('/', asyncHandler(listEventPhotos));

eventPhotosRouter.post(
    '/',
    asyncHandler(authMiddleware),
    multerImageUpload.single('image'),
    asyncHandler(createEventPhoto)
);

eventPhotosRouter.delete(
    '/',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['photo-admin', 'platform-admin'], { eventParam: 'eventId' })),
    asyncHandler(deleteAllEventPhotos)
);

eventPhotosRouter.delete(
    '/:photoId',
    asyncHandler(authMiddleware),
    asyncHandler(deleteEventPhoto)
);
