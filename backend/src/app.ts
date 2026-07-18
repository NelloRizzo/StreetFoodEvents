import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env';
import { authRouter } from './routes/auth.routes';
import { eventProductsRouter } from './routes/event-products.routes';
import { eventUsersRouter } from './routes/event-users.routes';
import { eventsRouter } from './routes/events.routes';
import { favoritesRouter } from './routes/favorites.routes';
import { ordersRouter } from './routes/orders.routes';
import { productsRouter } from './routes/products.routes';
import { rolesRouter } from './routes/roles.routes';
import { standsRouter } from './routes/stands.routes';
import { stationsRouter } from './routes/stations.routes';
import { uploadRouter } from './routes/upload.routes';
import { userRolesRouter } from './routes/user-roles.routes';
import { userStationsRouter } from './routes/user-stations.routes';
import { usersRouter } from './routes/users.routes';
import { aliasesRouter, resolveRouter } from './routes/aliases.routes';
import { eventFramesRouter } from './routes/event-frames.routes';
import { eventPhotosRouter } from './routes/event-photos.routes';
import { framesRouter } from './routes/frames.routes';
import { poisRouter } from './routes/pois.routes';
import { contestsRouter } from './routes/contests.routes';
import { cambiosRouter } from './routes/cambios.routes';
import { usageContractsRouter } from './routes/usage-contracts.routes';

export const app = express();

app.disable('x-powered-by');
app.set('sessionCookieName', env.AUTH_SESSION_COOKIE_NAME);

app.use(
    cors({
        origin: true,
        credentials: true
    })
);
app.use(helmet());
app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
    return res.status(200).json({
        status: 'ok'
    });
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/event-users', eventUsersRouter);
app.use('/api/event-products', eventProductsRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/stands', standsRouter);
app.use('/api/stations', stationsRouter);
app.use('/api/products', productsRouter);
app.use('/api/user-roles', userRolesRouter);
app.use('/api/user-stations', userStationsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/users', usersRouter);
app.use('/api/usage-contracts', usageContractsRouter);
app.use('/api/pois', poisRouter);
app.use('/api/contests', contestsRouter);
app.use('/api/cambios', cambiosRouter);
app.use('/api/aliases', aliasesRouter);
app.use('/api/resolve', resolveRouter);
app.use('/api/frames', framesRouter);
app.use('/api/events/:eventId/photos', eventPhotosRouter);
app.use('/api/events/:eventId/frames', eventFramesRouter);

app.use((req, res) => {
    return res.status(404).json({
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);

    return res.status(500).json({
        message: 'Internal server error'
    });
});
