import { Router } from 'express';
import {
    createFrame,
    deleteFrame,
    getFrameImage,
    listFrames
} from '../controllers/frames.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { multerImageUpload } from '../middlewares/upload.middleware';
import { asyncHandler } from '../utils/async-handler';

export const framesRouter = Router();

framesRouter.get('/', asyncHandler(listFrames));

framesRouter.get('/:frameId/image', asyncHandler(getFrameImage));

framesRouter.post(
    '/',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin'])),
    multerImageUpload.single('image'),
    asyncHandler(createFrame)
);

framesRouter.delete(
    '/:frameId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin'])),
    asyncHandler(deleteFrame)
);
