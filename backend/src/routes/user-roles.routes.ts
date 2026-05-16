import { Router } from 'express';

import {
  createUserRole,
  deleteUserRole,
  listUserRoles,
  toggleUserRole,
} from '../controllers/user-roles.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const userRolesRouter = Router();

userRolesRouter.use(asyncHandler(authMiddleware));

userRolesRouter.get('/', asyncHandler(listUserRoles));
userRolesRouter.post('/', asyncHandler(createUserRole));
userRolesRouter.patch('/:userRoleId/toggle', asyncHandler(toggleUserRole));
userRolesRouter.delete('/:userRoleId', asyncHandler(deleteUserRole));
