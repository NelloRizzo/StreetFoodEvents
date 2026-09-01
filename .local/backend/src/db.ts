import mongoose from 'mongoose';
import { config } from './config';

let isConnected = false;

export async function connectDatabase() {
    if (isConnected) {
        return mongoose.connection;
    }
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongodbUri, {
        dbName: config.dbName,
        autoIndex: true
    });
    isConnected = true;
    return mongoose.connection;
}

export async function disconnectDatabase() {
    if (!isConnected) return;
    await mongoose.disconnect();
    isConnected = false;
}
