import http from 'node:http';

import { app } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';

const server = http.createServer(app);

async function startServer() {
    await connectDatabase();

    server.listen(env.PORT, () => {
        console.log(`Server listening on port ${env.PORT}`);
    });
}

async function shutdown(signal: string) {
    console.log(`${signal} received, shutting down`);

    server.close(async (serverError) => {
        if (serverError) {
            console.error(serverError);
            process.exit(1);
        }

        try {
            await disconnectDatabase();
            process.exit(0);
        } catch (databaseError) {
            console.error(databaseError);
            process.exit(1);
        }
    });
}

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});

void startServer().catch((error) => {
    console.error('Failed to start server');
    console.error(error);
    process.exit(1);
});