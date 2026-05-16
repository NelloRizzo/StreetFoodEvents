import { Router } from 'express';

import {
    createEvent,
    deleteEvent,
    eventQrCode,
    getEventById,
    homeEvents,
    listEvents,
    updateEvent
} from '../controllers/events.controller';
import { listEventUsersByEvent } from '../controllers/event-users.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const eventsRouter = Router();

eventsRouter.get('/', asyncHandler(listEvents));
eventsRouter.get('/home', asyncHandler(authMiddleware), asyncHandler(homeEvents));
eventsRouter.get('/:eventId', asyncHandler(getEventById));
eventsRouter.get('/:eventId/qrcode', asyncHandler(eventQrCode));

eventsRouter.post('/', asyncHandler(authMiddleware), asyncHandler(createEvent));
eventsRouter.patch('/:eventId', asyncHandler(authMiddleware), asyncHandler(updateEvent));
eventsRouter.delete('/:eventId', asyncHandler(authMiddleware), asyncHandler(deleteEvent));

eventsRouter.get('/:eventId/users', asyncHandler(authMiddleware), asyncHandler(listEventUsersByEvent));
