import { Router } from 'express';
import {
    createAdvertisement,
    deleteAdvertisement,
    listAllAdvertisements,
    listEnabledAdvertisements,
    registerAdvertisementAppearance,
    resetAllAppearances,
    updateAdvertisement
} from '../controllers/advertisements.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { multerImageUpload } from '../middlewares/upload.middleware';
import { asyncHandler } from '../utils/async-handler';

export const advertisementsRouter = Router();

advertisementsRouter.get('/', asyncHandler(listEnabledAdvertisements));

advertisementsRouter.post(
    '/reset-appearances',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin', 'photo-admin'])),
    asyncHandler(resetAllAppearances)
);

advertisementsRouter.post(
    '/:advertisementId/appearance',
    asyncHandler(registerAdvertisementAppearance)
);

advertisementsRouter.get(
    '/manage',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin', 'photo-admin'])),
    asyncHandler(listAllAdvertisements)
);

advertisementsRouter.post(
    '/',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin', 'photo-admin'])),
    multerImageUpload.single('image'),
    asyncHandler(createAdvertisement)
);

advertisementsRouter.patch(
    '/:advertisementId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin', 'photo-admin'])),
    asyncHandler(updateAdvertisement)
);

advertisementsRouter.delete(
    '/:advertisementId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['platform-admin', 'photo-admin'])),
    asyncHandler(deleteAdvertisement)
);