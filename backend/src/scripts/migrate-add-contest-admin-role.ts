import { RoleModel } from '../models/role.model';
import { connectDatabase, disconnectDatabase } from '../config/database';

const CONTEST_ADMIN_PERMISSIONS = [
    'contests:read',
    'contests:create',
    'contests:update',
    'contests:delete',
    'contest-pois:read',
    'contest-pois:create',
    'contest-pois:update',
    'contest-pois:delete',
];

async function run() {
    await connectDatabase();

    const role = await RoleModel.findOneAndUpdate(
        { slug: 'contest-admin', scope: 'event' },
        {
            $set: {
                name: 'Contest Admin',
                slug: 'contest-admin',
                scope: 'event',
                description: 'Gestisce contest e POI di contest per l\'evento.',
                permissions: CONTEST_ADMIN_PERMISSIONS,
                isSystem: true,
                isActive: true,
            },
        },
        { upsert: true, new: true },
    );

    console.log(`Ruolo "${role.name}" (${role.slug}) creato/aggiornato con successo.`);
    console.log(`ID: ${role._id}`);
    console.log(`Scope: ${role.scope}`);
    console.log(`Permessi: ${role.permissions.join(', ')}`);
}

void run()
    .catch((error) => {
        console.error('Migrazione fallita:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await disconnectDatabase();
    });
