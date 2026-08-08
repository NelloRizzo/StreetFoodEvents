import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { EventUserModel } from '../models/event-user.model';
import { EventUserTransactionModel } from '../models/event-user-transaction.model';
import { EventModel } from '../models/event.model';
import { OrderModel } from '../models/order.model';
import { StandModel } from '../models/stand.model';
import { StandSettlementModel } from '../models/stand-settlement.model';
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

function toSettlementResponse(s: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    standId: Types.ObjectId;
    standName: string;
    direction?: string;
    amount: number;
    exchangeRate: number;
    feePercent: number;
    grossEuro: number;
    feeEuro: number;
    payoutEuro: number;
    description?: string | null;
    performedByUserId?: Types.ObjectId | null;
    occurredAt: Date;
    createdAt: Date;
}) {
    return {
        id: s._id.toString(),
        eventId: s.eventId.toString(),
        standId: s.standId.toString(),
        standName: s.standName,
        direction: s.direction ?? 'credit',
        amount: s.amount,
        exchangeRate: s.exchangeRate,
        feePercent: s.feePercent,
        grossEuro: s.grossEuro,
        feeEuro: s.feeEuro,
        payoutEuro: s.payoutEuro,
        description: s.description ?? null,
        performedByUserId: s.performedByUserId?.toString() ?? null,
        occurredAt: s.occurredAt,
        createdAt: s.createdAt
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

async function settlementSummary(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const eventIdObj = new Types.ObjectId(eventCtx.eventId);
    const stands = await StandModel.find({ eventIds: eventIdObj }).select('_id name').lean();

    if (stands.length === 0) {
        return res.status(200).json({
            eventId: eventCtx.eventId,
            exchangeRate: eventCtx.event.exchangeRate ?? 1,
            currencyName: eventCtx.event.currencyName,
            currencySymbol: eventCtx.event.currencySymbol ?? null,
            stands: []
        });
    }

    const standIdList = stands.map((s) => s._id);

    const [orderAgg, settlementAgg] = await Promise.all([
        OrderModel.aggregate([
            {
                $match: {
                    eventId: eventIdObj,
                    standId: { $in: standIdList },
                    paymentStatus: 'paid'
                }
            },
            {
                $group: {
                    _id: '$standId',
                    earnedCredits: { $sum: '$creditAmountUsed' },
                    earnedOrders: { $sum: 1 }
                }
            }
        ]),
        StandSettlementModel.aggregate([
            { $match: { eventId: eventIdObj } },
            {
                $group: {
                    _id: { standId: '$standId', direction: { $ifNull: ['$direction', 'credit'] } },
                    credits: { $sum: '$amount' }
                }
            }
        ])
    ]);

    const orderMap = new Map(orderAgg.map((r) => [r._id.toString(), r]));

    const loadedMap = new Map<string, number>();
    const settledMap = new Map<string, number>();
    for (const r of settlementAgg) {
        const standKey = r._id.standId.toString();
        if (r._id.direction === 'debit') {
            loadedMap.set(standKey, (loadedMap.get(standKey) ?? 0) + r.credits);
        } else {
            settledMap.set(standKey, (settledMap.get(standKey) ?? 0) + r.credits);
        }
    }

    const standItems = stands.map((s) => {
        const earned = orderMap.get(s._id.toString())?.earnedCredits ?? 0;
        const loaded = loadedMap.get(s._id.toString()) ?? 0;
        const settled = settledMap.get(s._id.toString()) ?? 0;
        return {
            standId: s._id.toString(),
            standName: s.name,
            earnedCredits: Math.round(earned * 100) / 100,
            loadedCredits: Math.round(loaded * 100) / 100,
            settledCredits: Math.round(settled * 100) / 100,
            toReturnCredits: Math.max(0, Math.round((loaded - settled) * 100) / 100)
        };
    });

    return res.status(200).json({
        eventId: eventCtx.eventId,
        exchangeRate: eventCtx.event.exchangeRate ?? 1,
        currencyName: eventCtx.event.currencyName,
        currencySymbol: eventCtx.event.currencySymbol ?? null,
        stands: standItems
    });
}

async function settlementReport(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const eventIdObj = new Types.ObjectId(eventCtx.eventId);

    const from = req.query.from ? new Date(req.query.from as string) : null;
    const to = req.query.to ? new Date(req.query.to as string) : null;

    const match: Record<string, unknown> = { eventId: eventIdObj };
    const occurredAt: Record<string, Date> = {};
    if (from && !Number.isNaN(from.getTime())) occurredAt.$gte = from;
    if (to && !Number.isNaN(to.getTime())) occurredAt.$lte = to;
    if (Object.keys(occurredAt).length > 0) match.occurredAt = occurredAt;

    const [settlementAgg, orderAgg] = await Promise.all([
        StandSettlementModel.aggregate([
            { $match: match },
            {
                $group: {
                    _id: { standId: '$standId', direction: { $ifNull: ['$direction', 'credit'] } },
                    standName: { $first: '$standName' },
                    credits: { $sum: '$amount' },
                    grossEuro: { $sum: '$grossEuro' },
                    feeEuro: { $sum: '$feeEuro' },
                    payoutEuro: { $sum: '$payoutEuro' },
                    count: { $sum: 1 }
                }
            }
        ]),
        OrderModel.aggregate([
            { $match: { eventId: eventIdObj, paymentStatus: 'paid' } },
            { $group: { _id: '$standId', earnedCredits: { $sum: '$creditAmountUsed' } } }
        ])
    ]);

    const orderMap = new Map(orderAgg.map((r) => [r._id.toString(), r.earnedCredits ?? 0]));

    const standMap = new Map<string, {
        standName: string;
        loadedCredits: number;
        settledCredits: number;
        loadCount: number;
        settlementCount: number;
        grossEuro: number;
        feeEuro: number;
        payoutEuro: number;
    }>();

    for (const r of settlementAgg) {
        const standKey = r._id.standId.toString();
        const entry = standMap.get(standKey) ?? {
            standName: r.standName,
            loadedCredits: 0,
            settledCredits: 0,
            loadCount: 0,
            settlementCount: 0,
            grossEuro: 0,
            feeEuro: 0,
            payoutEuro: 0
        };
        if (r._id.direction === 'debit') {
            entry.loadedCredits += r.credits;
            entry.loadCount += r.count;
        } else {
            entry.settledCredits += r.credits;
            entry.settlementCount += r.count;
            entry.grossEuro += r.grossEuro;
            entry.feeEuro += r.feeEuro;
            entry.payoutEuro += r.payoutEuro;
        }
        standMap.set(standKey, entry);
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const stands = [...standMap.entries()].map(([standId, s]) => {
        const earnedCredits = round2(orderMap.get(standId) ?? 0);
        return {
            standId,
            standName: s.standName,
            settlementCount: s.settlementCount,
            loadCount: s.loadCount,
            loadedCredits: round2(s.loadedCredits),
            settledCredits: round2(s.settledCredits),
            earnedCredits,
            toReturnCredits: Math.max(0, round2(s.loadedCredits - s.settledCredits)),
            grossEuro: round2(s.grossEuro),
            feeEuro: round2(s.feeEuro),
            payoutEuro: round2(s.payoutEuro)
        };
    }).sort((a, b) => a.standName.localeCompare(b.standName));

    const totals = {
        settlementCount: stands.reduce((a, s) => a + s.settlementCount, 0),
        loadCount: stands.reduce((a, s) => a + s.loadCount, 0),
        loadedCredits: round2(stands.reduce((a, s) => a + s.loadedCredits, 0)),
        settledCredits: round2(stands.reduce((a, s) => a + s.settledCredits, 0)),
        earnedCredits: round2(stands.reduce((a, s) => a + s.earnedCredits, 0)),
        toReturnCredits: round2(stands.reduce((a, s) => a + s.toReturnCredits, 0)),
        grossEuro: round2(stands.reduce((a, s) => a + s.grossEuro, 0)),
        feeEuro: round2(stands.reduce((a, s) => a + s.feeEuro, 0)),
        payoutEuro: round2(stands.reduce((a, s) => a + s.payoutEuro, 0))
    };

    return res.status(200).json({
        eventId: eventCtx.eventId,
        eventName: eventCtx.event.name,
        exchangeRate: eventCtx.event.exchangeRate ?? 1,
        currencyName: eventCtx.event.currencyName,
        currencySymbol: eventCtx.event.currencySymbol ?? null,
        from: from && !Number.isNaN(from.getTime()) ? from.toISOString() : null,
        to: to && !Number.isNaN(to.getTime()) ? to.toISOString() : null,
        stands,
        totals
    });
}

async function listSettlements(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const match: Record<string, unknown> = { eventId: new Types.ObjectId(eventCtx.eventId) };
    if (req.query.standId && isValidObjectId(req.query.standId as string)) {
        match.standId = new Types.ObjectId(req.query.standId as string);
    }
    if (req.query.direction === 'debit' || req.query.direction === 'credit') {
        match.direction = req.query.direction;
    }

    const [settlements, total] = await Promise.all([
        StandSettlementModel.find(match)
            .sort({ occurredAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        StandSettlementModel.countDocuments(match)
    ]);

    const performerIds = [...new Set(settlements.map((s) => s.performedByUserId?.toString()).filter(Boolean))];
    const performers = performerIds.length > 0
        ? await UserModel.find({ _id: { $in: performerIds } }).select('firstName lastName').lean()
        : [];
    const performerMap = new Map(performers.map((p) => [p._id.toString(), `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Operatore']));

    const items = settlements.map((s) => ({
        ...toSettlementResponse(s),
        performedByName: s.performedByUserId ? (performerMap.get(s.performedByUserId.toString()) ?? null) : null
    }));

    const totals = await StandSettlementModel.aggregate([
        { $match: match },
        {
            $group: {
                _id: { direction: { $ifNull: ['$direction', 'credit'] } },
                credits: { $sum: '$amount' },
                payoutEuro: { $sum: '$payoutEuro' },
                count: { $sum: 1 }
            }
        }
    ]);

    let loadedCredits = 0;
    let settledCredits = 0;
    let count = 0;
    let payoutEuro = 0;
    for (const row of totals) {
        count += row.count;
        payoutEuro += row.payoutEuro;
        if (row._id.direction === 'debit') loadedCredits += row.credits;
        else settledCredits += row.credits;
    }

    return res.status(200).json({
        items,
        totals: {
            loadedCredits: Math.round(loadedCredits * 100) / 100,
            settledCredits: Math.round(settledCredits * 100) / 100,
            payoutEuro: Math.round(payoutEuro * 100) / 100,
            count
        },
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
}

async function createSettlement(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { standId, amount, feePercent, description } = req.body;
    const direction = req.body.direction === 'debit' ? 'debit' : 'credit';

    if (!standId || !isValidObjectId(standId)) {
        return res.status(400).json({ message: 'Valid standId is required' });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
    }

    const feeNum = direction === 'credit' ? Number(feePercent ?? 0) : 0;
    if (!Number.isFinite(feeNum) || feeNum < 0 || feeNum > 100) {
        return res.status(400).json({ message: 'Fee percentage must be between 0 and 100' });
    }

    const stand = await StandModel.findById(standId);
    if (!stand || !stand.eventIds.some((id) => id.toString() === eventCtx.eventId)) {
        return res.status(404).json({ message: 'Stand not found for this event' });
    }

    const exchangeRate = eventCtx.event.exchangeRate ?? 1;
    const grossEuro = direction === 'debit' ? 0 : Math.round(amountNum / exchangeRate * 100) / 100;
    const feeEuro = direction === 'debit' ? 0 : Math.round(grossEuro * (feeNum / 100) * 100) / 100;
    const payoutEuro = direction === 'debit' ? 0 : Math.round((grossEuro - feeEuro) * 100) / 100;

    try {
        const settlement = await StandSettlementModel.create({
            eventId: eventCtx.eventId,
            standId: stand._id,
            standName: stand.name,
            direction,
            amount: amountNum,
            exchangeRate,
            feePercent: feeNum,
            grossEuro,
            feeEuro,
            payoutEuro,
            description: description?.trim() || null,
            performedByUserId: req.user!.id,
            occurredAt: new Date()
        });

        return res.status(201).json({ item: toSettlementResponse(settlement) });
    } catch (error) {
        console.error('createSettlement error:', error);
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
    settlementSummary,
    settlementReport,
    listSettlements,
    createSettlement,
    resetCashRegister,
    getCashRegisterReset,
    createGuest
};
