import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads a `.env` file into process.env without any external dependency, unless
 * the variable is already defined in the environment (real env wins, so
 * docker-compose and shell exports take precedence).
 */
function loadDotenv(candidates: string[]) {
    for (const candidate of candidates) {
        try {
            const content = fs.readFileSync(candidate, 'utf8');
            for (const rawLine of content.split(/\r?\n/)) {
                const line = rawLine.trim();
                if (!line || line.startsWith('#')) continue;
                const eq = line.indexOf('=');
                if (eq === -1) continue;
                const key = line.slice(0, eq).trim();
                const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
                if (key && process.env[key] === undefined) {
                    process.env[key] = value;
                }
            }
            return;
        } catch {
            // try next candidate
        }
    }
}

const backendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
loadDotenv([
    path.resolve(process.cwd(), '.env'),
    path.resolve(backendRoot, '.env'),
    path.resolve(backendRoot, '..', '.env')
]);

export const config = {
    port: Number(process.env.PORT ?? 4000),
    mongodbUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/street-food-events-local?replicaSet=rs0',
    dbName: process.env.MONGODB_DB_NAME ?? 'street-food-events-local',
    machineId: process.env.MACHINE_ID ?? 'laptop-local-default',
    remoteUrl: process.env.REMOTE_URL ?? 'https://streetfoodevents-api.onrender.com/api',
    remoteToken: process.env.REMOTE_TOKEN ?? '',
    mediaDir: process.env.MEDIA_DIR ?? path.resolve(process.cwd(), '.local-assets'),
    assetsUrlPrefix: process.env.ASSETS_URL_PREFIX ?? '/assets'
};
