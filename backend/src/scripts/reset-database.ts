import { connectDatabase, disconnectDatabase } from '../config/database';
import { UserModel } from '../models/user.model';
import * as argon2 from 'argon2';
import mongoose from 'mongoose';

async function run() {
    const passwordArg = process.argv.find(a => a.startsWith('--password=') || a.startsWith('-p='));
    const adminPassword = passwordArg?.split('=')[1] ?? process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        console.error('Usage: npm run reset:database -- --password=<password>');
        console.error('   or:  set ADMIN_PASSWORD=<password> environment variable');
        process.exit(1);
    }

    if (adminPassword.length < 8) {
        console.error('Password must be at least 8 characters long');
        process.exit(1);
    }

    await connectDatabase();

    const db = mongoose.connection.db;
    if (!db) {
        throw new Error('Database connection not available');
    }

    const collections = await db.listCollections().toArray();
    for (const col of collections) {
        await db.dropCollection(col.name);
    }

    const passwordHash = await argon2.hash(adminPassword);

    const admin = await UserModel.create({
        firstName: 'Admin',
        lastName: 'System',
        email: 'admin@streetfoodevents.test',
        phone: '+39 000 000 0000',
        passwordHash,
        isActive: true,
    });

    console.log('Database reset successfully');
    console.log('');
    console.log('Admin user created:');
    console.log('  Email:    admin@streetfoodevents.test');
    console.log('  Password: ' + adminPassword);
    console.log('  ID:       ' + admin._id.toString());
}

void run()
    .catch((error) => {
        console.error('Database reset failed');
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await disconnectDatabase();
    });
