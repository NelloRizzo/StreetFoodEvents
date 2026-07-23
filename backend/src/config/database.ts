import mongoose from 'mongoose';

import { env, isDevelopment } from './env';

let isConnected = false;

export async function connectDatabase() {
  if (isConnected) {
    return mongoose.connection;
  }

  mongoose.set('strictQuery', true);

  const connection = await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    autoIndex: isDevelopment
  });

  const eventUsers = connection.connection.collection('eventusers');
  const indexes = await eventUsers.indexes();
  const hasOldIndex = indexes.some(
    (idx) => idx.key && (idx.key as Record<string, number>).eventId === 1 && (idx.key as Record<string, number>).userId === 1 && !idx.partialFilterExpression
  );
  if (hasOldIndex) {
    await eventUsers.dropIndex('eventId_1_userId_1');
    await eventUsers.createIndex(
      { eventId: 1, userId: 1 },
      { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } }
    );
  }

  isConnected = true;

  return connection.connection;
}

export async function disconnectDatabase() {
  if (!isConnected) {
    return;
  }

  await mongoose.disconnect();
  isConnected = false;
}