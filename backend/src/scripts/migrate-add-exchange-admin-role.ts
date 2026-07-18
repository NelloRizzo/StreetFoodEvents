import { RoleModel } from '../models/role.model';
import { connectDatabase, disconnectDatabase } from '../config/database';

const EXCHANGE_ADMIN_PERMISSIONS = [
    'exchanges:read',
    'exchanges:create',
    'payments:read',
    'payments:create',
    'payments:refund',
];

async function run() {
    await connectDatabase();

    const role = await RoleModel.findOneAndUpdate(
        { slug: 'exchange-admin', scope: 'event' },
        {
            $set: {
                name: 'Exchange Admin',
                slug: 'exchange-admin',
                scope: 'event',
                description: 'Gestisce il cambio valuta (top-up e refund) per un evento.',
                permissions: EXCHANGE_ADMIN_PERMISSIONS,
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
