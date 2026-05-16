import { MongoMemoryReplSet } from 'mongodb-memory-server';

const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ args: ['--setParameter', 'transactionLifetimeLimitSeconds=60'] }]
});

const uri = replSet.getUri();
process.env.MONGODB_URI = uri;
process.env.MONGODB_DB_NAME = 'test';

export async function teardown() {
    await replSet.stop();
}
