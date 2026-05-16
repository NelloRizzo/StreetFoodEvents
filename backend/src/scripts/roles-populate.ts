import { permissions } from '../models/std-permissions';
import { RoleModel } from '../models/role.model';
import { UserRoleModel } from '../models/user-role.model';
import type { SeedUsersResult } from './users-populate';

async function upsertRole(input: {
  name: string;
  slug: string;
  scope: 'platform' | 'event' | 'stand';
  description: string;
  permissions: readonly string[];
}) {
  return RoleModel.findOneAndUpdate(
    { slug: input.slug, scope: input.scope },
    {
      $set: {
        name: input.name,
        slug: input.slug,
        scope: input.scope,
        description: input.description,
        permissions: [...input.permissions],
        isSystem: true,
        isActive: true,
      },
    },
    {
      new: true,
      upsert: true,
    },
  );
}

export async function populateRoles(seedUsers: SeedUsersResult) {
  const platformAdminRole = await upsertRole({
    name: 'Platform Admin',
    slug: 'platform-admin',
    scope: 'platform',
    description: 'Gestisce l’intera piattaforma e tutti gli eventi.',
    permissions,
  });

  const eventAdminRole = await upsertRole({
    name: 'Event Admin',
    slug: 'event-admin',
    scope: 'event',
    description: 'Coordina utenti, eventi e wallet per un singolo evento.',
    permissions: permissions.filter((permission) => permission !== 'roles:disable'),
  });

  const cashierRole = await upsertRole({
    name: 'Cashier',
    slug: 'cashier',
    scope: 'stand',
    description: 'Gestisce vendite e operazioni di cassa.',
    permissions: ['orders:read', 'orders:create', 'orders:update', 'payments:read', 'payments:create'],
  });

  const kitchenRole = await upsertRole({
    name: 'Kitchen',
    slug: 'kitchen',
    scope: 'stand',
    description: 'Gestisce l’operativita della cucina e l’avanzamento ordini.',
    permissions: ['menu:read', 'orders:read', 'orders:update'],
  });

  if (!platformAdminRole || !eventAdminRole || !cashierRole || !kitchenRole) {
    throw new Error('Failed to seed roles');
  }

  await UserRoleModel.findOneAndUpdate(
    {
      userId: seedUsers.adminUser._id,
      roleId: platformAdminRole._id,
      eventId: null,
      standId: null,
    },
    {
      $set: {
        userId: seedUsers.adminUser._id,
        roleId: platformAdminRole._id,
        eventId: null,
        standId: null,
        assignedBy: seedUsers.adminUser._id,
        isActive: true,
      },
    },
    { upsert: true, new: true },
  );

  return {
    platformAdminRole,
    eventAdminRole,
    cashierRole,
    kitchenRole,
  };
}

export type SeedRolesResult = Awaited<ReturnType<typeof populateRoles>>;
