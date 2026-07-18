import { Router } from 'express';

import { contestsController } from '../controllers/contests.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const contestsRouter = Router();

// ── Contest POI CRUD ──
// GET /api/contests/contest-pois
// POST /api/contests/contest-pois
// PATCH /api/contests/contest-pois/:poiId
// DELETE /api/contests/contest-pois/:poiId

contestsRouter.get(
    '/contest-pois',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['contest-admin', 'platform-admin'])),
    asyncHandler(contestsController.listContestPois)
);

contestsRouter.get(
    '/contest-pois/:poiId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['contest-admin', 'platform-admin'])),
    asyncHandler(contestsController.getContestPoi)
);

contestsRouter.post(
    '/contest-pois',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['contest-admin', 'platform-admin'])),
    asyncHandler(contestsController.createContestPoi)
);

contestsRouter.patch(
    '/contest-pois/:poiId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['contest-admin', 'platform-admin'])),
    asyncHandler(contestsController.updateContestPoi)
);

contestsRouter.delete(
    '/contest-pois/:poiId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['contest-admin', 'platform-admin'])),
    asyncHandler(contestsController.deleteContestPoi)
);

// ── Contest CRUD ──

contestsRouter.get('/', asyncHandler(contestsController.listContests));

contestsRouter.get('/:contestId', asyncHandler(contestsController.getContest));

contestsRouter.post(
    '/',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['contest-admin', 'platform-admin'])),
    asyncHandler(contestsController.createContest)
);

contestsRouter.patch(
    '/:contestId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['contest-admin', 'platform-admin'])),
    asyncHandler(contestsController.updateContest)
);

contestsRouter.delete(
    '/:contestId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['contest-admin', 'platform-admin'])),
    asyncHandler(contestsController.deleteContest)
);

// ── Scan ──

contestsRouter.post(
    '/:contestId/scan',
    asyncHandler(contestsController.registerScan)
);

contestsRouter.get(
    '/:contestId/participation/:participantId',
    asyncHandler(contestsController.getParticipation)
);

contestsRouter.patch(
    '/:contestId/participation/:participantId/award',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['contest-admin', 'platform-admin'])),
    asyncHandler(contestsController.awardPrize)
);

// ── QR Codes ──

contestsRouter.get(
    '/:contestId/poi-qrcodes',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(['contest-admin', 'platform-admin'])),
    asyncHandler(contestsController.getContestPoiQrCodes)
);
