import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';
import { exchangeController } from '../controllers/exchange.controller';

export const exchangeRouter = Router();

exchangeRouter.use(asyncHandler(authMiddleware));

exchangeRouter.get('/:eventId/users', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.listUsers));
exchangeRouter.get('/:eventId/balance', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.getBalance));
exchangeRouter.get('/:eventId/transactions', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.listTransactions));
exchangeRouter.post('/:eventId/top-up', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.topUp));
exchangeRouter.post('/:eventId/refund', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.refund));
exchangeRouter.post('/:eventId/guests', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.createGuest));
exchangeRouter.get('/:eventId/settlements/summary', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.settlementSummary));
exchangeRouter.get('/:eventId/settlements/report', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.settlementReport));
exchangeRouter.get('/:eventId/settlements', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.listSettlements));
exchangeRouter.post('/:eventId/settlements', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.createSettlement));
exchangeRouter.post('/:eventId/reset-cash-register', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.resetCashRegister));
exchangeRouter.get('/:eventId/cash-register-reset', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.getCashRegisterReset));

exchangeRouter.get('/:eventId/denomination-report', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.denominationReport));

exchangeRouter.post('/:eventId/cash-float', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.setCashFloat));
exchangeRouter.get('/:eventId/cash-movements', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.listCashMovements));
exchangeRouter.post('/:eventId/cash-movements', asyncHandler(hasRole(['exchange-admin', 'platform-admin'], { eventParam: 'eventId' })), asyncHandler(exchangeController.addCashMovement));
