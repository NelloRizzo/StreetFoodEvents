import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { EventUserModel } from '../models/event-user.model';
import { EventUserTransactionModel } from '../models/event-user-transaction.model';
import { EventModel } from '../models/event.model';
import { UserModel } from '../models/user.model';
import { createEventUserTransaction, EventUserTransactionError } from '../services/event-user-transactions.service';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toTransactionResponse(t: {
    _id: Types.ObjectId;
    eventUserId: Types.ObjectId;
    eventId: Types.ObjectId;
    userId?: Types.ObjectId | null;
    type: string;
    direction: string;
    amount: number;
    realAmount?: number | null;
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
        realAmount: t.realAmount ?? null,
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
        firstName: (eu.userId as { firstName?: string })?.firstName ?? (!eu.userId && (eu as { displayName?: string }).displayName ? (eu as { displayName?: string }).displayName! : null),
        lastName: (eu.userId as { lastName?: string })?.lastName ?? null,
        email: (eu.userId as { email?: string })?.email ?? null,
        balance: eu.balance,
        isAnonymous: !eu.userId,
        isActive: eu.isActive,
        joinedAt: eu.joinedAt,
        displayName: (eu as { displayName?: string }).displayName ?? null
    }));

    return res.status(200).json({ items });
}

async function getBalance(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const currentUserId = req.user!.id;
    const exchangeTypes = ['top-up', 'refund'];
    const eventIdObj = new Types.ObjectId(eventCtx.eventId);

    const { event } = eventCtx;
    const resetAt = event.cashRegisterResetAt;

    const allTimeMatch = { eventId: eventIdObj, type: { $in: exchangeTypes } };
    const sinceResetMatch: Record<string, unknown> = {
        eventId: eventIdObj,
        type: { $in: exchangeTypes }
    };
    if (resetAt) {
        sinceResetMatch.occurredAt = { $gt: resetAt };
    }

    const [aggregation, sinceResetAgg, myAggregation, mySinceResetAgg] = await Promise.all([
        EventUserTransactionModel.aggregate([
            { $match: allTimeMatch },
            { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        EventUserTransactionModel.aggregate([
            { $match: sinceResetMatch },
            { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        EventUserTransactionModel.aggregate([
            { $match: { ...allTimeMatch, performedByUserId: new Types.ObjectId(currentUserId) } },
            { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        EventUserTransactionModel.aggregate([
            { $match: { ...sinceResetMatch, performedByUserId: new Types.ObjectId(currentUserId) } },
            { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ])
    ]);

    function extract(rows: { _id: string; total: number; count: number }[]) {
        let topUp = 0, refund = 0, topUpCount = 0, refundCount = 0;
        for (const row of rows) {
            if (row._id === 'top-up') { topUp = row.total; topUpCount = row.count; }
            else if (row._id === 'refund') { refund = row.total; refundCount = row.count; }
        }
        return { topUp, refund, topUpCount, refundCount };
    }

    const all = extract(aggregation);
    const since = extract(sinceResetAgg);
    const my = extract(myAggregation);
    const mySince = extract(mySinceResetAgg);

    return res.status(200).json({
        totalTopUp: all.topUp,
        totalRefund: all.refund,
        netBalance: all.topUp - all.refund,
        topUpCount: all.topUpCount,
        refundCount: all.refundCount,
        myTopUp: my.topUp,
        myRefund: my.refund,
        myNetBalance: my.topUp - my.refund,
        myTopUpCount: my.topUpCount,
        myRefundCount: my.refundCount,
        sinceResetTopUp: since.topUp,
        sinceResetRefund: since.refund,
        netSinceReset: since.topUp - since.refund,
        mySinceResetTopUp: mySince.topUp,
        mySinceResetRefund: mySince.refund,
        myNetSinceReset: mySince.topUp - mySince.refund,
        lastResetAt: resetAt,
        exchangeRate: event.exchangeRate ?? 1,
        currencyName: event.currencyName,
        currencySymbol: event.currencySymbol
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

    const performerIds = [...new Set(transactions.map(t => t.performedByUserId?.toString()).filter(Boolean))];
    const performers = performerIds.length > 0
        ? await UserModel.find({ _id: { $in: performerIds } }).select('firstName lastName').lean()
        : [];
    const performerMap = new Map(performers.map(p => [p._id.toString(), `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Operatore']));

    const items = transactions.map(t => ({
        ...toTransactionResponse(t),
        performedByName: t.performedByUserId ? (performerMap.get(t.performedByUserId.toString()) ?? null) : null
    }));

    return res.status(200).json({
        items,
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

    const exchangeRate = eventCtx.event.exchangeRate ?? 1;
    const creditAmount = Math.round(amount * exchangeRate * 100) / 100;

    try {
        const result = await createEventUserTransaction({
            eventUserId: eventUser._id,
            type: 'top-up',
            direction: 'credit',
            amount: creditAmount,
            realAmount: amount,
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

    const exchangeRate = eventCtx.event.exchangeRate ?? 1;
    const realAmount = Math.round(amount / exchangeRate * 100) / 100;

    try {
        const result = await createEventUserTransaction({
            eventUserId: eventUser._id,
            type: 'refund',
            direction: 'debit',
            amount,
            realAmount,
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

async function createGuest(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { displayName } = req.body as { displayName?: string };
    const name = displayName?.trim() || null;

    const eventUser = await EventUserModel.create({
        eventId: eventCtx.eventId,
        userId: null,
        displayName: name,
        balance: 0
    });

    return res.status(201).json({
        item: {
            id: eventUser._id.toString(),
            eventId: eventUser.eventId.toString(),
            userId: null,
            firstName: name,
            lastName: null,
            email: null,
            balance: 0,
            isAnonymous: true,
            isActive: true,
            joinedAt: eventUser.joinedAt,
            displayName: name
        }
    });
}

export const exchangeController = {
    listUsers,
    getBalance,
    listTransactions,
    topUp,
    refund,
    resetCashRegister,
    getCashRegisterReset,
    createGuest
};
