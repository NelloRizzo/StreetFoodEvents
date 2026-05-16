import { Router } from 'express';

import { listRoles } from '../controllers/roles.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const rolesRouter = Router();

rolesRouter.use(asyncHandler(authMiddleware));

rolesRouter.get('/', asyncHandler(listRoles));
