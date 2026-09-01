import path from 'node:path';

export const config = {
    port: Number(process.env.PORT ?? 4200),
    mongodbUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/street-food-events-local?replicaSet=rs0',
    dbName: process.env.MONGODB_DB_NAME ?? 'street-food-events-local',
    machineId: process.env.MACHINE_ID ?? 'laptop-local-default',
    remoteUrl: process.env.REMOTE_URL ?? '',
    remoteToken: process.env.REMOTE_TOKEN ?? '',
    mediaDir: process.env.MEDIA_DIR ?? path.resolve(process.cwd(), '.local-assets'),
    assetsUrlPrefix: process.env.ASSETS_URL_PREFIX ?? '/assets'
};

export function bootMachineId(): string {
    if (config.machineId === 'laptop-local-default' && process.env.MACHINE_ID) {
        return process.env.MACHINE_ID;
    }
    return config.machineId;
}
