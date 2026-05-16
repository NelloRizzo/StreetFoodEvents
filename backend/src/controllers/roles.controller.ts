import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { RoleModel } from '../models/role.model';

function toRoleResponse(role: {
  _id: Types.ObjectId;
  name: string;
  description?: string | null;
  scope: string;
  slug: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: role._id.toString(),
    name: role.name,
    description: role.description ?? null,
    scope: role.scope,
    slug: role.slug,
    permissions: role.permissions,
    isSystem: role.isSystem,
    isActive: role.isActive,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export async function listRoles(req: Request, res: Response) {
  const filter: Record<string, unknown> = {};
  if (req.query.scope) filter.scope = req.query.scope;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const items = await RoleModel.find(filter).sort({ scope: 1, name: 1 });
  return res.status(200).json({ items: items.map(toRoleResponse) });
}
