import { connectDatabase, disconnectDatabase } from '../config/database';
import { isValidObjectId, Types } from 'mongoose';
import { UserModel } from '../models/user.model';
import { RoleModel } from '../models/role.model';
import { UserRoleModel } from '../models/user-role.model';

async function run() {
  await connectDatabase();

  // ── 1. Remove orphan UserRole records for deleted event ──
  const deletedEventId = '6a4a10dd25738d52e33b28a0';
  if (isValidObjectId(deletedEventId)) {
    const result = await UserRoleModel.deleteMany({ eventId: new Types.ObjectId(deletedEventId) });
    console.log(`Rimossi ${result.deletedCount} UserRole orfani per evento ${deletedEventId}`);
  } else {
    console.log(`ID evento ${deletedEventId} non valido, salto pulizia`);
  }

  // ── 2. Find Giulia Ferri ──
  const user = await UserModel.findOne({
    email: 'giulia.ferri@streetfoodevents.test',
  });
  if (!user) {
    console.error('Utente giulia.ferri@streetfoodevents.test non trovato');
    process.exitCode = 1;
    return;
  }
  console.log(`Trovato utente: ${user.firstName} ${user.lastName} (${user.email}, _id: ${user._id})`);

  // ── 3. Find event-admin role ──
  const adminRole = await RoleModel.findOne({ slug: 'event-admin', scope: 'event' });
  if (!adminRole) {
    console.error('Ruolo event-admin (scope: event) non trovato nel DB');
    process.exitCode = 1;
    return;
  }
  console.log(`Trovato ruolo: ${adminRole.name} (slug: ${adminRole.slug}, _id: ${adminRole._id})`);

  // ── 4. Upsert event-admin for Notti Cilentane ──
  const eventId = new Types.ObjectId('6a4a12e19a3511a7a2bdcb04');
  await UserRoleModel.findOneAndUpdate(
    {
      userId: user._id,
      roleId: adminRole._id,
      eventId,
      standId: null,
    },
    {
      $set: {
        userId: user._id,
        roleId: adminRole._id,
        eventId,
        standId: null,
        assignedBy: user._id,
        isActive: true,
      },
    },
    { upsert: true, new: true },
  );

  console.log('Ruolo event-admin assegnato/riattivato per Giulia Ferri su Notti Cilentane');
  console.log('Fatto.');
}

void run()
  .catch((error) => {
    console.error('Script fallito:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
