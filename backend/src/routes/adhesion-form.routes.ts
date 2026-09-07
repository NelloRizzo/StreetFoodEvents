import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';
import { generate, getForm, remove, update } from '../controllers/adhesion-form.controller';

export const adhesionFormRouter = Router({ mergeParams: true });

adhesionFormRouter.get('/', asyncHandler(getForm));

adhesionFormRouter.post('/generate', asyncHandler(authMiddleware), asyncHandler(hasRole(['event-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(generate));

adhesionFormRouter.patch('/', asyncHandler(authMiddleware), asyncHandler(hasRole(['event-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(update));

adhesionFormRouter.delete('/', asyncHandler(authMiddleware), asyncHandler(hasRole(['event-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(remove));