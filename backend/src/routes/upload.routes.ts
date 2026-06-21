import { Router } from 'express';

import {
    deleteGalleryHandler,
    deleteImageHandler,
    uploadGalleryHandler,
    uploadImageHandler
} from '../controllers/upload.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { multerImageUpload } from '../middlewares/upload.middleware';
import { uploadImageBuffer } from '../services/cloudinary-upload.service';
import { asyncHandler } from '../utils/async-handler';

const typeFolderMap: Record<string, string> = {
    stand: 'stands',
    event: 'events',
    product: 'products',
    user: 'users',
    poi: 'pois',
};

function resolveFolder(req: import('express').Request): string {
    const type = req.query.type as string | undefined;
    return (type && typeFolderMap[type]) || 'uploads';
}

export const uploadRouter = Router();

uploadRouter.use(asyncHandler(authMiddleware));

uploadRouter.post(
    '/image',
    multerImageUpload.single('image'),
    asyncHandler(async (req, res, next) => {
        if (!req.file) {
            res.status(400).json({ message: 'image is required' });
            return;
        }

        req.uploadedImage = await uploadImageBuffer(req.file, resolveFolder(req));
        next();
    }),
    asyncHandler(uploadImageHandler)
);

uploadRouter.post(
    '/gallery',
    multerImageUpload.array('images', 10),
    asyncHandler(async (req, res, next) => {
        const files = req.files as Express.Multer.File[] | undefined;

        if (!files?.length) {
            res.status(400).json({ message: 'images are required' });
            return;
        }

        const folder = resolveFolder(req);
        req.uploadedGallery = await Promise.all(
            files.map((file) => uploadImageBuffer(file, folder))
        );
        next();
    }),
    asyncHandler(uploadGalleryHandler)
);

uploadRouter.delete('/image', asyncHandler(deleteImageHandler));
uploadRouter.delete('/gallery', asyncHandler(deleteGalleryHandler));
