import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { RoleModel } from '../models/role.model';
import { UserRoleModel } from '../models/user-role.model';

function isValidObjectId(value: string | undefined): value is string {
  return value !== undefined && Types.ObjectId.isValid(value);
}

function toUserRoleResponse(ur: {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  roleId: Types.ObjectId;
  eventId?: Types.ObjectId | null;
  standId?: Types.ObjectId | null;
  assignedBy?: Types.ObjectId | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: ur._id.toString(),
    userId: ur.userId.toString(),
    roleId: ur.roleId.toString(),
    eventId: ur.eventId?.toString() ?? null,
    standId: ur.standId?.toString() ?? null,
    assignedBy: ur.assignedBy?.toString() ?? null,
    startsAt: ur.startsAt ?? null,
    endsAt: ur.endsAt ?? null,
    isActive: ur.isActive,
    createdAt: ur.createdAt,
    updatedAt: ur.updatedAt,
  };
}

export async function listUserRoles(req: Request, res: Response) {
  const filter: Record<string, unknown> = {};
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.roleId) filter.roleId = req.query.roleId;
  if (req.query.eventId) filter.eventId = req.query.eventId;
  if (req.query.standId) filter.standId = req.query.standId;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const docs = await UserRoleModel.find(filter)
    .populate('userId', 'firstName lastName email')
    .populate('roleId', 'name slug scope')
    .sort({ createdAt: -1 });

  const items = docs.map((d) => ({
    id: d._id.toString(),
    userId: d.userId,
    roleId: d.roleId,
    eventId: d.eventId?.toString() ?? null,
    standId: d.standId?.toString() ?? null,
    assignedBy: d.assignedBy?.toString() ?? null,
    isActive: d.isActive,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    startsAt: d.startsAt ?? null,
    endsAt: d.endsAt ?? null,
  }));

  return res.status(200).json({ items });
}

export async function createUserRole(req: Request, res: Response) {
  const { userId, roleId, eventId, standId, assignedBy, startsAt, endsAt } = req.body;

  if (!isValidObjectId(userId)) {
    return res.status(400).json({ message: 'Invalid or missing userId' });
  }
  if (!isValidObjectId(roleId)) {
    return res.status(400).json({ message: 'Invalid or missing roleId' });
  }

  const role = await RoleModel.findById(roleId);
  if (!role) {
    return res.status(404).json({ message: 'Role not found' });
  }

  if (role.scope === 'event' && !isValidObjectId(eventId)) {
    return res.status(400).json({ message: 'eventId is required for event-scoped roles' });
  }
  if (role.scope === 'stand' && !isValidObjectId(standId)) {
    return res.status(400).json({ message: 'standId is required for stand-scoped roles' });
  }

  const existing = await UserRoleModel.findOne({
    userId, roleId,
    eventId: eventId ?? null,
    standId: standId ?? null,
  });

  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      if (assignedBy) existing.assignedBy = assignedBy;
      if (startsAt) existing.startsAt = startsAt;
      if (endsAt) existing.endsAt = endsAt;
      await existing.save();
      return res.status(200).json({ item: toUserRoleResponse(existing) });
    }
    return res.status(409).json({ message: 'This user already has this role assignment' });
  }

  const item = await UserRoleModel.create({
    userId, roleId,
    eventId: eventId ?? null,
    standId: standId ?? null,
    assignedBy: assignedBy ?? null,
    startsAt: startsAt ?? null,
    endsAt: endsAt ?? null,
    isActive: true,
  });

  return res.status(201).json({ item: toUserRoleResponse(item) });
}

export async function deleteUserRole(req: Request, res: Response) {
  const { userRoleId } = req.params;
  if (!isValidObjectId(userRoleId)) {
    return res.status(400).json({ message: 'Invalid userRole id' });
  }

  const item = await UserRoleModel.findByIdAndDelete(userRoleId);
  if (!item) {
    return res.status(404).json({ message: 'User role not found' });
  }

  return res.status(204).send();
}

export async function toggleUserRole(req: Request, res: Response) {
  const { userRoleId } = req.params;
  if (!isValidObjectId(userRoleId)) {
    return res.status(400).json({ message: 'Invalid userRole id' });
  }

  const item = await UserRoleModel.findById(userRoleId);
  if (!item) {
    return res.status(404).json({ message: 'User role not found' });
  }

  item.isActive = !item.isActive;
  await item.save();

  return res.status(200).json({ item: toUserRoleResponse(item) });
}
