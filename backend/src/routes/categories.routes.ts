import { Router } from 'express';

import { listCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categories.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const categoriesRouter = Router();

categoriesRouter.get('/', asyncHandler(listCategories));

categoriesRouter.post(
    '/',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin'])),
    asyncHandler(createCategory)
);

categoriesRouter.patch(
    '/:catId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin'])),
    asyncHandler(updateCategory)
);

categoriesRouter.delete(
    '/:catId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin'])),
    asyncHandler(deleteCategory)
);
