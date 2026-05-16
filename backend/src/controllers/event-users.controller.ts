import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { EventUserTransactionModel } from '../models/event-user-transaction.model';
import { EventUserModel } from '../models/event-user.model';
import { createEventUserTransaction, EventUserTransactionError } from '../services/event-user-transactions.service';

function isValidObjectId(value: string | undefined): value is string {
  return value !== undefined && Types.ObjectId.isValid(value);
}

function toEventUserResponse(eventUser: {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  balance?: number;
  isActive?: boolean;
  joinedAt?: Date;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: eventUser._id.toString(),
    eventId: eventUser.eventId.toString(),
    userId: eventUser.userId.toString(),
    balance: eventUser.balance ?? 0,
    isActive: eventUser.isActive ?? true,
    joinedAt: eventUser.joinedAt ?? null,
    notes: eventUser.notes ?? null,
    createdAt: eventUser.createdAt,
    updatedAt: eventUser.updatedAt
  };
}

function toEventUserTransactionResponse(transaction: {
  _id: Types.ObjectId;
  eventUserId: Types.ObjectId;
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  type: string;
  direction: string;
  amount: number;
  balanceAfter: number;
  description?: string | null;
  performedByUserId?: Types.ObjectId | null;
  referenceType?: string | null;
  referenceId?: Types.ObjectId | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: transaction._id.toString(),
    eventUserId: transaction.eventUserId.toString(),
    eventId: transaction.eventId.toString(),
    userId: transaction.userId.toString(),
    type: transaction.type,
    direction: transaction.direction,
    amount: transaction.amount,
    balanceAfter: transaction.balanceAfter,
    description: transaction.description ?? null,
    performedByUserId: transaction.performedByUserId?.toString() ?? null,
    referenceType: transaction.referenceType ?? null,
    referenceId: transaction.referenceId?.toString() ?? null,
    occurredAt: transaction.occurredAt,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt
  };
}

export async function createEventUser(req: Request, res: Response) {
  const { eventId, userId, balance, isActive, joinedAt, notes } = req.body;

  if (!isValidObjectId(eventId) || !isValidObjectId(userId)) {
    return res.status(400).json({
      message: 'Invalid eventId or userId'
    });
  }

  const existingEventUser = await EventUserModel.findOne({
    eventId,
    userId
  });

  if (existingEventUser) {
    return res.status(409).json({
      message: 'This user is already linked to the event'
    });
  }

  const eventUser = await EventUserModel.create({
    eventId,
    userId,
    balance: balance ?? 0,
    isActive: isActive ?? true,
    joinedAt: joinedAt ?? new Date(),
    notes: notes ?? null
  });

  return res.status(201).json({
    item: toEventUserResponse(eventUser)
  });
}

export async function listEventUsersByEvent(req: Request, res: Response) {
  const eventId = req.params.eventId;

  if (!isValidObjectId(eventId)) {
    return res.status(400).json({
      message: 'Invalid event id'
    });
  }

  const items = await EventUserModel.find({ eventId }).sort({ createdAt: -1 });

  return res.status(200).json({
    items: items.map(toEventUserResponse)
  });
}

export async function getEventUserById(req: Request, res: Response) {
  const eventUserId = req.params.eventUserId;

  if (!isValidObjectId(eventUserId)) {
    return res.status(400).json({
      message: 'Invalid event user id'
    });
  }

  const eventUser = await EventUserModel.findById(eventUserId);

  if (!eventUser) {
    return res.status(404).json({
      message: 'Event user not found'
    });
  }

  return res.status(200).json({
    item: toEventUserResponse(eventUser)
  });
}

export async function createWalletTransaction(req: Request, res: Response) {
  const eventUserId = req.params.eventUserId;

  if (!isValidObjectId(eventUserId)) {
    return res.status(400).json({
      message: 'Invalid event user id'
    });
  }

  try {
    const transactionInput = {
      eventUserId,
      type: req.body.type,
      direction: req.body.direction,
      amount: req.body.amount,
      description: req.body.description,
      performedByUserId: req.body.performedByUserId,
      referenceType: req.body.referenceType,
      referenceId: req.body.referenceId
    };

    if (req.body.occurredAt) {
      Object.assign(transactionInput, {
        occurredAt: new Date(req.body.occurredAt)
      });
    }

    const result = await createEventUserTransaction(transactionInput);

    return res.status(201).json({
      eventUser: toEventUserResponse(result.eventUser),
      transaction: toEventUserTransactionResponse(result.transaction)
    });
  } catch (error) {
    if (error instanceof EventUserTransactionError) {
      return res.status(400).json({
        message: error.message
      });
    }

    throw error;
  }
}

export async function listWalletTransactions(req: Request, res: Response) {
  const eventUserId = req.params.eventUserId;

  if (!isValidObjectId(eventUserId)) {
    return res.status(400).json({
      message: 'Invalid event user id'
    });
  }

  const eventUser = await EventUserModel.findById(eventUserId).select('_id');

  if (!eventUser) {
    return res.status(404).json({
      message: 'Event user not found'
    });
  }

  const items = await EventUserTransactionModel.find({ eventUserId }).sort({ occurredAt: -1, createdAt: -1 });

  return res.status(200).json({
    items: items.map(toEventUserTransactionResponse)
  });
}
