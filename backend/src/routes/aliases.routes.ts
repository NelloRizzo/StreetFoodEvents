import { Router } from 'express';

import {
    createAlias,
    deleteAlias,
    getAliasById,
    listAliases,
    resolveAlias,
    updateAlias
} from '../controllers/aliases.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const aliasesRouter = Router();

aliasesRouter.get('/', asyncHandler(authMiddleware), asyncHandler(listAliases));
aliasesRouter.get('/:aliasId', asyncHandler(authMiddleware), asyncHandler(getAliasById));

aliasesRouter.post('/', asyncHandler(authMiddleware), asyncHandler(createAlias));
aliasesRouter.patch('/:aliasId', asyncHandler(authMiddleware), asyncHandler(updateAlias));
aliasesRouter.delete('/:aliasId', asyncHandler(authMiddleware), asyncHandler(deleteAlias));

export const resolveRouter = Router();

resolveRouter.get('/:entityType/:alias', asyncHandler(resolveAlias));
