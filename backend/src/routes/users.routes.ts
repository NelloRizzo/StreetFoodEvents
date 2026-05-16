import { Router } from 'express';

import {
    createUser,
    deleteUser,
    getUserById,
    listUsers,
    updateUser
} from '../controllers/users.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const usersRouter = Router();

usersRouter.use(asyncHandler(authMiddleware));

usersRouter.get('/', asyncHandler(listUsers));
usersRouter.get('/:userId', asyncHandler(getUserById));
usersRouter.post('/', asyncHandler(createUser));
usersRouter.patch('/:userId', asyncHandler(updateUser));
usersRouter.delete('/:userId', asyncHandler(deleteUser));
