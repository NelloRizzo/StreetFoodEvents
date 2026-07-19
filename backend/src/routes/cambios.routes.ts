import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';
import { cambiosController } from '../controllers/cambios.controller';

export const cambiosRouter = Router();

cambiosRouter.use(asyncHandler(authMiddleware));

cambiosRouter.get('/:eventId/users', asyncHandler(hasRole('exchange-admin', { eventParam: 'eventId' })), asyncHandler(cambiosController.listUsers));
cambiosRouter.get('/:eventId/balance', asyncHandler(hasRole('exchange-admin', { eventParam: 'eventId' })), asyncHandler(cambiosController.getBalance));
cambiosRouter.get('/:eventId/transactions', asyncHandler(hasRole('exchange-admin', { eventParam: 'eventId' })), asyncHandler(cambiosController.listTransactions));
cambiosRouter.post('/:eventId/top-up', asyncHandler(hasRole('exchange-admin', { eventParam: 'eventId' })), asyncHandler(cambiosController.topUp));
cambiosRouter.post('/:eventId/refund', asyncHandler(hasRole('exchange-admin', { eventParam: 'eventId' })), asyncHandler(cambiosController.refund));
cambiosRouter.post('/:eventId/reset-cash-register', asyncHandler(hasRole('exchange-admin', { eventParam: 'eventId' })), asyncHandler(cambiosController.resetCashRegister));
cambiosRouter.get('/:eventId/cash-register-reset', asyncHandler(hasRole('exchange-admin', { eventParam: 'eventId' })), asyncHandler(cambiosController.getCashRegisterReset));
