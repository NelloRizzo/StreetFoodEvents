import { Router } from 'express';

import {
    createEventPhoto,
    deleteAllEventPhotos,
    deleteEventPhoto,
    listEventPhotos,
    sendEventPhotoEmail,
    sendEventPhotosEmail,
    toggleEventPhotoLike
} from '../controllers/event-photos.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { multerMediaUpload } from '../middlewares/upload.middleware';
import { asyncHandler } from '../utils/async-handler';

export const eventPhotosRouter = Router({ mergeParams: true });

eventPhotosRouter.get('/', asyncHandler(listEventPhotos));

eventPhotosRouter.post(
    '/',
    asyncHandler(optionalAuthMiddleware),
    multerMediaUpload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'video', maxCount: 1 }
    ]),
    asyncHandler(createEventPhoto)
);

eventPhotosRouter.delete(
    '/',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['photo-admin', 'platform-admin'], { eventParam: 'eventId' })),
    asyncHandler(deleteAllEventPhotos)
);

eventPhotosRouter.post(
    '/send-email',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['photo-print', 'photo-admin', 'platform-admin'], { eventParam: 'eventId' })),
    asyncHandler(sendEventPhotosEmail)
);

eventPhotosRouter.post(
    '/:photoId/like',
    asyncHandler(optionalAuthMiddleware),
    asyncHandler(toggleEventPhotoLike)
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
