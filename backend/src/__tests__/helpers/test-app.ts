import express from 'express';
import cookieParser from 'cookie-parser';

import { authRouter } from '../../routes/auth.routes';
import { eventsRouter } from '../../routes/events.routes';
import { standsRouter } from '../../routes/stands.routes';
import { stationsRouter } from '../../routes/stations.routes';
import { productsRouter } from '../../routes/products.routes';
import { usersRouter } from '../../routes/users.routes';
import { eventProductsRouter } from '../../routes/event-products.routes';
import { eventUsersRouter } from '../../routes/event-users.routes';
import { favoritesRouter } from '../../routes/favorites.routes';
import { ordersRouter } from '../../routes/orders.routes';
import { aliasesRouter, resolveRouter } from '../../routes/aliases.routes';
import { rolesRouter } from '../../routes/roles.routes';
import { userRolesRouter } from '../../routes/user-roles.routes';
import { userStationsRouter } from '../../routes/user-stations.routes';
import { eventPhotosRouter } from '../../routes/event-photos.routes';
import { eventFramesRouter } from '../../routes/event-frames.routes';
import { poisRouter } from '../../routes/pois.routes';
import { usageContractsRouter } from '../../routes/usage-contracts.routes';
import { framesRouter } from '../../routes/frames.routes';

export function createTestApp() {
    const app = express();

    app.use(cookieParser());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    app.use('/api/auth', authRouter);
    app.use('/api/events', eventsRouter);
    app.use('/api/stands', standsRouter);
    app.use('/api/stations', stationsRouter);
    app.use('/api/products', productsRouter);
    app.use('/api/users', usersRouter);
    app.use('/api/event-products', eventProductsRouter);
    app.use('/api/event-users', eventUsersRouter);
    app.use('/api/favorites', favoritesRouter);
    app.use('/api/orders', ordersRouter);
    app.use('/api/aliases', aliasesRouter);
    app.use('/api/resolve', resolveRouter);
    app.use('/api/roles', rolesRouter);
    app.use('/api/user-roles', userRolesRouter);
    app.use('/api/user-stations', userStationsRouter);
    app.use('/api/events/:eventId/photos', eventPhotosRouter);
    app.use('/api/events/:eventId/frames', eventFramesRouter);
    app.use('/api/frames', framesRouter);
    app.use('/api/pois', poisRouter);
    app.use('/api/usage-contracts', usageContractsRouter);

    return app;
}
