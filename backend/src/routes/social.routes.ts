import { Router } from 'express';

import {
    createSocialPosts,
    getSocialPublishConfigView,
    listSocialPosts
} from '../controllers/social-posts.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const eventSocialRouter = Router({ mergeParams: true });

eventSocialRouter.get(
    '/config',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['photo-admin', 'platform-admin'], { eventParam: 'eventId' })),
    asyncHandler(getSocialPublishConfigView)
);

eventSocialRouter.get(
    '/posts',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['photo-admin', 'platform-admin'], { eventParam: 'eventId' })),
    asyncHandler(listSocialPosts)
);

eventSocialRouter.post(
    '/posts',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['photo-admin', 'platform-admin'], { eventParam: 'eventId' })),
    asyncHandler(createSocialPosts)
);
