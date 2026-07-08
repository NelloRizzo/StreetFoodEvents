import { Router } from 'express';

import {
    createEventPhoto,
    deleteAllEventPhotos,
    deleteEventPhoto,
    listEventPhotos,
    sendEventPhotoEmail
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

eventPhotosRouter.post(
    '/:photoId/send-email',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['photo-print', 'photo-admin', 'platform-admin'], { eventParam: 'eventId' })),
    asyncHandler(sendEventPhotoEmail)
);

eventPhotosRouter.delete(
    '/:photoId',
    asyncHandler(authMiddleware),
    asyncHandler(deleteEventPhoto)
);
