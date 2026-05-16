import type { Request, Response } from 'express';
import * as argon2 from 'argon2';
import * as qrcode from 'qrcode';

import { env } from '../config/env';
import { RoleModel } from '../models/role.model';
import { SessionModel } from '../models/session.model';
import { StandModel } from '../models/stand.model';
import { StationModel } from '../models/station.model';
import { UserModel } from '../models/user.model';
import { UserRoleModel } from '../models/user-role.model';
import { UserStationModel } from '../models/user-station.model';
import { deleteImage } from '../services/cloudinary-upload.service';
import {
  clearSessionCookie,
  generateSessionToken,
  getSessionExpiryDate,
  hashSessionToken,
  setSessionCookie
} from '../utils/session';

async function getUserAdminInfo(userId: string) {
  const platformRoleIds = await RoleModel.find({ scope: 'platform' }).distinct('_id');
  const eventRoleIds = await RoleModel.find({ scope: 'event' }).distinct('_id');

  const userRoles = await UserRoleModel.find({
    userId,
    roleId: { $in: [...platformRoleIds, ...eventRoleIds] },
    isActive: true
  });

  const isPlatformAdmin = userRoles.some((ur) =>
    platformRoleIds.some((id) => id.toString() === ur.roleId.toString())
  );

  const eventScopedRoles = userRoles.filter((ur) =>
    eventRoleIds.some((id) => id.toString() === ur.roleId.toString()) && ur.eventId
  );

  const adminEventIds = [...new Set(eventScopedRoles.map((ur) => ur.eventId!.toString()))];

  return { isPlatformAdmin, isEventAdmin: eventScopedRoles.length > 0, adminEventIds };
}

async function toAuthUserResponse(user: {
  _id: { toString(): string };
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  avatar?: unknown | null;
}) {
  const adminInfo = await getUserAdminInfo(user._id.toString());
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone ?? null,
    avatar: user.avatar ?? null,
    isAdmin: adminInfo.isPlatformAdmin || adminInfo.isEventAdmin,
    isPlatformAdmin: adminInfo.isPlatformAdmin,
    adminEventIds: adminInfo.adminEventIds,
  };
}

export async function register(req: Request, res: Response) {
  const firstName = typeof req.body.firstName === 'string' ? req.body.firstName.trim() : '';
  const lastName = typeof req.body.lastName === 'string' ? req.body.lastName.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({
      message: 'FirstName, lastName, email and password are required'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters'
    });
  }

  const existingUser = await UserModel.findOne({ email });

  if (existingUser) {
    return res.status(409).json({
      message: 'A user with this email already exists'
    });
  }

  const passwordHash = await argon2.hash(password);

  const user = await UserModel.create({
    firstName,
    lastName,
    email,
    passwordHash,
    isActive: true
  });

  const userCount = await UserModel.countDocuments();
  if (userCount === 1) {
    const platformAdminRole = await RoleModel.findOne({ slug: 'platform-admin', scope: 'platform' });
    if (platformAdminRole) {
      await UserRoleModel.create({
        userId: user._id,
        roleId: platformAdminRole._id,
        assignedBy: user._id,
        isActive: true
      });
    }
  }

  const sessionToken = generateSessionToken();
  const expiresAt = getSessionExpiryDate();

  await SessionModel.create({
    userId: user._id,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
    lastActivityAt: new Date(),
    userAgent: req.get('user-agent') ?? null,
    ipAddress: req.ip ?? null
  });

  user.lastLoginAt = new Date();
  await user.save();

  setSessionCookie(res, sessionToken, expiresAt);

  return res.status(201).json({
    user: await toAuthUserResponse(user)
  });
}

export async function login(req: Request, res: Response) {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required'
    });
  }

  const user = await UserModel.findOne({
    email,
    isActive: true
  }).select('+passwordHash');

  if (!user) {
    return res.status(401).json({
      message: 'Invalid credentials'
    });
  }

  const isPasswordValid = await argon2.verify(user.passwordHash, password);

  if (!isPasswordValid) {
    return res.status(401).json({
      message: 'Invalid credentials'
    });
  }

  const sessionToken = generateSessionToken();
  const expiresAt = getSessionExpiryDate();

  await SessionModel.create({
    userId: user._id,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
    lastActivityAt: new Date(),
    userAgent: req.get('user-agent') ?? null,
    ipAddress: req.ip ?? null
  });

  user.lastLoginAt = new Date();
  await user.save();

  setSessionCookie(res, sessionToken, expiresAt);

  return res.status(200).json({
    user: await toAuthUserResponse(user)
  });
}

export async function logout(req: Request, res: Response) {
  const sessionToken = req.cookies?.[env.AUTH_SESSION_COOKIE_NAME];

  if (typeof sessionToken === 'string' && sessionToken) {
    await SessionModel.updateOne(
      { tokenHash: hashSessionToken(sessionToken) },
      {
        $set: {
          isRevoked: true,
          lastActivityAt: new Date()
        }
      }
    );
  }

  clearSessionCookie(res);

  return res.status(200).json({
    success: true
  });
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication required'
    });
  }

  const user = await UserModel.findOne({
    _id: req.user.id,
    isActive: true
  }).select('_id firstName lastName email avatar');

  if (!user) {
    return res.status(401).json({
      message: 'Authentication required'
    });
  }

  return res.status(200).json({
    user: await toAuthUserResponse(user)
  });
}

export async function meQrCode(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication required'
    });
  }

  const qrDataUrl = await qrcode.toDataURL(req.user.id, {
    width: 400,
    margin: 2,
    color: {
      dark: '#264137',
      light: '#ffffff'
    }
  });

  return res.status(200).json({
    qrCode: qrDataUrl
  });
}

export async function updateMe(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const user = await UserModel.findById(req.user.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  let hasChanges = false;

  if (req.body.firstName !== undefined) { user.firstName = req.body.firstName; hasChanges = true; }
  if (req.body.lastName !== undefined) { user.lastName = req.body.lastName; hasChanges = true; }
  if (req.body.phone !== undefined) { user.phone = req.body.phone; hasChanges = true; }
  if (req.body.avatar !== undefined) { user.avatar = req.body.avatar; hasChanges = true; }

  // Avatar replacement — delete old from Cloudinary
  if (req.body.avatar !== undefined && user.avatar && typeof user.avatar === 'object' && 'publicId' in (user.avatar as Record<string, unknown>)) {
    const oldPublicId = (user.avatar as { publicId: string }).publicId;
    if (oldPublicId) {
      await deleteImage(oldPublicId).catch(() => {});
    }
  }

  // Password change
  if (req.body.currentPassword && req.body.newPassword) {
    const userWithHash = await UserModel.findById(req.user.id).select('+passwordHash');

    if (!userWithHash) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isValid = await argon2.verify(userWithHash.passwordHash, req.body.currentPassword);

    if (!isValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (req.body.newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    user.passwordHash = await argon2.hash(req.body.newPassword);
    hasChanges = true;
  }

  if (!hasChanges) {
    return res.status(400).json({ message: 'No changes provided' });
  }

  await user.save();

  const updatedUser = await UserModel.findById(req.user.id);

  return res.status(200).json({
    user: await toAuthUserResponse(updatedUser!)
  });
}

export async function getMyRoles(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const userId = req.user.id;

  const userRoles = await UserRoleModel.find({ userId, isActive: true })
    .populate<{ roleId: { _id: string; slug: string; scope: string; name: string } }>('roleId', 'slug scope name');

  const roles = userRoles.map((ur) => ({
    roleId: ur.roleId._id.toString(),
    slug: ur.roleId.slug,
    scope: ur.roleId.scope,
    name: ur.roleId.name,
    eventId: ur.eventId?.toString() ?? null,
    standId: ur.standId?.toString() ?? null,
  }));

  return res.status(200).json({
    isPlatformAdmin: roles.some((r) => r.scope === 'platform'),
    isEventAdmin: roles.some((r) => r.scope === 'event'),
    roles,
  });
}

export async function getMyStands(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const userId = req.user.id;

  const userStations = await UserStationModel.find({ userId, isActive: true });
  const stationIds = userStations.map((us) => us.stationId);

  const stations = stationIds.length > 0
    ? await StationModel.find({ _id: { $in: stationIds } }).populate('standId', 'name')
    : [];

  const standRoleIds = await RoleModel.find({ scope: 'stand' }).distinct('_id');
  const userRoles = await UserRoleModel.find({
    userId,
    roleId: { $in: standRoleIds },
    standId: { $ne: null },
    isActive: true
  });
  const roleStandIds = [...new Set(userRoles.map((ur) => ur.standId!.toString()))];

  const roleStands = roleStandIds.length > 0
    ? await StandModel.find({ _id: { $in: roleStandIds } })
    : [];

  return res.status(200).json({
    stands: roleStands.map((s) => ({ id: s._id.toString(), name: s.name })),
    stations: stations.map((s) => {
      const sDoc = s as unknown as { _id: { toString(): string }; name: string; standId: { _id: { toString(): string }; name: string } | null };
      return {
        id: sDoc._id.toString(),
        name: sDoc.name,
        standId: sDoc.standId?._id?.toString() ?? null,
        standName: sDoc.standId?.name ?? null,
      };
    }),
  });
}
