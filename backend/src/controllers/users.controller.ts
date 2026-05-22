import * as argon2 from 'argon2';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { UserModel } from '../models/user.model';

function isValidObjectId(value: string) {
  return Types.ObjectId.isValid(value);
}

function toUserResponse(user: {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  avatar?: unknown | null;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone ?? null,
    avatar: user.avatar ?? null,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function listUsers(_req: Request, res: Response) {
  const users = await UserModel.find()
    .sort({ createdAt: -1 })
    .select('-passwordHash');

  return res.status(200).json({
    items: users.map(toUserResponse)
  });
}

export async function getUserById(req: Request, res: Response) {
  const { userId } = req.params;

  if (!userId || !isValidObjectId(userId)) {
    return res.status(400).json({
      message: 'Invalid user id'
    });
  }

  const user = await UserModel.findById(userId).select('-passwordHash');

  if (!user) {
    return res.status(404).json({
      message: 'User not found'
    });
  }

  return res.status(200).json({
    item: toUserResponse(user)
  });
}

export async function createUser(req: Request, res: Response) {
  const { firstName, lastName, email, password, phone, avatar, isActive } = req.body;

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters'
    });
  }

  const existingUser = await UserModel.findOne({
    email: String(email).toLowerCase().trim()
  });

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
    phone: phone ?? null,
    avatar: avatar ?? null,
    isActive: isActive ?? true
  });

  return res.status(201).json({
    item: toUserResponse(user)
  });
}

export async function updateUser(req: Request, res: Response) {
  const { userId } = req.params;

  if (!userId || !isValidObjectId(userId)) {
    return res.status(400).json({
      message: 'Invalid user id'
    });
  }

  const { firstName, lastName, email, phone, avatar, isActive, lastLoginAt } = req.body;

  const user = await UserModel.findById(userId);

  if (!user) {
    return res.status(404).json({
      message: 'User not found'
    });
  }

  if (email && email !== user.email) {
    const existingUser = await UserModel.findOne({
      email: String(email).toLowerCase().trim(),
      _id: { $ne: user._id }
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'A user with this email already exists'
      });
    }
  }

  if (firstName !== undefined) {
    user.firstName = firstName;
  }

  if (lastName !== undefined) {
    user.lastName = lastName;
  }

  if (email !== undefined) {
    user.email = email;
  }

  if (phone !== undefined) {
    user.phone = phone;
  }

  if (avatar !== undefined) {
    user.avatar = avatar;
  }

  if (isActive !== undefined) {
    user.isActive = isActive;
  }

  if (lastLoginAt !== undefined) {
    user.lastLoginAt = lastLoginAt;
  }

  if (req.body.password && typeof req.body.password === 'string') {
    if (req.body.password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    user.passwordHash = await argon2.hash(req.body.password);
  }

  await user.save();

  return res.status(200).json({
    item: toUserResponse(user)
  });
}

export async function deleteUser(req: Request, res: Response) {
  const { userId } = req.params;

  if (!userId || !isValidObjectId(userId)) {
    return res.status(400).json({
      message: 'Invalid user id'
    });
  }

  const user = await UserModel.findByIdAndDelete(userId);

  if (!user) {
    return res.status(404).json({
      message: 'User not found'
    });
  }

  return res.status(204).send();
}