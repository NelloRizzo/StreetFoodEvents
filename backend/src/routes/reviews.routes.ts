import { Router } from 'express';

import {
    createReview,
    deleteReview,
    getEventReviews,
    getManageReviews,
    getMyReviews,
    getReviewQrCode,
    getReviewsSummary,
    updateReviewStatus
} from '../controllers/reviews.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const reviewsRouter = Router({ mergeParams: true });

reviewsRouter.get('/', asyncHandler(getEventReviews));
reviewsRouter.get('/summary', asyncHandler(getReviewsSummary));
reviewsRouter.get('/qrcode', asyncHandler(getReviewQrCode));

reviewsRouter.post('/', asyncHandler(optionalAuthMiddleware), asyncHandler(createReview));
reviewsRouter.get('/mine', asyncHandler(optionalAuthMiddleware), asyncHandler(getMyReviews));

reviewsRouter.use(asyncHandler(authMiddleware));
reviewsRouter.use(hasRole(['event-admin', 'platform-admin'], { eventParam: 'eventId' }));

reviewsRouter.get('/manage', asyncHandler(getManageReviews));
reviewsRouter.patch('/:reviewId', asyncHandler(updateReviewStatus));
reviewsRouter.delete('/:reviewId', asyncHandler(deleteReview));