import { Router } from 'express';

import { authMiddleware } from '../middlewares/auth.middleware.js';
import { hasRole } from '../middlewares/role.middleware.js';
import {
  listPhotoContests,
  getPhotoContest,
  getPhotoContestResults,
  createPhotoContest,
  updatePhotoContest,
  setPhotoContestEntries,
  votePhotoContest,
  resetPhotoContestVotes,
  closePhotoContest
} from '../controllers/photo-contests.controller.js';

const router = Router({ mergeParams: true });

// Public
router.get('/', listPhotoContests);
router.get('/:contestId', getPhotoContest);
router.post('/:contestId/vote', votePhotoContest);

// Admin
router.post('/', authMiddleware, hasRole(['photo-admin', 'event-admin', 'platform-admin']), createPhotoContest);
router.get('/:contestId/results', authMiddleware, hasRole(['photo-admin', 'event-admin', 'platform-admin'], { eventParam: 'eventId' }), getPhotoContestResults);
router.patch('/:contestId', authMiddleware, hasRole(['photo-admin', 'event-admin', 'platform-admin']), updatePhotoContest);
router.post('/:contestId/entries', authMiddleware, hasRole(['photo-admin', 'event-admin', 'platform-admin']), setPhotoContestEntries);
router.post('/:contestId/reset-votes', authMiddleware, hasRole(['photo-admin', 'event-admin', 'platform-admin']), resetPhotoContestVotes);
router.post('/:contestId/close', authMiddleware, hasRole(['photo-admin', 'event-admin', 'platform-admin']), closePhotoContest);

export default router;
