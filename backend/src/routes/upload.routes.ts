import { Router } from 'express';

import {
    deleteGalleryHandler,
    deleteImageHandler,
    uploadGalleryHandler,
    uploadImageHandler
} from '../controllers/upload.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { uploadImageGallery, uploadSingleImage } from '../middlewares/cloudinary-upload.middleware';
import { asyncHandler } from '../utils/async-handler';

export const uploadRouter = Router();

uploadRouter.use(asyncHandler(authMiddleware));

uploadRouter.post(
    '/image',
    ...uploadSingleImage({ fieldName: 'image', folder: 'uploads' }),
    asyncHandler(uploadImageHandler)
);

uploadRouter.post(
    '/gallery',
    ...uploadImageGallery({ fieldName: 'images', folder: 'uploads', maxCount: 10 }),
    asyncHandler(uploadGalleryHandler)
);

uploadRouter.delete('/image', asyncHandler(deleteImageHandler));
uploadRouter.delete('/gallery', asyncHandler(deleteGalleryHandler));
