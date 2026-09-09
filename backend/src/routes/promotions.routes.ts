import { Router } from 'express';

import {
    createPromotion,
    deletePromotion,
    getPromotion,
    getPromotionQrCode,
    getPromotionUsage,
    listPromotions,
    redeemValue,
    updatePromotion,
    validatePromotion
} from '../controllers/promotions.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const promotionsRouter = Router({ mergeParams: true });

promotionsRouter.use(asyncHandler(authMiddleware));

promotionsRouter.post('/validate', asyncHandler(validatePromotion));
promotionsRouter.post('/redeem-value', asyncHandler(redeemValue));

promotionsRouter.use(hasRole(['event-admin', 'platform-admin'], { eventParam: 'eventId' }));

promotionsRouter.get('/', asyncHandler(listPromotions));
promotionsRouter.post('/', asyncHandler(createPromotion));
promotionsRouter.get('/:promotionId/qrcode', asyncHandler(getPromotionQrCode));
promotionsRouter.get('/:promotionId/usage', asyncHandler(getPromotionUsage));
promotionsRouter.get('/:promotionId', asyncHandler(getPromotion));
promotionsRouter.patch('/:promotionId', asyncHandler(updatePromotion));
promotionsRouter.delete('/:promotionId', asyncHandler(deletePromotion));