import { Router } from 'express';

import {
    createEvent,
    deleteEvent,
    duplicateEvent,
    eventContestsQrCode,
    eventGalleryQrCode,
    eventMenu,
    eventMenuQrCode,
    eventPhotoBoothQrCode,
    eventQrCode,
    getEventById,
    homeEvents,
    listEvents,
    updateEvent
} from '../controllers/events.controller';
import { compareEvents } from '../controllers/analytics.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

export const eventsRouter = Router();

eventsRouter.get('/', asyncHandler(optionalAuthMiddleware), asyncHandler(listEvents));
eventsRouter.get('/home', asyncHandler(authMiddleware), asyncHandler(homeEvents));
eventsRouter.get('/compare', asyncHandler(authMiddleware), asyncHandler(compareEvents));
eventsRouter.get('/:eventId', asyncHandler(optionalAuthMiddleware), asyncHandler(getEventById));
eventsRouter.get('/:eventId/qrcode', asyncHandler(eventQrCode));
eventsRouter.get('/:eventId/menu-qrcode', asyncHandler(eventMenuQrCode));
eventsRouter.get('/:eventId/menu', asyncHandler(eventMenu));
eventsRouter.get('/:eventId/contests-qrcode', asyncHandler(eventContestsQrCode));
eventsRouter.get('/:eventId/gallery-qrcode', asyncHandler(eventGalleryQrCode));
eventsRouter.get('/:eventId/photo-booth-qrcode', asyncHandler(eventPhotoBoothQrCode));

eventsRouter.post('/', asyncHandler(authMiddleware), asyncHandler(hasRole(['platform-admin', 'event-admin'])), asyncHandler(createEvent));
eventsRouter.post('/:eventId/duplicate', asyncHandler(authMiddleware), asyncHandler(hasRole(['platform-admin', 'event-admin'])), asyncHandler(duplicateEvent));
eventsRouter.patch('/:eventId', asyncHandler(authMiddleware), asyncHandler(hasRole(['platform-admin', 'event-admin'])), asyncHandler(updateEvent));
eventsRouter.delete('/:eventId', asyncHandler(authMiddleware), asyncHandler(hasRole(['platform-admin', 'event-admin'])), asyncHandler(deleteEvent));
