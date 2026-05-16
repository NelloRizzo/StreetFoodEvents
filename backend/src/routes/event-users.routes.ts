import { Router } from 'express';

import {
    createEventUser,
    createWalletTransaction,
    getEventUserById,
    listWalletTransactions
} from '../controllers/event-users.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const eventUsersRouter = Router();

eventUsersRouter.use(asyncHandler(authMiddleware));

eventUsersRouter.post('/', asyncHandler(createEventUser));
eventUsersRouter.get('/:eventUserId', asyncHandler(getEventUserById));
eventUsersRouter.get('/:eventUserId/transactions', asyncHandler(listWalletTransactions));
eventUsersRouter.post('/:eventUserId/transactions', asyncHandler(createWalletTransaction));
