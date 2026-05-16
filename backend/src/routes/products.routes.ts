import { Router } from 'express';

import {
    createProduct,
    deleteProduct,
    getProductById,
    listProducts,
    updateProduct
} from '../controllers/products.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const productsRouter = Router();

productsRouter.get('/', asyncHandler(listProducts));
productsRouter.get('/:productId', asyncHandler(getProductById));

productsRouter.post('/', asyncHandler(authMiddleware), asyncHandler(createProduct));
productsRouter.patch('/:productId', asyncHandler(authMiddleware), asyncHandler(updateProduct));
productsRouter.delete('/:productId', asyncHandler(authMiddleware), asyncHandler(deleteProduct));
