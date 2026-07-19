import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { EventUserModel } from '../models/event-user.model';
import { EventUserTransactionModel } from '../models/event-user-transaction.model';
import { EventModel } from '../models/event.model';
import { createEventUserTransaction, EventUserTransactionError } from '../services/event-user-transactions.service';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toTransactionResponse(t: {
    _id: Types.ObjectId;
    eventUserId: Types.ObjectId;
    eventId: Types.ObjectId;
    userId: Types.ObjectId | null;
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
}) {
    return {
        id: t._id.toString(),
        eventUserId: t.eventUserId.toString(),
        eventId: t.eventId.toString(),
        userId: t.userId?.toString() ?? null,
        type: t.type,
        direction: t.direction,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        description: t.description ?? null,
        performedByUserId: t.performedByUserId?.toString() ?? null,
        referenceType: t.referenceType ?? null,
        referenceId: t.referenceId?.toString() ?? null,
        occurredAt: t.occurredAt,
        createdAt: t.createdAt
    };
}

async function getEventFromParam(req: Request, res: Response) {
    const eventId = req.params.eventId;
    if (!isValidObjectId(eventId)) {
        res.status(400).json({ message: 'Invalid eventId' });
        return null;
    }
    const event = await EventModel.findById(eventId);
    if (!event) {
        res.status(404).json({ message: 'Event not found' });
        return null;
    }
    return { event, eventId };
}

async function listUsers(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const existing = await EventUserModel.findOne({ eventId: eventCtx.eventId, userId: null, isActive: true });
    if (!existing) {
        await EventUserModel.create({ eventId: eventCtx.eventId, userId: null, balance: 0 });
    }

    const eventUsers = await EventUserModel.find({ eventId: eventCtx.eventId, isActive: true })
        .populate('userId', 'firstName lastName email')
        .sort({ 'userId': 1 })
        .lean();

    const items = eventUsers.map((eu) => ({
        id: eu._id.toString(),
        eventId: eu.eventId.toString(),
        userId: eu.userId?._id?.toString() ?? null,
        firstName: (eu.userId as { firstName?: string })?.firstName ?? null,
        lastName: (eu.userId as { lastName?: string })?.lastName ?? null,
        email: (eu.userId as { email?: string })?.email ?? null,
        balance: eu.balance,
        isAnonymous: !eu.userId,
        isActive: eu.isActive,
        joinedAt: eu.joinedAt
    }));

    return res.status(200).json({ items });
}

async function getBalance(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const exchangeTypes = ['top-up', 'refund'];

    const { event, eventId: eventIdStr } = eventCtx;
    const resetAt = event.cashRegisterResetAt;
    const sinceResetMatch: Record<string, unknown> = {
        eventId: new Types.ObjectId(eventCtx.eventId),
        type: { $in: exchangeTypes }
    };
    if (resetAt) {
        sinceResetMatch.occurredAt = { $gt: resetAt };
    }

    const aggregation = await EventUserTransactionModel.aggregate([
        { $match: { eventId: new Types.ObjectId(eventCtx.eventId), type: { $in: exchangeTypes } } },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    const sinceResetAgg = await EventUserTransactionModel.aggregate([
        { $match: sinceResetMatch },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    let totalTopUp = 0;
    let totalRefund = 0;
    let topUpCount = 0;
    let refundCount = 0;
    let sinceResetTopUp = 0;
    let sinceResetRefund = 0;

    for (const row of aggregation) {
        if (row._id === 'top-up') {
            totalTopUp = row.total;
            topUpCount = row.count;
        } else if (row._id === 'refund') {
            totalRefund = row.total;
            refundCount = row.count;
        }
    }

    for (const row of sinceResetAgg) {
        if (row._id === 'top-up') {
            sinceResetTopUp = row.total;
        } else if (row._id === 'refund') {
            sinceResetRefund = row.total;
        }
    }

    return res.status(200).json({
        totalTopUp,
        totalRefund,
        netBalance: totalTopUp - totalRefund,
        topUpCount,
        refundCount,
        currencyName: eventCtx.event.currencyName,
        currencySymbol: eventCtx.event.currencySymbol,
        sinceResetTopUp,
        sinceResetRefund,
        netSinceReset: sinceResetTopUp - sinceResetRefund,
        lastResetAt: resetAt
    });
}

async function listTransactions(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const exchangeTypes = ['top-up', 'refund'];
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
        EventUserTransactionModel.find({ eventId: eventCtx.eventId, type: { $in: exchangeTypes } })
            .sort({ occurredAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        EventUserTransactionModel.countDocuments({ eventId: eventCtx.eventId, type: { $in: exchangeTypes } })
    ]);

    return res.status(200).json({
        items: transactions.map(toTransactionResponse),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
}

async function topUp(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { eventUserId, amount, description } = req.body;

    if (!eventUserId || !isValidObjectId(eventUserId)) {
        return res.status(400).json({ message: 'Valid eventUserId is required' });
    }

    if (!amount || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
    }

    const eventUser = await EventUserModel.findById(eventUserId);
    if (!eventUser || eventUser.eventId.toString() !== eventCtx.eventId) {
        return res.status(404).json({ message: 'Event user not found for this event' });
    }

    try {
        const result = await createEventUserTransaction({
            eventUserId: eventUser._id,
            type: 'top-up',
            direction: 'credit',
            amount,
            description: description?.trim() || 'Cambio: carica crediti (reale → virtuale)',
            performedByUserId: req.user!.id,
            referenceType: 'cambio',
            occurredAt: new Date()
        });

        return res.status(200).json({
            transaction: toTransactionResponse(result.transaction),
            newBalance: result.eventUser.balance
        });
    } catch (error) {
        if (error instanceof EventUserTransactionError) {
            return res.status(400).json({ message: error.message });
        }
        console.error('topUp error:', error);
        return res.status(500).json({ message: (error as Error).message || 'Internal server error' });
    }
}

async function refund(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { eventUserId, amount, description } = req.body;

    if (!eventUserId || !isValidObjectId(eventUserId)) {
        return res.status(400).json({ message: 'Valid eventUserId is required' });
    }

    if (!amount || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
    }

    const eventUser = await EventUserModel.findById(eventUserId);
    if (!eventUser || eventUser.eventId.toString() !== eventCtx.eventId) {
        return res.status(404).json({ message: 'Event user not found for this event' });
    }

    try {
        const result = await createEventUserTransaction({
            eventUserId: eventUser._id,
            type: 'refund',
            direction: 'debit',
            amount,
            description: description?.trim() || 'Cambio: rimborso crediti (virtuale → reale)',
            performedByUserId: req.user!.id,
            referenceType: 'cambio',
            occurredAt: new Date()
        });

        return res.status(200).json({
            transaction: toTransactionResponse(result.transaction),
            newBalance: result.eventUser.balance
        });
    } catch (error) {
        if (error instanceof EventUserTransactionError) {
            return res.status(400).json({ message: error.message });
        }
        console.error('refund error:', error);
        return res.status(500).json({ message: (error as Error).message || 'Internal server error' });
    }
}

async function resetCashRegister(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    eventCtx.event.cashRegisterResetAt = new Date();
    await eventCtx.event.save();

    return res.status(200).json({
        message: 'Cassa azzerata',
        cashRegisterResetAt: eventCtx.event.cashRegisterResetAt
    });
}

async function getCashRegisterReset(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    return res.status(200).json({
        cashRegisterResetAt: eventCtx.event.cashRegisterResetAt
    });
}

export const cambiosController = {
    listUsers,
    getBalance,
    listTransactions,
    topUp,
    refund,
    resetCashRegister,
    getCashRegisterReset
};
