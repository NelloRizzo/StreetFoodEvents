import { Router } from 'express';

import {
    createAlias,
    deleteAlias,
    getAliasById,
    listAliases,
    resolveAlias,
    resolveStandAliasInEvent,
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

/* Registrata PRIMA di `/:entityType/:alias`: il segmento in piu' del link
   annidato (/show/stand/<evento>/<stand>) finirebbe altrimenti dentro `:alias`
   e la rotta semplice risponderebbe 404 su un alias che invece esiste. */
resolveRouter.get('/stand/:eventAlias/:standAlias', asyncHandler(resolveStandAliasInEvent));

resolveRouter.get('/:entityType/:alias', asyncHandler(resolveAlias));
