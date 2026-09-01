#!/usr/bin/env node
// setup:local — avvia l'app locale in sviluppo (senza Docker per l'app).
// Usa un MongoDB dedicato via docker (docker-compose.db.yml), fa il seed e
// lancia backend (tsx watch) + frontend (vite dev) in parallelo.
//
// Uso:  node scripts/setup-local.mjs     (o `npm run setup:local` da .local/)
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = path.join(root, 'backend');
const frontendDir = path.join(root, 'frontend');

const MONGO_PORT = 27017;

function run(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: opts.quiet ? 'ignore' : 'inherit', shell: true });
        child.on('close', (code) => (code === 0 || opts.allowFail ? resolve(code) : reject(new Error(`${cmd} exited ${code}`))));
        child.on('error', reject);
    });
}

function tcpOpen(port) {
    return new Promise((resolve) => {
        const socket = net.connect(port, '127.0.0.1');
        socket.setTimeout(1500);
        socket.once('connect', () => socket.destroy() || resolve(true));
        socket.once('error', () => resolve(false));
        socket.once('timeout', () => socket.destroy() || resolve(false));
    });
}

// Esegue un comando inside: ovvero esegue tsx inline per lanciare il seed, e
// per verificare che il replica set sia primario usa un one-liner tsx con mongoose
// del backend. Alternativamente, il check di PRIMARY usa la stessa seed:first.
async function ensureMongo() {
    console.log('[setup:local] Assicura MongoDB (replica set rs0)...');
    if (!(await tcpOpen(MONGO_PORT))) {
        await run('docker', ['compose', '-f', 'docker-compose.db.yml', 'up', '-d']);
    } else {
        console.log('[setup:local] MongoDB già in ascolto su 127.0.0.1:27017');
    }

    console.log('[setup:local] Attende PRIMARY di MongoDB...');
    const deadline = Date.now() + 90000;
    for (;;) {
        try {
            if (await isWritablePrimary()) {
                console.log('[setup:local] MongoDB PRIMARY pronto');
                return;
            }
        } catch {
            // not ready yet
        }
        if (Date.now() > deadline) throw new Error('Timeout: MongoDB non è diventato PRIMARY');
        await new Promise((r) => setTimeout(r, 1500));
    }
}

// Reusing backend mongoose via tsx to check the replica-set primary status.
function isWritablePrimary() {
    return run(
        'npx',
        [
            'tsx',
            '-e',
            `import mongoose from 'mongoose';
             const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/street-food-events-local?replicaSet=rs0';
             try {
               const c = await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
               const hello = await c.connection.db.admin().command({ hello: 1 });
               await mongoose.disconnect();
               process.exit(hello.isWritablePrimary ? 0 : 1);
             } catch { process.exit(1); }`
        ],
        { cwd: backendDir, quiet: true, allowFail: true }
    )
        .then(() => true)
        .catch(() => false);
}

async function seedDatabase() {
    console.log('[setup:local] Esegue seed...');
    await run('npm', ['run', 'seed'], { cwd: backendDir });
}

async function startDev() {
    console.log('[setup:local] Avvia backend (:4000) e frontend (:5173)...');
    const backend = spawn('npm', ['run', 'dev'], { cwd: backendDir, shell: true, stdio: 'inherit' });
    const frontend = spawn('npm', ['run', 'dev'], { cwd: frontendDir, shell: true, stdio: 'inherit' });

    const shutdown = () => {
        backend.kill('SIGTERM');
        frontend.kill('SIGTERM');
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    backend.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            console.error('[setup:local] Backend terminato in modo anomalo, chiusura');
            shutdown();
        }
    });
}

async function main() {
    try {
        await ensureMongo();
        await seedDatabase();
        await startDev();
    } catch (error) {
        console.error('[setup:local] Errore:', error.message);
        process.exit(1);
    }
}

void main();
