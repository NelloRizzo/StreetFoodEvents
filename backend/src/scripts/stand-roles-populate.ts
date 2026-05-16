import { UserRoleModel } from '../models/user-role.model';
import type { SeedRolesResult } from './roles-populate';
import type { SeedStandsResult } from './stands-populate';
import type { SeedUsersResult } from './users-populate';

export async function populateStandRoles(
  seedUsers: SeedUsersResult,
  seedRoles: SeedRolesResult,
  seedStands: SeedStandsResult,
) {
  // Assign Marco (cashier) to Gourmet Street stand
  await UserRoleModel.findOneAndUpdate(
    {
      userId: seedUsers.cashierUser._id.toString(),
      roleId: seedRoles.cashierRole._id.toString(),
      eventId: null,
      standId: seedStands.gourmetStand._id.toString(),
    },
    {
      $set: {
        userId: seedUsers.cashierUser._id.toString(),
        roleId: seedRoles.cashierRole._id.toString(),
        eventId: null,
        standId: seedStands.gourmetStand._id.toString(),
        assignedBy: seedUsers.adminUser._id.toString(),
        isActive: true,
      },
    },
    { upsert: true, new: true },
  );

  // Assign Sara (kitchen) to Gourmet Street stand
  await UserRoleModel.findOneAndUpdate(
    {
      userId: seedUsers.kitchenUser._id.toString(),
      roleId: seedRoles.kitchenRole._id.toString(),
      eventId: null,
      standId: seedStands.gourmetStand._id.toString(),
    },
    {
      $set: {
        userId: seedUsers.kitchenUser._id.toString(),
        roleId: seedRoles.kitchenRole._id.toString(),
        eventId: null,
        standId: seedStands.gourmetStand._id.toString(),
        assignedBy: seedUsers.adminUser._id.toString(),
        isActive: true,
      },
    },
    { upsert: true, new: true },
  );
}
