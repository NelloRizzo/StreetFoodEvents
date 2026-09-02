import { Router } from 'express';

import {
    createEvent,
    deleteEvent,
    duplicateEvent,
    eventContestsQrCode,
    eventMenu,
    eventMenuQrCode,
    eventQrCode,
    getEventById,
    homeEvents,
    listEvents,
    updateEvent
} from '../controllers/events.controller';
import { listEventUsersByEvent } from '../controllers/event-users.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const eventsRouter = Router();

eventsRouter.get('/', asyncHandler(optionalAuthMiddleware), asyncHandler(listEvents));
eventsRouter.get('/home', asyncHandler(authMiddleware), asyncHandler(homeEvents));
eventsRouter.get('/:eventId', asyncHandler(optionalAuthMiddleware), asyncHandler(getEventById));
eventsRouter.get('/:eventId/qrcode', asyncHandler(eventQrCode));
eventsRouter.get('/:eventId/menu-qrcode', asyncHandler(eventMenuQrCode));
eventsRouter.get('/:eventId/menu', asyncHandler(eventMenu));
eventsRouter.get('/:eventId/contests-qrcode', asyncHandler(eventContestsQrCode));

eventsRouter.post('/', asyncHandler(authMiddleware), asyncHandler(createEvent));
eventsRouter.post('/:eventId/duplicate', asyncHandler(authMiddleware), asyncHandler(duplicateEvent));
eventsRouter.patch('/:eventId', asyncHandler(authMiddleware), asyncHandler(updateEvent));
eventsRouter.delete('/:eventId', asyncHandler(authMiddleware), asyncHandler(deleteEvent));

eventsRouter.get('/:eventId/users', asyncHandler(authMiddleware), asyncHandler(listEventUsersByEvent));
