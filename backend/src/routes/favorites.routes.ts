import { Router } from 'express';

import {
    createFavorite,
    deleteFavorite,
    listFavorites
} from '../controllers/favorites.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const favoritesRouter = Router();

favoritesRouter.use(asyncHandler(authMiddleware));

favoritesRouter.get('/', asyncHandler(listFavorites));
favoritesRouter.post('/', asyncHandler(createFavorite));
favoritesRouter.delete('/:favId', asyncHandler(deleteFavorite));
