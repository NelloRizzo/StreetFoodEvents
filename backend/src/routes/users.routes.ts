import { Router } from 'express';

import {
    createUser,
    deleteUser,
    getUserById,
    listUsers,
    resendInvite,
    updateUser
} from '../controllers/users.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const usersRouter = Router();

usersRouter.use(asyncHandler(authMiddleware));

usersRouter.get('/', asyncHandler(listUsers));
usersRouter.get('/:userId', asyncHandler(getUserById));
usersRouter.post('/', asyncHandler(hasRole('platform-admin')), asyncHandler(createUser));
usersRouter.post('/:userId/resend-invite', asyncHandler(hasRole('platform-admin')), asyncHandler(resendInvite));
usersRouter.patch('/:userId', asyncHandler(hasRole('platform-admin')), asyncHandler(updateUser));
usersRouter.delete('/:userId', asyncHandler(hasRole('platform-admin')), asyncHandler(deleteUser));
