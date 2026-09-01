import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';

import { config } from './config';
import { connectDatabase } from './db';
import { ordersRouter } from './routes/orders.routes';
import { catalogRouter } from './routes/catalog.routes';
import { clientsRouter } from './routes/clients.routes';
import { syncRouter } from './routes/sync.routes';

const app = express();

app.disable('x-powered-by');
app.use(
    cors({
        origin: true,
        credentials: true
    })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
    return res.status(200).json({ status: 'ok', machineId: config.machineId });
});

app.use('/api/orders', ordersRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/sync', syncRouter);

const publicDir = path.resolve(process.cwd(), 'public');
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('*', (_req, res) => {
        res.sendFile(path.join(publicDir, 'index.html'));
    });
}

app.use((req, res) => {
    return res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Internal server error' });
});

async function startServer() {
    await connectDatabase();
    app.listen(config.port, () => {
        console.log(`[local] Server listening on port ${config.port} (machine: ${config.machineId})`);
    });
}

void startServer().catch((error) => {
    console.error('Failed to start server');
    console.error(error);
    process.exit(1);
});
