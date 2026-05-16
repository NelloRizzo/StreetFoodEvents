import { Router } from 'express';

import {
    createEventProduct,
    deleteEventProduct,
    getEventProductById,
    listEventProducts,
    updateEventProduct
} from '../controllers/event-products.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const eventProductsRouter = Router();

eventProductsRouter.get('/', asyncHandler(listEventProducts));
eventProductsRouter.get('/:epId', asyncHandler(getEventProductById));

eventProductsRouter.use(asyncHandler(authMiddleware));

eventProductsRouter.post('/', asyncHandler(createEventProduct));
eventProductsRouter.patch('/:epId', asyncHandler(updateEventProduct));
eventProductsRouter.delete('/:epId', asyncHandler(deleteEventProduct));
