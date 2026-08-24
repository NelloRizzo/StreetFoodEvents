import { Router } from 'express';

import { listMyPhotos } from '../controllers/my-photos.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const myPhotosRouter = Router();

myPhotosRouter.get('/mine', asyncHandler(authMiddleware), asyncHandler(listMyPhotos));
