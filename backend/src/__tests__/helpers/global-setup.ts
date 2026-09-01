import { MongoMemoryReplSet } from 'mongodb-memory-server';

const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ args: ['--setParameter', 'transactionLifetimeLimitSeconds=60'] }]
});

const uri = replSet.getUri();
process.env.MONGODB_URI = uri;
process.env.MONGODB_DB_NAME = 'test';
process.env.SYNC_API_TOKEN = process.env.SYNC_API_TOKEN ?? 'test-sync-token';

export async function teardown() {
    await replSet.stop();
}
