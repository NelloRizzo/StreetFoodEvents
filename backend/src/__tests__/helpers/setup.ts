import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach } from 'vitest';

const collectionsToClear = [
    'users',
    'events',
    'stands',
    'stations',
    'products',
    'eventproducts',
    'eventusers',
    'eventusertransactions',
    'orders',
    'counters',
    'favorites',
    'roles',
    'userroles',
    'userstations',
    'sessions',
    'aliases',
    'eventphotos',
    'eventframes',
    'pois',
    'usagecontracts'
];

beforeAll(async () => {
    mongoose.set('strictQuery', true);
    await mongoose.connect(process.env.MONGODB_URI!, {
        dbName: process.env.MONGODB_DB_NAME ?? 'test',
        autoIndex: true
    });
    try {
        await mongoose.connection.syncIndexes();
    } catch {
        // Some models (e.g. Favorite with $not partial filter) may have
        // index compatibility issues with the test MongoDB version.
        // Indexes will still be auto-created per-model when first used.
    }
});

beforeEach(async () => {
    const promises = collectionsToClear.map((name) =>
        mongoose.connection.db!.collection(name).deleteMany({})
    );
    await Promise.all(promises);
});

afterAll(async () => {
    await mongoose.disconnect();
});
