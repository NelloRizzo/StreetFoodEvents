import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { EventUserModel } from '../models/event-user.model';
import { EventUserTransactionModel } from '../models/event-user-transaction.model';
import { CashRegisterMovementModel } from '../models/cash-register-movement.model';
import { CashRegisterModel } from '../models/cash-register.model';
import {
    CashRequestModel,
    cashRequestKindValues,
    cashRequestStatusValues
} from '../models/cash-request.model';
import { EventModel } from '../models/event.model';
import { PromotionUsageModel } from '../models/promotion.model';
import { OrderModel } from '../models/order.model';
import { StandModel } from '../models/stand.model';
import { StandSettlementModel } from '../models/stand-settlement.model';
import { UserModel } from '../models/user.model';
import { createEventUserTransaction, EventUserTransactionError } from '../services/event-user-transactions.service';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toCashRegisterResponse(
    cr: {
        _id: Types.ObjectId;
        eventId: Types.ObjectId;
        name: string;
        status: string;
        openedByUserId?: Types.ObjectId | null;
        openedAt: Date;
        closedAt?: Date | null;
        cashFloat?: { euro: number; credits: number; setAt?: Date | null } | null;
        lowThreshold?: { euro?: number | null; credits?: number | null } | null;
    },
    openedByName: string | null = null
) {
    return {
        id: cr._id.toString(),
        eventId: cr.eventId.toString(),
        name: cr.name,
        status: cr.status,
        openedByUserId: cr.openedByUserId?.toString() ?? null,
        openedByName,
        openedAt: cr.openedAt,
        closedAt: cr.closedAt ?? null,
        cashFloat: cr.cashFloat
            ? { euro: cr.cashFloat.euro, credits: cr.cashFloat.credits, setAt: cr.cashFloat.setAt ?? null }
            : { euro: 0, credits: 0, setAt: null },
        lowThreshold: {
            euro: cr.lowThreshold?.euro ?? null,
            credits: cr.lowThreshold?.credits ?? null
        }
    };
}

async function findCashRegister(req: Request, cashRegisterId: string) {
    if (!isValidObjectId(cashRegisterId)) return { error: { status: 400, message: 'Valid cashRegisterId is required' } as const };
    const cashRegister = await CashRegisterModel.findOne({ _id: cashRegisterId, eventId: req.params.eventId });
    if (!cashRegister) return { error: { status: 404, message: 'Cash register not found for this event' } as const };
    return { cashRegister } as const;
}

async function loadOpenerNames(cashRegisters: Array<{ openedByUserId?: Types.ObjectId | null }>) {
    const openerIds = [...new Set(cashRegisters.map((c) => c.openedByUserId?.toString()).filter(Boolean))];
    if (openerIds.length === 0) return new Map<string, string>();
    const openers = await UserModel.find({ _id: { $in: openerIds } }).select('firstName lastName').lean();
    return new Map(
        openers.map((u) => [u._id.toString(), `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Operatore'])
    );
}

type RealByMethodRow = {
    _id: { type: string; method: string | null };
    real: number;
    count: number;
};

/**
 * Aggrega gli importi reali (EUR) di top-up/refund separando contanti e POS.
 * I record legacy non hanno `paymentMethod`: finiscono nel bucket `method: null`,
 * che va trattato come 'cash' (mai `$eq: 'cash'` nelle query, usare `$ne: 'pos'`).
 */
function realByMethodPipeline(match: Record<string, unknown>) {
    return [
        { $match: match },
        {
            $group: {
                _id: { type: '$type', method: '$paymentMethod' },
                real: { $sum: '$realAmount' },
                count: { $sum: 1 }
            }
        }
    ];
}

function extractRealSplit(rows: RealByMethodRow[]) {
    let topUpCash = 0, topUpPos = 0, topUpCount = 0, topUpPosCount = 0;
    let refundCash = 0, refundPos = 0, refundCount = 0, refundPosCount = 0;

    for (const row of rows) {
        const real = row.real ?? 0;
        const count = row.count ?? 0;
        const isPos = row._id.method === 'pos';

        if (row._id.type === 'top-up') {
            topUpCount += count;
            if (isPos) { topUpPos += real; topUpPosCount += count; }
            else { topUpCash += real; }
        } else if (row._id.type === 'refund') {
            refundCount += count;
            if (isPos) { refundPos += real; refundPosCount += count; }
            else { refundCash += real; }
        }
    }

    return { topUpCash, topUpPos, topUpCount, topUpPosCount, refundCash, refundPos, refundCount, refundPosCount };
}

const roundEuro = (n: number) => Math.round((n || 0) * 100) / 100;

/**
 * Normalizza il metodo di pagamento reale di top-up/refund.
 * `undefined`/null → 'cash' (default), valore non valido → null (400 al chiamante).
 */
function parsePaymentMethod(value: unknown): 'cash' | 'pos' | null {
    if (value === undefined || value === null || value === '') return 'cash';
    if (value === 'cash' || value === 'pos') return value;
    return null;
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
    paymentMethod?: string | null;
    balanceAfter: number;
    description?: string | null;
    performedByUserId?: Types.ObjectId | null;
    cashRegisterId?: Types.ObjectId | null;
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
        paymentMethod: t.paymentMethod ?? 'cash',
        balanceAfter: t.balanceAfter,
        description: t.description ?? null,
        performedByUserId: t.performedByUserId?.toString() ?? null,
        cashRegisterId: t.cashRegisterId?.toString() ?? null,
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
    unit?: string;
    amount: number;
    denominations?: Array<{ label: string; value: number; count: number; euroAmount: number }>;
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
        unit: s.unit ?? 'credits',
        amount: s.amount,
        denominations: s.denominations ?? [],
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
        /* Il "cliente generico" e' l'anonimo condiviso dell'evento (nessun
         * userId e nessun displayName): e' il destinatario predefinito delle
         * operazioni senza cliente. Gli anonimi con nome vengono creati dal
         * pulsante "+ Crea" e NON sono il generico. */
        isGeneric: !eu.userId && !eu.displayName,
        isActive: eu.isActive,
        joinedAt: eu.joinedAt,
        displayName: (eu as { displayName?: string }).displayName ?? null
    }));

    return res.status(200).json({ items });
}

/* Saldo di un singolo wallet: endpoint leggero pensato per il polling della
 * postazione (un solo documento, niente populate, niente lista). Serve perche'
 * il saldo del cliente cambia anche sugli ALTRI banchi del banco cambio e, senza
 * una rilettura, la cassa mostrerebbe uno snapshot e bloccherebbe un rimborso
 * che l'altra cassa ha appena abilitato. */
async function getEventUserBalance(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { eventUserId } = req.params as { eventUserId: string };
    if (typeof eventUserId !== 'string' || !isValidObjectId(eventUserId)) {
        return res.status(400).json({ message: 'Valid eventUserId is required' });
    }

    const eventUser = await EventUserModel.findOne({
        _id: eventUserId,
        eventId: eventCtx.eventId,
        isActive: true
    }).select('balance').lean();

    if (!eventUser) {
        return res.status(404).json({ message: 'Event user not found for this event' });
    }

    return res.status(200).json({ id: eventUserId, balance: eventUser.balance });
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

    const floatEuro = event.cashFloat?.euro ?? 0;
    const floatCredits = event.cashFloat?.credits ?? 0;
    const floatSetAt: Date | null = event.cashFloat?.setAt ?? null;

    const movementRows = await CashRegisterMovementModel.aggregate([
        { $match: { eventId: eventIdObj } },
        { $group: { _id: { currency: '$currency', direction: '$direction' }, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    let euroIn = 0, euroOut = 0, creditsIn = 0, creditsOut = 0;
    for (const row of movementRows) {
        if (row._id.currency === 'euro') {
            if (row._id.direction === 'in') euroIn = row.total; else euroOut = row.total;
        } else {
            if (row._id.direction === 'in') creditsIn = row.total; else creditsOut = row.total;
        }
    }

    const realSplitRows = await EventUserTransactionModel.aggregate(realByMethodPipeline(allTimeMatch));
    const realSplit = extractRealSplit(realSplitRows);
    const topUpRealCash = realSplit.topUpCash;
    const refundRealCash = realSplit.refundCash;

    return res.status(200).json({
        totalTopUp: all.topUp,
        totalRefund: all.refund,
        netBalance: all.topUp - all.refund,
        topUpCount: all.topUpCount,
        refundCount: all.refundCount,
        totalTopUpReal: roundEuro(realSplit.topUpCash + realSplit.topUpPos),
        totalRefundReal: roundEuro(realSplit.refundCash + realSplit.refundPos),
        totalTopUpRealCash: roundEuro(realSplit.topUpCash),
        totalRefundRealCash: roundEuro(realSplit.refundCash),
        totalTopUpRealPos: roundEuro(realSplit.topUpPos),
        totalRefundRealPos: roundEuro(realSplit.refundPos),
        totalPosNetReal: roundEuro(realSplit.topUpPos - realSplit.refundPos),
        topUpPosCount: realSplit.topUpPosCount,
        refundPosCount: realSplit.refundPosCount,
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
        currencySymbol: event.currencySymbol,
        cashFloat: {
            euro: floatEuro,
            credits: floatCredits,
            setAt: floatSetAt ?? event.updatedAt ?? null
        },
        euroContent:
            roundEuro(floatEuro + topUpRealCash - refundRealCash + euroIn - euroOut),
        creditsContent:
            Math.round((floatCredits - all.topUp + all.refund + creditsIn - creditsOut) * 100) / 100,
        cashMovements: {
            euroIn,
            euroOut,
            creditsIn,
            creditsOut
        }
    });
}

async function setCashFloat(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { euro, credits } = req.body as { euro?: unknown; credits?: unknown; cashRegisterId?: unknown };

    function parseAmount(value: unknown): number | undefined {
        if (value === undefined || value === null || value === '') return undefined;
        const n = typeof value === 'string' ? parseFloat(value) : Number(value);
        if (Number.isNaN(n) || n < 0) return undefined;
        return Math.round(n * 100) / 100;
    }

    if (euro !== undefined && parseAmount(euro) === undefined) {
        return res.status(400).json({ message: 'Invalid euro amount' });
    }
    if (credits !== undefined && parseAmount(credits) === undefined) {
        return res.status(400).json({ message: 'Invalid credits amount' });
    }

    const cashRegisterId = req.body.cashRegisterId;

    /* Con cashRegisterId il fondo cassa appartiene alla cassa, non più all'evento */
    if (cashRegisterId) {
        if (typeof cashRegisterId !== 'string' || !isValidObjectId(cashRegisterId)) {
            return res.status(400).json({ message: 'Valid cashRegisterId is required' });
        }
        const cashRegister = await CashRegisterModel.findOne({
            _id: cashRegisterId,
            eventId: eventCtx.eventId
        });
        if (!cashRegister) {
            return res.status(404).json({ message: 'Cash register not found for this event' });
        }
        if (cashRegister.status !== 'open') {
            return res.status(400).json({ message: 'Cassa chiusa, operazione non ammessa' });
        }

        const current = cashRegister.cashFloat ?? { euro: 0, credits: 0, setAt: null };
        const nextEuro = euro !== undefined ? parseAmount(euro)! : current.euro;
        const nextCredits = credits !== undefined ? parseAmount(credits)! : current.credits;

        cashRegister.cashFloat = {
            euro: nextEuro,
            credits: nextCredits,
            setAt: new Date()
        };
        await cashRegister.save();

        return res.status(200).json({
            item: { euro: nextEuro, credits: nextCredits, setAt: cashRegister.cashFloat.setAt }
        });
    }

    const current = eventCtx.event.cashFloat ?? { euro: 0, credits: 0 };
    const nextEuro = euro !== undefined ? parseAmount(euro)! : current.euro;
    const nextCredits = credits !== undefined ? parseAmount(credits)! : current.credits;

    eventCtx.event.cashFloat = {
        euro: nextEuro,
        credits: nextCredits,
        setAt: new Date()
    };

    await eventCtx.event.save();

    return res.status(200).json({
        item: { euro: nextEuro, credits: nextCredits, setAt: eventCtx.event.cashFloat.setAt }
    });
}

async function addCashMovement(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { currency, direction, amount, description } = req.body as {
        currency?: unknown;
        direction?: unknown;
        amount?: unknown;
        description?: unknown;
        cashRegisterId?: unknown;
    };

    if (currency !== 'euro' && currency !== 'credits') {
        return res.status(400).json({ message: "Currency must be 'euro' or 'credits'" });
    }
    if (direction !== 'in' && direction !== 'out') {
        return res.status(400).json({ message: "Direction must be 'in' or 'out'" });
    }
    const parsed =
        typeof amount === 'number'
            ? amount
            : typeof amount === 'string'
              ? parseFloat(amount)
              : NaN;
    if (Number.isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
    }

    let cashRegisterId: Types.ObjectId | null = null;
    if (req.body.cashRegisterId) {
        if (typeof req.body.cashRegisterId !== 'string' || !isValidObjectId(req.body.cashRegisterId)) {
            return res.status(400).json({ message: 'Valid cashRegisterId is required' });
        }
        const cashRegister = await CashRegisterModel.findOne({
            _id: req.body.cashRegisterId,
            eventId: eventCtx.eventId
        });
        if (!cashRegister) {
            return res.status(404).json({ message: 'Cash register not found for this event' });
        }
        if (cashRegister.status !== 'open') {
            return res.status(400).json({ message: 'Cassa chiusa, operazione non ammessa' });
        }
        cashRegisterId = cashRegister._id;
    }

    const movement = await CashRegisterMovementModel.create({
        eventId: eventCtx.eventId,
        currency,
        direction,
        amount: Math.round(parsed * 100) / 100,
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
        performedByUserId: req.user?.id ?? null,
        cashRegisterId
    });

    return res.status(201).json({
        item: {
            id: movement._id.toString(),
            eventId: eventCtx.eventId,
            currency: movement.currency,
            direction: movement.direction,
            amount: movement.amount,
            description: movement.description,
            performedByUserId: movement.performedByUserId?.toString() ?? null,
            cashRegisterId: movement.cashRegisterId?.toString() ?? null,
            occurredAt: movement.occurredAt
        }
    });
}

async function listCashMovements(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
        CashRegisterMovementModel.find({ eventId: eventCtx.eventId })
            .sort({ occurredAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('performedByUserId', 'firstName lastName')
            .lean(),
        CashRegisterMovementModel.countDocuments({ eventId: eventCtx.eventId })
    ]);

    const items = movements.map((m) => ({
        id: m._id.toString(),
        currency: m.currency,
        direction: m.direction,
        amount: m.amount,
        description: m.description ?? null,
        performedByName: m.performedByUserId
            ? `${(m.performedByUserId as unknown as { firstName?: string }).firstName ?? ''} ${(m.performedByUserId as unknown as { lastName?: string }).lastName ?? ''}`.trim()
            : null,
        occurredAt: m.occurredAt
    }));

    return res.status(200).json({
        items,
        pagination: { page, totalPages: Math.max(1, Math.ceil(total / limit)) }
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

    const { eventUserId, amount, description } = req.body as {
        eventUserId?: unknown;
        amount?: unknown;
        description?: unknown;
    };

    const paymentMethod = parsePaymentMethod(req.body.paymentMethod);

    if (paymentMethod === null) {
        return res.status(400).json({ message: 'paymentMethod must be cash or pos' });
    }

    if (typeof eventUserId !== 'string' || !isValidObjectId(eventUserId)) {
        return res.status(400).json({ message: 'Valid eventUserId is required' });
    }

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
    }

    let cashRegisterId: Types.ObjectId | null = null;
    if (req.body.cashRegisterId) {
        if (typeof req.body.cashRegisterId !== 'string' || !isValidObjectId(req.body.cashRegisterId)) {
            return res.status(400).json({ message: 'Valid cashRegisterId is required' });
        }
        const cashRegister = await CashRegisterModel.findOne({
            _id: req.body.cashRegisterId,
            eventId: eventCtx.eventId
        });
        if (!cashRegister) {
            return res.status(404).json({ message: 'Cash register not found for this event' });
        }
        if (cashRegister.status !== 'open') {
            return res.status(400).json({ message: 'Cassa chiusa, operazione non ammessa' });
        }
        cashRegisterId = cashRegister._id;
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
            paymentMethod,
            description: typeof description === 'string' && description.trim()
                ? description.trim()
                : paymentMethod === 'pos'
                    ? 'Cambio: carica crediti con POS (reale → virtuale)'
                    : 'Cambio: carica crediti (reale → virtuale)',
            performedByUserId: req.user!.id,
            cashRegisterId,
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

    const { eventUserId, amount, description } = req.body as {
        eventUserId?: unknown;
        amount?: unknown;
        description?: unknown;
    };

    const paymentMethod = parsePaymentMethod(req.body.paymentMethod);

    if (paymentMethod === null) {
        return res.status(400).json({ message: 'paymentMethod must be cash or pos' });
    }

    if (typeof eventUserId !== 'string' || !isValidObjectId(eventUserId)) {
        return res.status(400).json({ message: 'Valid eventUserId is required' });
    }

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
    }

    let cashRegisterId: Types.ObjectId | null = null;
    if (req.body.cashRegisterId) {
        if (typeof req.body.cashRegisterId !== 'string' || !isValidObjectId(req.body.cashRegisterId)) {
            return res.status(400).json({ message: 'Valid cashRegisterId is required' });
        }
        const cashRegister = await CashRegisterModel.findOne({
            _id: req.body.cashRegisterId,
            eventId: eventCtx.eventId
        });
        if (!cashRegister) {
            return res.status(404).json({ message: 'Cash register not found for this event' });
        }
        if (cashRegister.status !== 'open') {
            return res.status(400).json({ message: 'Cassa chiusa, operazione non ammessa' });
        }
        cashRegisterId = cashRegister._id;
    }

    const eventUser = await EventUserModel.findById(eventUserId);
    if (!eventUser || eventUser.eventId.toString() !== eventCtx.eventId) {
        return res.status(404).json({ message: 'Event user not found for this event' });
    }

    const exchangeRate = eventCtx.event.exchangeRate ?? 1;
    const currencyName = eventCtx.event.currencyName;

    /* L'importo del rimborso e' in moneta evento (crediti), non in euro: se il
     * cassiere digita gli euro sbaglia sempre il saldo. Rispondiamo subito con
     * entrambi i numeri invece di far fallire la transazione piu' a valle. */
    if (amount > eventUser.balance) {
        return res.status(400).json({
            message: `Saldo insufficiente: il cliente ha ${eventUser.balance} ${currencyName}, ne hai chiesti ${amount} ${currencyName} (${roundEuro(amount / exchangeRate)} €).`
        });
    }

    const realAmount = Math.round(amount / exchangeRate * 100) / 100;

    try {
        const result = await createEventUserTransaction({
            eventUserId: eventUser._id,
            type: 'refund',
            direction: 'debit',
            amount,
            realAmount,
            paymentMethod,
            description: typeof description === 'string' && description.trim()
                ? description.trim()
                : paymentMethod === 'pos'
                    ? 'Cambio: rimborso crediti con POS (virtuale → reale)'
                    : 'Cambio: rimborso crediti (virtuale → reale)',
            performedByUserId: req.user!.id,
            cashRegisterId,
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
                    credits: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$unit', 'credits'] }, 'euro'] }, '$amount', 0] } },
                    euros: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$unit', 'credits'] }, 'euro'] }, '$amount', 0] } }
                }
            }
        ])
    ]);

    const orderMap = new Map(orderAgg.map((r) => [r._id.toString(), r]));

    const loadedMap = new Map<string, number>();
    const settledMap = new Map<string, number>();
    const loadedEuroMap = new Map<string, number>();
    const settledEuroMap = new Map<string, number>();
    for (const r of settlementAgg) {
        const standKey = r._id.standId.toString();
        if (r._id.direction === 'debit') {
            loadedMap.set(standKey, (loadedMap.get(standKey) ?? 0) + r.credits);
            loadedEuroMap.set(standKey, (loadedEuroMap.get(standKey) ?? 0) + r.euros);
        } else {
            settledMap.set(standKey, (settledMap.get(standKey) ?? 0) + r.credits);
            settledEuroMap.set(standKey, (settledEuroMap.get(standKey) ?? 0) + r.euros);
        }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

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
            toReturnCredits: Math.max(0, Math.round((loaded - settled) * 100) / 100),
            loadedEuro: round2(loadedEuroMap.get(s._id.toString()) ?? 0),
            settledEuro: round2(settledEuroMap.get(s._id.toString()) ?? 0)
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
                    credits: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$unit', 'credits'] }, 'euro'] }, '$amount', 0] } },
                    euros: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$unit', 'credits'] }, 'euro'] }, '$amount', 0] } },
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
        loadedEuro: number;
        settledEuro: number;
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
            loadedEuro: 0,
            settledEuro: 0,
            grossEuro: 0,
            feeEuro: 0,
            payoutEuro: 0
        };
        if (r._id.direction === 'debit') {
            entry.loadedCredits += r.credits;
            entry.loadCount += r.count;
            entry.loadedEuro += r.euros;
        } else {
            entry.settledCredits += r.credits;
            entry.settlementCount += r.count;
            entry.settledEuro += r.euros;
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
            loadedEuro: round2(s.loadedEuro),
            settledEuro: round2(s.settledEuro),
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
        loadedEuro: round2(stands.reduce((a, s) => a + s.loadedEuro, 0)),
        settledEuro: round2(stands.reduce((a, s) => a + s.settledEuro, 0)),
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
                credits: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$unit', 'credits'] }, 'euro'] }, '$amount', 0] } },
                euros: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$unit', 'credits'] }, 'euro'] }, '$amount', 0] } },
                payoutEuro: { $sum: '$payoutEuro' },
                count: { $sum: 1 }
            }
        }
    ]);

    let loadedCredits = 0;
    let settledCredits = 0;
    let loadedEuro = 0;
    let settledEuro = 0;
    let count = 0;
    let payoutEuro = 0;
    for (const row of totals) {
        count += row.count;
        payoutEuro += row.payoutEuro;
        if (row._id.direction === 'debit') {
            loadedCredits += row.credits;
            loadedEuro += row.euros;
        } else {
            settledCredits += row.credits;
            settledEuro += row.euros;
        }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return res.status(200).json({
        items,
        totals: {
            loadedCredits: round2(loadedCredits),
            settledCredits: round2(settledCredits),
            loadedEuro: round2(loadedEuro),
            settledEuro: round2(settledEuro),
            payoutEuro: round2(payoutEuro),
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

    const { standId, amount, feePercent, description, denominations: inputDenoms } = req.body;
    const direction = req.body.direction === 'debit' ? 'debit' : 'credit';

    if (!standId || !isValidObjectId(standId)) {
        return res.status(400).json({ message: 'Valid standId is required' });
    }

    const stand = await StandModel.findById(standId);
    if (!stand || !stand.eventIds.some((id) => id.toString() === eventCtx.eventId)) {
        return res.status(404).json({ message: 'Stand not found for this event' });
    }

    const exchangeRate = eventCtx.event.exchangeRate ?? 1;
    const unit = req.body.unit === 'euro' ? 'euro' : 'credits';
    let amountNum: number;
    let processedDenoms: Array<{ label: string; value: number; count: number; euroAmount: number }> = [];

    if (unit === 'euro') {
        /* Voce contabile libera in euro: niente tagli, niente trattenuta */
        if (Array.isArray(inputDenoms) && inputDenoms.length > 0) {
            return res.status(400).json({ message: 'I tagli sono supportati solo dalle liquidazioni in crediti' });
        }
        amountNum = Number(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
            return res.status(400).json({ message: 'Amount must be a positive number' });
        }
    } else if (direction === 'credit' && Array.isArray(inputDenoms) && inputDenoms.length > 0) {
        /* Liquidazione con conteggio tagli token */
        const eventDenoms = eventCtx.event.denominations ?? [];
        const eventDenomMap = new Map(eventDenoms.map((d) => [d.label, d]));

        /* Aggrega i conteggi per label (il front-end potrebbe inviare più righe per lo stesso taglio) */
        const countByLabel = new Map<string, number>();
        for (const d of inputDenoms) {
            const count = Number(d.count);
            if (!Number.isFinite(count) || count <= 0) continue;
            countByLabel.set(d.label, (countByLabel.get(d.label) ?? 0) + count);
        }

        /* Calcola totali e valida */
        let totalCredits = 0;
        const processed: Array<{ label: string; value: number; count: number; euroAmount: number }> = [];

        for (const [label, count] of countByLabel) {
            const eventDef = eventDenomMap.get(label);
            if (!eventDef) {
                return res.status(400).json({ message: `Taglio "${label}" non definito per questo evento` });
            }
            const value = eventDef.value;
            const euroAmount = Math.round(count * value / exchangeRate * 100) / 100;
            totalCredits += count * value;
            processed.push({ label, value, count, euroAmount });
        }

        /* Verifica che le quantità restituite non superino quelle emesse */
        for (const p of processed) {
            const eventDef = eventDenomMap.get(p.label)!;
            const alreadyReturned = await StandSettlementModel.aggregate([
                { $match: { eventId: new Types.ObjectId(eventCtx.eventId), direction: 'credit', 'denominations.label': p.label } },
                { $unwind: '$denominations' },
                { $match: { 'denominations.label': p.label } },
                { $group: { _id: null, total: { $sum: '$denominations.count' } } }
            ]) as Array<{ total?: number }>;
            const prevReturned = alreadyReturned[0]?.total ?? 0;
            if (prevReturned + p.count > eventDef.quantity) {
                return res.status(400).json({
                    message: `Taglio "${p.label}": restituiti ${prevReturned + p.count} su ${eventDef.quantity} emessi (${eventDef.quantity - prevReturned} rimasti disponibili)`
                });
            }
        }

        amountNum = totalCredits;
        processedDenoms = processed;
    } else {
        /* Carico crediti (debit) o liquidazione senza tagli */
        amountNum = Number(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
            return res.status(400).json({ message: 'Amount must be a positive number' });
        }
    }

    const feeNum = direction === 'credit' && unit === 'credits' ? Number(feePercent ?? 0) : 0;
    if (!Number.isFinite(feeNum) || feeNum < 0 || feeNum > 100) {
        return res.status(400).json({ message: 'Fee percentage must be between 0 and 100' });
    }

    /* In euro: AVERE = pagamento diretto (gross=payout=importo), DARE = credito da esigere (nessun movimento ora) */
    const grossEuro = direction === 'debit'
        ? 0
        : unit === 'euro'
            ? Math.round(amountNum * 100) / 100
            : Math.round(amountNum / exchangeRate * 100) / 100;
    const feeEuro = direction === 'credit' && unit === 'credits'
        ? Math.round(grossEuro * (feeNum / 100) * 100) / 100
        : 0;
    const payoutEuro = direction === 'debit' ? 0 : Math.round((grossEuro - feeEuro) * 100) / 100;

    try {
        const settlement = await StandSettlementModel.create({
            eventId: eventCtx.eventId,
            standId: stand._id,
            standName: stand.name,
            direction,
            unit,
            amount: amountNum,
            denominations: processedDenoms,
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

async function listCashRegisters(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const match: Record<string, unknown> = { eventId: eventCtx.eventId };
    if (req.query.status === 'open' || req.query.status === 'closed') {
        match.status = req.query.status;
    }

    const cashRegisters = await CashRegisterModel.find(match).sort({ openedAt: -1 });
    const openerMap = await loadOpenerNames(cashRegisters);

    return res.status(200).json({
        items: cashRegisters.map((cr) => toCashRegisterResponse(cr, openerMap.get(cr.openedByUserId?.toString() ?? '') ?? null))
    });
}

async function createCashRegister(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { name, force, cashRegisterToClose } = req.body as {
        name?: unknown;
        force?: unknown;
        cashRegisterToClose?: unknown;
    };

    let cassaName: string;
    if (typeof name === 'string' && name.trim()) {
        cassaName = name.trim().slice(0, 80);
    } else {
        const count = await CashRegisterModel.countDocuments({ eventId: eventCtx.eventId });
        cassaName = `Cassa ${count + 1}`;
    }

    const cleanName = cassaName.replace(/\s+/g, ' ').trim();
    const duplicate = await CashRegisterModel.findOne({
        eventId: eventCtx.eventId,
        status: 'open',
        name: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') }
    });

    let closedDuplicate = null;
    if (duplicate) {
        if (force === true && typeof cashRegisterToClose === 'string' && duplicate._id.toString() === cashRegisterToClose) {
            duplicate.status = 'closed';
            duplicate.closedAt = new Date();
            await duplicate.save();
            closedDuplicate = toCashRegisterResponse(duplicate);
        } else {
            return res.status(409).json({
                code: 'name_taken',
                message: `Esiste già una cassa aperta "${duplicate.name}"`,
                item: toCashRegisterResponse(duplicate)
            });
        }
    }

    /* Le soglie di sicurezza appartengono alla POSTAZIONE, non alla singola
     * cassa: chiudere e riaprire una cassa non deve spegnere l'invio automatico
     * delle richieste alla master. La nuova cassa eredita le soglie dalla cassa
     * che sta sostituendo, altrimenti dall'ultima cassa chiusa dell'evento. */
    let inheritedLowThreshold: { euro: number | null; credits: number | null } | null =
        closedDuplicate && closedDuplicate.lowThreshold
            ? { euro: closedDuplicate.lowThreshold.euro ?? null, credits: closedDuplicate.lowThreshold.credits ?? null }
            : null;
    if (!inheritedLowThreshold) {
        const lastClosed = await CashRegisterModel.findOne({
            eventId: eventCtx.eventId,
            status: 'closed'
        }).sort({ closedAt: -1 });
        if (lastClosed?.lowThreshold) {
            inheritedLowThreshold = {
                euro: lastClosed.lowThreshold.euro ?? null,
                credits: lastClosed.lowThreshold.credits ?? null
            };
        }
    }

    const cashRegister = await CashRegisterModel.create({
        eventId: eventCtx.eventId,
        name: cleanName,
        status: 'open',
        openedByUserId: req.user!.id,
        openedAt: new Date(),
        lowThreshold: inheritedLowThreshold ?? null
    });

    const openerMap = await loadOpenerNames([cashRegister]);
    const item = toCashRegisterResponse(cashRegister, openerMap.get(cashRegister.openedByUserId.toString()) ?? null);

    return res.status(201).json({ item, closedDuplicate });
}

/* Rinomina e/o soglie di sicurezza. I campi sono indipendenti: inviare solo
 * lowThreshold non tocca il nome, inviare solo name non tocca le soglie.
 * Una soglia null disattiva l'invio automatico per quella valuta. */
async function updateCashRegister(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { cashRegisterId } = req.params as { cashRegisterId: string };
    const found = await findCashRegister(req, cashRegisterId);
    if ('error' in found) return res.status(found.error.status).json({ message: found.error.message });
    const cashRegister = found.cashRegister;

    const { name, lowThreshold } = req.body as { name?: unknown; lowThreshold?: unknown };

    if (name === undefined && lowThreshold === undefined) {
        return res.status(400).json({ message: 'Name or lowThreshold is required' });
    }

    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ message: 'Valid name is required' });
        }

        const cleanName = name.replace(/\s+/g, ' ').trim().slice(0, 80);

        const duplicate = await CashRegisterModel.findOne({
            eventId: eventCtx.eventId,
            status: 'open',
            _id: { $ne: cashRegister._id },
            name: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') }
        });

        if (duplicate) {
            return res.status(409).json({
                code: 'name_taken',
                message: `Esiste già una cassa aperta "${duplicate.name}"`,
                item: toCashRegisterResponse(duplicate)
            });
        }

        cashRegister.name = cleanName;
    }

    if (lowThreshold !== undefined) {
        if (lowThreshold === null) {
            cashRegister.lowThreshold = null;
        } else {
            if (typeof lowThreshold !== 'object') {
                return res.status(400).json({ message: 'Invalid lowThreshold' });
            }
            const { euro, credits } = lowThreshold as { euro?: unknown; credits?: unknown };

            function parseThreshold(value: unknown): number | null | undefined {
                if (value === undefined || value === null || value === '') return null;
                const n = typeof value === 'string' ? parseFloat(value) : Number(value);
                if (Number.isNaN(n) || n < 0) return undefined;
                return Math.round(n * 100) / 100;
            }

            const nextEuro = parseThreshold(euro);
            if (nextEuro === undefined) return res.status(400).json({ message: 'Invalid lowThreshold.euro' });
            const nextCredits = parseThreshold(credits);
            if (nextCredits === undefined) return res.status(400).json({ message: 'Invalid lowThreshold.credits' });

            /* Entrambe le soglie a null => disattivate, si azzera il sottodocumento. */
            cashRegister.lowThreshold =
                nextEuro === null && nextCredits === null
                    ? null
                    : { euro: nextEuro, credits: nextCredits };
        }
    }

    await cashRegister.save();

    return res.status(200).json({ item: toCashRegisterResponse(cashRegister) });
}

async function closeCashRegister(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { cashRegisterId } = req.params as { cashRegisterId: string };
    const found = await findCashRegister(req, cashRegisterId);
    if ('error' in found) return res.status(found.error.status).json({ message: found.error.message });
    const cashRegister = found.cashRegister;

    if (cashRegister.status !== 'open') {
        return res.status(400).json({ message: 'Cassa già chiusa' });
    }

    cashRegister.status = 'closed';
    cashRegister.closedAt = new Date();
    await cashRegister.save();

    return res.status(200).json({ item: toCashRegisterResponse(cashRegister) });
}

/* Chiusura collettiva di ogni cassa ancora aperta dell'evento: la master
 * chiude il banco a fine serata senza dover passare cassa per cassa. */
async function closeAllCashRegisters(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const result = await CashRegisterModel.updateMany(
        { eventId: new Types.ObjectId(eventCtx.eventId), status: 'open' },
        { $set: { status: 'closed', closedAt: new Date() } }
    );

    return res.status(200).json({
        closedRegisters: result.modifiedCount ?? 0
    });
}

/* Azzeramento totale del banco cambio dell'evento: chiude ogni cassa, azzera
 * i fondi e i portafogli e cancella FISICAMENTE lo storico delle transazioni
 * (nessuno storico residuo). Usato dal pulsante "Azzera tutto" del Master Cambio. */
async function resetAllCashRegisters(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const eventIdObj = new Types.ObjectId(eventCtx.eventId);
    const now = new Date();

    /* Le casse NON vengono solo chiuse: l'azzeramento elimina anche il loro
     * storico, quindi la lista di un evento azzerato riparte vuota e non
     * resta una fila di casse "chiuse" con fondi a zero. */
    const [registers, transactions, movements, requests, usages, wallets] = await Promise.all([
        CashRegisterModel.deleteMany({ eventId: eventIdObj }),
        EventUserTransactionModel.deleteMany({ eventId: eventIdObj }),
        CashRegisterMovementModel.deleteMany({ eventId: eventIdObj }),
        CashRequestModel.deleteMany({ eventId: eventIdObj }),
        PromotionUsageModel.deleteMany({ eventId: eventIdObj }),
        EventUserModel.updateMany({ eventId: eventIdObj }, { $set: { balance: 0 } })
    ]);

    return res.status(200).json({
        deletedRegisters: registers.deletedCount ?? 0,
        deletedTransactions: transactions.deletedCount ?? 0,
        deletedMovements: movements.deletedCount ?? 0,
        deletedRequests: requests.deletedCount ?? 0,
        deletedPromotionUsages: usages.deletedCount ?? 0,
        resetWallets: wallets.modifiedCount ?? 0,
        resetAt: now.toISOString()
    });
}


/* ------------------------------------------------------------------ *
 * Richieste dalle postazioni alla cassa master
 * ------------------------------------------------------------------ */

type CashRequestDoc = {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    cashRegisterId: Types.ObjectId;
    kind: string;
    amountEuro?: number | null;
    amountCredits?: number | null;
    note?: string | null;
    isAutomatic?: boolean;
    contentEuro?: number | null;
    contentCredits?: number | null;
    status: string;
    requestedByUserId: Types.ObjectId;
    requestedAt: Date;
    acknowledgedAt?: Date | null;
    acknowledgedByUserId?: Types.ObjectId | null;
    deliveredAt?: Date | null;
    deliveredByUserId?: Types.ObjectId | null;
    deliveredEuro?: number | null;
    deliveredCredits?: number | null;
    cancelledAt?: Date | null;
    confirmedAt?: Date | null;
    confirmedByUserId?: Types.ObjectId | null;
};

function toCashRequestResponse(
    r: CashRequestDoc,
    registerName: string | null = null,
    requestedByName: string | null = null,
    handledByName: string | null = null
) {
    return {
        id: r._id.toString(),
        eventId: r.eventId.toString(),
        cashRegisterId: r.cashRegisterId.toString(),
        cashRegisterName: registerName,
        kind: r.kind,
        amountEuro: r.amountEuro ?? null,
        amountCredits: r.amountCredits ?? null,
        note: r.note ?? null,
        isAutomatic: r.isAutomatic ?? false,
        contentEuro: r.contentEuro ?? null,
        contentCredits: r.contentCredits ?? null,
        status: r.status,
        requestedByUserId: r.requestedByUserId?.toString() ?? null,
        requestedByName,
        requestedAt: r.requestedAt,
        acknowledgedAt: r.acknowledgedAt ?? null,
        acknowledgedByUserId: r.acknowledgedByUserId?.toString() ?? null,
        deliveredAt: r.deliveredAt ?? null,
        deliveredByUserId: r.deliveredByUserId?.toString() ?? null,
        deliveredEuro: r.deliveredEuro ?? null,
        deliveredCredits: r.deliveredCredits ?? null,
        handledByName,
        cancelledAt: r.cancelledAt ?? null,
        confirmedAt: r.confirmedAt ?? null,
        confirmedByUserId: r.confirmedByUserId?.toString() ?? null
    };
}

/* Nomi di cassa + operatori (richiedente / chi gestisce) senza N+1. */
async function loadCashRequestNames(requests: CashRequestDoc[]) {
    const registerIds = [...new Set(requests.map((r) => r.cashRegisterId.toString()))];
    const registers = await CashRegisterModel.find({ _id: { $in: registerIds } })
        .select('name')
        .lean();
    const registerMap = new Map(registers.map((r) => [r._id.toString(), r.name as string]));

    const userIds = [
        ...new Set(
            requests
                .flatMap((r) => [r.requestedByUserId, r.acknowledgedByUserId, r.deliveredByUserId])
                .filter((id): id is Types.ObjectId => Boolean(id))
                .map((id) => id.toString())
        )
    ];
    const users = await UserModel.find({ _id: { $in: userIds } })
        .select('firstName lastName')
        .lean();
    const userMap = new Map(
        users.map((u) => [
            u._id.toString(),
            `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Operatore'
        ])
    );

    return { registerMap, userMap };
}

function requestTakesEuro(kind: string): boolean {
    return kind === 'euro' || kind === 'both';
}

function requestTakesCredits(kind: string): boolean {
    return kind === 'credits' || kind === 'both';
}

async function listCashRequests(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const match: Record<string, unknown> = { eventId: eventCtx.eventId };

    const statusFilter = typeof req.query.status === 'string' ? req.query.status : '';
    if (statusFilter) {
        const statuses = statusFilter
            .split(',')
            .map((s) => s.trim())
            .filter((s): s is (typeof cashRequestStatusValues)[number] =>
                (cashRequestStatusValues as readonly string[]).includes(s)
            );
        if (statuses.length === 0) {
            return res.status(400).json({ message: 'Invalid status filter' });
        }
        match.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }

    if (isValidObjectId(req.query.cashRegisterId as string)) {
        match.cashRegisterId = new Types.ObjectId(req.query.cashRegisterId as string);
    }

    const requestedAt: Record<string, Date> = {};
    if (req.query.from) {
        const from = new Date(req.query.from as string);
        if (!Number.isNaN(from.getTime())) requestedAt.$gte = from;
    }
    if (req.query.to) {
        const to = new Date(req.query.to as string);
        if (!Number.isNaN(to.getTime())) requestedAt.$lte = to;
    }
    if (Object.keys(requestedAt).length > 0) match.requestedAt = requestedAt;

    const limitRaw = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 100;

    const [requests, pendingCount] = await Promise.all([
        CashRequestModel.find(match).sort({ requestedAt: -1 }).limit(limit),
        CashRequestModel.countDocuments({
            eventId: eventCtx.eventId,
            status: { $in: ['pending', 'acknowledged'] }
        })
    ]);

    const { registerMap, userMap } = await loadCashRequestNames(requests as unknown as CashRequestDoc[]);

    return res.status(200).json({
        items: (requests as unknown as CashRequestDoc[]).map((r) =>
            toCashRequestResponse(
                r,
                registerMap.get(r.cashRegisterId.toString()) ?? null,
                userMap.get(r.requestedByUserId.toString()) ?? null,
                null
            )
        ),
        pendingCount,
        currencyName: eventCtx.event.currencyName,
        currencySymbol: eventCtx.event.currencySymbol ?? null
    });
}

async function createCashRequest(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { cashRegisterId, kind, amountEuro, amountCredits, note, contentEuro, contentCredits, isAutomatic } =
        req.body as {
            cashRegisterId?: unknown;
            kind?: unknown;
            amountEuro?: unknown;
            amountCredits?: unknown;
            note?: unknown;
            contentEuro?: unknown;
            contentCredits?: unknown;
            isAutomatic?: unknown;
        };

    if (typeof cashRegisterId !== 'string' || !isValidObjectId(cashRegisterId)) {
        return res.status(400).json({ message: 'Valid cashRegisterId is required' });
    }
    if (typeof kind !== 'string' || !(cashRequestKindValues as readonly string[]).includes(kind)) {
        return res.status(400).json({ message: "Kind must be 'euro', 'credits' or 'both'" });
    }

    const found = await findCashRegister(req, cashRegisterId);
    if ('error' in found) return res.status(found.error.status).json({ message: found.error.message });
    const cashRegister = found.cashRegister;

    if (cashRegister.status !== 'open') {
        return res.status(400).json({ message: 'Cassa chiusa, richiesta non ammessa' });
    }

    function parseOptional(value: unknown): number | null | undefined {
        if (value === undefined || value === null || value === '') return null;
        const n = typeof value === 'string' ? parseFloat(value) : Number(value);
        if (Number.isNaN(n) || n < 0) return undefined;
        return Math.round(n * 100) / 100;
    }

    const euro = parseOptional(amountEuro);
    if (euro === undefined) return res.status(400).json({ message: 'Invalid amountEuro' });
    const credits = parseOptional(amountCredits);
    if (credits === undefined) return res.status(400).json({ message: 'Invalid amountCredits' });

    /* Gli importi non si confondono mai: o una valuta proposta, o nessuna
     * (richiesta generica, la master decide quanto consegnare). */
    const hasEuro = (euro ?? 0) > 0;
    const hasCredits = (credits ?? 0) > 0;
    if (hasEuro && hasCredits) {
        return res.status(400).json({ message: 'Non è possibile allegare importi sia in euro sia in crediti: scegliere una valuta' });
    }
    if (hasEuro && !requestTakesEuro(kind)) {
        return res.status(400).json({ message: 'Importo in euro non ammesso per una richiesta di soli crediti' });
    }
    if (hasCredits && !requestTakesCredits(kind)) {
        return res.status(400).json({ message: 'Importo in crediti non ammesso per una richiesta di soli euro' });
    }

    /* Una richiesta aperta identica (stessa cassa, stesso kind) viene restituita
     * invece di duplicarla: sia il pulsante manuale sia l'invio automatico per
     * soglia devono essere idempotenti. Il match e' sul kind ESATTO: un Euro
     * gia' aperto non deve spegnere una richiesta "both", altrimenti il
     * cassiere crederrebbe di aver chiesto anche i crediti. */
    const existing = await CashRequestModel.findOne({
        eventId: eventCtx.eventId,
        cashRegisterId: cashRegister._id,
        kind,
        /* 'delivered' resta bloccata finche' la postazione non conferma la
         * ricezione: durante quel tempo non si duplica la richiesta. */
        status: { $in: ['pending', 'acknowledged', 'delivered'] }
    }).sort({ requestedAt: -1 });

    if (existing) {
        const { registerMap, userMap } = await loadCashRequestNames([existing as unknown as CashRequestDoc]);
        return res.status(200).json({
            item: toCashRequestResponse(
                existing as unknown as CashRequestDoc,
                registerMap.get(existing.cashRegisterId.toString()) ?? null,
                userMap.get(existing.requestedByUserId.toString()) ?? null,
                null
            ),
            duplicate: true
        });
    }

    const contentEuroParsed = parseOptional(contentEuro);
    const contentCreditsParsed = parseOptional(contentCredits);

    const created = await CashRequestModel.create({
        eventId: eventCtx.eventId,
        cashRegisterId: cashRegister._id,
        kind,
        amountEuro: hasEuro ? euro : null,
        amountCredits: hasCredits ? credits : null,
        note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 300) : null,
        isAutomatic: isAutomatic === true,
        contentEuro: contentEuroParsed ?? null,
        contentCredits: contentCreditsParsed ?? null,
        status: 'pending',
        requestedByUserId: req.user!.id,
        requestedAt: new Date()
    });

    const { registerMap, userMap } = await loadCashRequestNames([created as unknown as CashRequestDoc]);

    return res.status(201).json({
        item: toCashRequestResponse(
            created as unknown as CashRequestDoc,
            registerMap.get(created.cashRegisterId.toString()) ?? cashRegister.name,
            userMap.get(created.requestedByUserId.toString()) ?? null,
            null
        ),
        duplicate: false
    });
}

async function updateCashRequest(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { requestId } = req.params as { requestId: string };
    if (!isValidObjectId(requestId)) {
        return res.status(400).json({ message: 'Valid requestId is required' });
    }

    const request = await CashRequestModel.findOne({ _id: requestId, eventId: eventCtx.eventId });
    if (!request) {
        return res.status(404).json({ message: 'Richiesta non trovata per questo evento' });
    }

    const { status, deliveredEuro, deliveredCredits } = req.body as {
        status?: unknown;
        deliveredEuro?: unknown;
        deliveredCredits?: unknown;
    };

    if (typeof status !== 'string' || !(cashRequestStatusValues as readonly string[]).includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    const currentStatus: string = request.status;

    /* pending -> acknowledged -> delivered/cancelled, e la postazione chiude il
     * ciclo con 'confirmed' dopo l'accettazione (o la consegna) della master. */
    if (status === 'confirmed') {
        if (currentStatus !== 'acknowledged' && currentStatus !== 'delivered') {
            return res.status(400).json({
                message: 'La postazione può confermare solo dopo l\'accettazione o la consegna della cassa master'
            });
        }

        request.status = 'confirmed';
        request.confirmedAt = new Date();
        request.confirmedByUserId = new Types.ObjectId(req.user!.id);
        await request.save();

        const { registerMap, userMap } = await loadCashRequestNames([request as unknown as CashRequestDoc]);
        return res.status(200).json({
            item: toCashRequestResponse(
                request as unknown as CashRequestDoc,
                registerMap.get(request.cashRegisterId.toString()) ?? null,
                userMap.get(request.requestedByUserId.toString()) ?? null,
                userMap.get(req.user!.id) ?? null
            )
        });
    }

    /* 'delivered', 'confirmed' e 'cancelled' sono immutabili. */
    if (currentStatus === 'delivered' || currentStatus === 'cancelled' || currentStatus === 'confirmed') {
        const labels: Record<string, string> = {
            delivered: 'consegnata',
            cancelled: 'annullata',
            confirmed: 'gia\' confermata dalla postazione'
        };
        return res.status(400).json({
            message: `Richiesta ${labels[currentStatus] ?? currentStatus}`
        });
    }
    if (status === 'acknowledged' && currentStatus !== 'pending') {
        return res.status(400).json({ message: 'Richiesta non in attesa di presa in carico' });
    }
    if (status === 'pending') {
        return res.status(400).json({ message: 'Stato non valido' });
    }

    function parseOptional(value: unknown): number | null | undefined {
        if (value === undefined || value === null || value === '') return null;
        const n = typeof value === 'string' ? parseFloat(value) : Number(value);
        if (Number.isNaN(n) || n < 0) return undefined;
        return Math.round(n * 100) / 100;
    }

    if (status === 'acknowledged') {
        request.status = 'acknowledged';
        request.acknowledgedAt = new Date();
        request.acknowledgedByUserId = new Types.ObjectId(req.user!.id);
        await request.save();

        const { registerMap, userMap } = await loadCashRequestNames([request as unknown as CashRequestDoc]);
        return res.status(200).json({
            item: toCashRequestResponse(
                request as unknown as CashRequestDoc,
                registerMap.get(request.cashRegisterId.toString()) ?? null,
                userMap.get(request.requestedByUserId.toString()) ?? null,
                userMap.get(req.user!.id) ?? null
            )
        });
    }

    if (status === 'cancelled') {
        request.status = 'cancelled';
        request.cancelledAt = new Date();
        await request.save();

        const { registerMap, userMap } = await loadCashRequestNames([request as unknown as CashRequestDoc]);
        return res.status(200).json({
            item: toCashRequestResponse(
                request as unknown as CashRequestDoc,
                registerMap.get(request.cashRegisterId.toString()) ?? null,
                userMap.get(request.requestedByUserId.toString()) ?? null,
                null
            )
        });
    }

    /* status === 'delivered' */
    const euro = parseOptional(deliveredEuro);
    if (euro === undefined) return res.status(400).json({ message: 'Invalid deliveredEuro' });
    const credits = parseOptional(deliveredCredits);
    if (credits === undefined) return res.status(400).json({ message: 'Invalid deliveredCredits' });

    if (!requestTakesEuro(request.kind) && (euro ?? 0) > 0) {
        return res.status(400).json({ message: 'Richiesta di soli crediti: deliveredEuro non ammesso' });
    }
    if (!requestTakesCredits(request.kind) && (credits ?? 0) > 0) {
        return res.status(400).json({ message: 'Richiesta di soli euro: deliveredCredits non ammesso' });
    }
    /* Su richiesta singola la valuta richiesta e' obbligatoria; su "both" basta
     * una delle due, ma non possono essere entrambe nulle. */
    if (requestTakesEuro(request.kind) && !requestTakesCredits(request.kind) && !(euro ?? 0)) {
        return res.status(400).json({ message: 'Indicare la somma in euro consegnata' });
    }
    if (requestTakesCredits(request.kind) && !requestTakesEuro(request.kind) && !(credits ?? 0)) {
        return res.status(400).json({ message: 'Indicare la somma in crediti consegnata' });
    }
    if (requestTakesEuro(request.kind) && requestTakesCredits(request.kind) && !(euro ?? 0) && !(credits ?? 0)) {
        return res.status(400).json({ message: 'Indicare almeno un importo consegnato' });
    }

    const cashRegister = await CashRegisterModel.findOne({
        _id: request.cashRegisterId,
        eventId: eventCtx.eventId
    });
    if (!cashRegister) {
        return res.status(404).json({ message: 'Cash register not found for this event' });
    }

    request.status = 'delivered';
    request.deliveredAt = new Date();
    request.deliveredByUserId = new Types.ObjectId(req.user!.id);
    request.deliveredEuro = euro ?? 0;
    request.deliveredCredits = credits ?? 0;
    if (!request.acknowledgedAt) {
        request.acknowledgedAt = request.deliveredAt;
        request.acknowledgedByUserId = new Types.ObjectId(req.user!.id);
    }
    await request.save();

    /* La consegna versa fisicamente il contante/token nella cassa ricevente:
     * si registra il movimento in ingresso cosi' il contenuto della cassa
     * torna coerente. L'uscita dalla cassa master resta a carico della master
     * (stessa logica dei movimenti manuali gia' esistenti). */
    const movements: Array<{ currency: 'euro' | 'credits'; amount: number }> = [];
    if (requestTakesEuro(request.kind) && (euro ?? 0) > 0) movements.push({ currency: 'euro', amount: euro! });
    if (requestTakesCredits(request.kind) && (credits ?? 0) > 0) {
        movements.push({ currency: 'credits', amount: credits! });
    }
    for (const movement of movements) {
        await CashRegisterMovementModel.create({
            eventId: eventCtx.eventId,
            currency: movement.currency,
            direction: 'in',
            amount: movement.amount,
            description: `Consegna cassa master (richiesta del ${new Date(request.requestedAt).toLocaleString('it-IT')})`,
            performedByUserId: req.user!.id,
            cashRegisterId: cashRegister._id,
            occurredAt: new Date()
        });
    }

    const { registerMap, userMap } = await loadCashRequestNames([request as unknown as CashRequestDoc]);
    return res.status(200).json({
        item: toCashRequestResponse(
            request as unknown as CashRequestDoc,
            registerMap.get(request.cashRegisterId.toString()) ?? cashRegister.name,
            userMap.get(request.requestedByUserId.toString()) ?? null,
            userMap.get(req.user!.id) ?? null
        ),
        movementsCreated: movements.length
    });
}

async function getCashRegisterStats(
    eventId: string,
    cashRegisterId: Types.ObjectId,
    since?: Date | null,
    to?: Date | null
) {
    const eventIdObj = new Types.ObjectId(eventId);
    const exchangeTypes = ['top-up', 'refund'];

    const allTimeMatch: Record<string, unknown> = {
        eventId: eventIdObj,
        cashRegisterId,
        type: { $in: exchangeTypes }
    };
    const sinceMatch: Record<string, unknown> = { ...allTimeMatch };
    const occurredAt: Record<string, Date> = {};
    if (since && !Number.isNaN(since.getTime())) occurredAt.$gte = since;
    if (to && !Number.isNaN(to.getTime())) occurredAt.$lte = to;
    if (Object.keys(occurredAt).length > 0) sinceMatch.occurredAt = occurredAt;

    const [txRows, txSinceRows, realRows, movementRows] = await Promise.all([
        EventUserTransactionModel.aggregate([
            { $match: allTimeMatch },
            { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        EventUserTransactionModel.aggregate([
            { $match: sinceMatch },
            { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        EventUserTransactionModel.aggregate(realByMethodPipeline(allTimeMatch)),
        CashRegisterMovementModel.aggregate([
            { $match: { eventId: eventIdObj, cashRegisterId } },
            { $group: { _id: { currency: '$currency', direction: '$direction' }, total: { $sum: '$amount' } } }
        ])
    ]);

    function extract(rows: Array<{ _id: string; total: number; count?: number }>) {
        let topUp = 0, refund = 0, topUpCount = 0, refundCount = 0;
        for (const row of rows) {
            if (row._id === 'top-up') { topUp = row.total; topUpCount = row.count ?? 0; }
            else if (row._id === 'refund') { refund = row.total; refundCount = row.count ?? 0; }
        }
        return { topUp, refund, topUpCount, refundCount };
    }

    const all = extract(txRows);
    const sinceStats = extract(txSinceRows);
    const split = extractRealSplit(realRows);
    const topUpRealEuro = split.topUpCash + split.topUpPos;
    const refundRealEuro = split.refundCash + split.refundPos;

    let euroIn = 0, euroOut = 0, creditsIn = 0, creditsOut = 0;
    for (const row of movementRows) {
        if (row._id.currency === 'euro') {
            if (row._id.direction === 'in') euroIn = row.total; else euroOut = row.total;
        } else {
            if (row._id.direction === 'in') creditsIn = row.total; else creditsOut = row.total;
        }
    }

    return {
        topUp: all.topUp,
        refund: all.refund,
        topUpCount: all.topUpCount,
        refundCount: all.refundCount,
        topUpReal: roundEuro(topUpRealEuro),
        refundReal: roundEuro(refundRealEuro),
        topUpRealCash: roundEuro(split.topUpCash),
        refundRealCash: roundEuro(split.refundCash),
        topUpRealPos: roundEuro(split.topUpPos),
        refundRealPos: roundEuro(split.refundPos),
        posNetReal: roundEuro(split.topUpPos - split.refundPos),
        topUpPosCount: split.topUpPosCount,
        refundPosCount: split.refundPosCount,
        sinceTopUpCount: sinceStats.topUpCount,
        sinceRefundCount: sinceStats.refundCount,
        euroIn,
        euroOut,
        creditsIn,
        creditsOut
    };
}

async function getCashRegisterBalance(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { cashRegisterId } = req.params as { cashRegisterId: string };
    const found = await findCashRegister(req, cashRegisterId);
    if ('error' in found) return res.status(found.error.status).json({ message: found.error.message });
    const cashRegister = found.cashRegister;

    const since = req.query.since ? new Date(req.query.since as string) : null;
    const stats = await getCashRegisterStats(eventCtx.eventId, cashRegister._id, since);

    const float = cashRegister.cashFloat ?? { euro: 0, credits: 0, setAt: null };

    return res.status(200).json({
        id: cashRegister._id.toString(),
        name: cashRegister.name,
        status: cashRegister.status,
        exchangeRate: eventCtx.event.exchangeRate ?? 1,
        currencyName: eventCtx.event.currencyName,
        currencySymbol: eventCtx.event.currencySymbol ?? null,
        cashFloat: { euro: float.euro, credits: float.credits, setAt: float.setAt ?? null },
        lowThreshold: {
            euro: cashRegister.lowThreshold?.euro ?? null,
            credits: cashRegister.lowThreshold?.credits ?? null
        },
        topUp: stats.topUp,
        refund: stats.refund,
        topUpCount: stats.topUpCount,
        refundCount: stats.refundCount,
        topUpReal: stats.topUpReal,
        refundReal: stats.refundReal,
        topUpRealCash: stats.topUpRealCash,
        refundRealCash: stats.refundRealCash,
        topUpRealPos: stats.topUpRealPos,
        refundRealPos: stats.refundRealPos,
        posNetReal: stats.posNetReal,
        topUpPosCount: stats.topUpPosCount,
        refundPosCount: stats.refundPosCount,
        // Il contenuto fisico della cassa conta SOLO i contanti: un top-up con POS
        // incassa sul terminale e non entra nel cassettone (idem il rimborso POS).
        euroContent: roundEuro(float.euro + stats.topUpRealCash - stats.refundRealCash + stats.euroIn - stats.euroOut),
        creditsContent: Math.round((float.credits - stats.topUp + stats.refund + stats.creditsIn - stats.creditsOut) * 100) / 100,
        cashMovements: {
            euroIn: stats.euroIn,
            euroOut: stats.euroOut,
            creditsIn: stats.creditsIn,
            creditsOut: stats.creditsOut
        },
        since: since && !Number.isNaN(since.getTime()) ? since.toISOString() : null,
        sinceTopUpCount: since && !Number.isNaN(since.getTime()) ? stats.sinceTopUpCount : null,
        sinceRefundCount: since && !Number.isNaN(since.getTime()) ? stats.sinceRefundCount : null
    });
}

async function getCashRegistersReport(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    let from: Date | null = req.query.from ? new Date(req.query.from as string) : null;
    const to = req.query.to ? new Date(req.query.to as string) : null;
    if (!from || Number.isNaN(from.getTime())) {
        from = eventCtx.event.startDate ?? null;
    }

    const cashRegisters = await CashRegisterModel.find({ eventId: eventCtx.eventId }).sort({ openedAt: 1 });
    const openerMap = await loadOpenerNames(cashRegisters);

    const statsPerCassa = await Promise.all(
        cashRegisters.map((cr) =>
            getCashRegisterStats(eventCtx.eventId, cr._id, from, to ?? null).then((stats) => ({ cr, stats }))
        )
    );

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const items = statsPerCassa.map(({ cr, stats }) => {
        const float = cr.cashFloat ?? { euro: 0, credits: 0, setAt: null };
        const topUpReal = stats.topUpReal;
        const refundReal = stats.refundReal;
        return {
            id: cr._id.toString(),
            name: cr.name,
            status: cr.status,
            openedByUserId: cr.openedByUserId?.toString() ?? null,
            openedByName: openerMap.get(cr.openedByUserId?.toString() ?? '') ?? null,
            openedAt: cr.openedAt,
            closedAt: cr.closedAt ?? null,
            cashFloat: { euro: float.euro, credits: float.credits, setAt: float.setAt ?? null },
            lowThreshold: {
                euro: cr.lowThreshold?.euro ?? null,
                credits: cr.lowThreshold?.credits ?? null
            },
            topUp: round2(stats.topUp),
            refund: round2(stats.refund),
            topUpCount: stats.topUpCount,
            refundCount: stats.refundCount,
            topUpReal: round2(topUpReal),
            refundReal: round2(refundReal),
            topUpRealCash: round2(stats.topUpRealCash),
            refundRealCash: round2(stats.refundRealCash),
            topUpRealPos: round2(stats.topUpRealPos),
            refundRealPos: round2(stats.refundRealPos),
            posNetReal: round2(stats.posNetReal),
            topUpPosCount: stats.topUpPosCount,
            refundPosCount: stats.refundPosCount,
            euroContent: round2(float.euro + stats.topUpRealCash - stats.refundRealCash + stats.euroIn - stats.euroOut),
            creditsContent: round2(float.credits - stats.topUp + stats.refund + stats.creditsIn - stats.creditsOut),
            sinceTopUpCount: stats.sinceTopUpCount,
            sinceRefundCount: stats.sinceRefundCount,
            sinceTotalCount: stats.sinceTopUpCount + stats.sinceRefundCount
        };
    });

    const totals = {
        openCount: items.filter((i) => i.status === 'open').length,
        closedCount: items.filter((i) => i.status === 'closed').length,
        floatEuro: round2(items.reduce((a, i) => a + i.cashFloat.euro, 0)),
        floatCredits: round2(items.reduce((a, i) => a + i.cashFloat.credits, 0)),
        euroContent: round2(items.reduce((a, i) => a + i.euroContent, 0)),
        creditsContent: round2(items.reduce((a, i) => a + i.creditsContent, 0)),
        topUpRealCash: round2(items.reduce((a, i) => a + i.topUpRealCash, 0)),
        refundRealCash: round2(items.reduce((a, i) => a + i.refundRealCash, 0)),
        topUpRealPos: round2(items.reduce((a, i) => a + i.topUpRealPos, 0)),
        refundRealPos: round2(items.reduce((a, i) => a + i.refundRealPos, 0)),
        posNetReal: round2(items.reduce((a, i) => a + i.posNetReal, 0)),
        topUpPosCount: items.reduce((a, i) => a + i.topUpPosCount, 0),
        refundPosCount: items.reduce((a, i) => a + i.refundPosCount, 0),
        sinceTotalCount: items.reduce((a, i) => a + i.sinceTotalCount, 0),
        sinceTopUpCount: items.reduce((a, i) => a + i.sinceTopUpCount, 0),
        sinceRefundCount: items.reduce((a, i) => a + i.sinceRefundCount, 0)
    };

    return res.status(200).json({
        eventId: eventCtx.eventId,
        eventName: eventCtx.event.name,
        exchangeRate: eventCtx.event.exchangeRate ?? 1,
        currencyName: eventCtx.event.currencyName,
        currencySymbol: eventCtx.event.currencySymbol ?? null,
        from: from && !Number.isNaN(from.getTime()) ? from.toISOString() : null,
        to: to && !Number.isNaN(to.getTime()) ? to.toISOString() : null,
        items,
        totals
    });
}

async function createGuest(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

const { displayName } = req.body as { displayName?: string };
    const name = displayName?.trim() || null;

    /* Un ospite SENZA nome non e' un cliente nuovo: e' il cliente generico
     * dell'evento, quello di default per le operazioni senza cliente. Senza
     * questo ogni "+ Crea" a vuoto creava un SECONDO wallet anonimo con saldo
     * 0, e la select poteva finire su quello: saldo 0 e rimborso bloccato. */
    if (!name) {
        const generic = (await EventUserModel.findOne({
            eventId: eventCtx.eventId,
            userId: null,
            displayName: null,
            isActive: true
        }).sort({ joinedAt: 1 })) ?? (await EventUserModel.create({
            eventId: eventCtx.eventId,
            userId: null,
            balance: 0
        }));

        return res.status(200).json({
            item: {
                id: generic._id.toString(),
                eventId: generic.eventId.toString(),
                userId: null,
                firstName: null,
                lastName: null,
                email: null,
                balance: generic.balance,
                isAnonymous: true,
                isGeneric: true,
                isActive: generic.isActive,
                joinedAt: generic.joinedAt,
                displayName: null
            },
            reused: true
        });
    }

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
            isGeneric: false,
            isActive: true,
joinedAt: eventUser.joinedAt,
            displayName: eventUser.displayName
        }
    });
}

async function denominationReport(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const eventDenoms = eventCtx.event.denominations ?? [];
    if (eventDenoms.length === 0) {
        return res.status(200).json({ items: [] });
    }

    /* Aggregate returned counts per label from all credit settlements */
    const returnedAgg = await StandSettlementModel.aggregate([
        { $match: { eventId: new Types.ObjectId(eventCtx.eventId), direction: 'credit', 'denominations.0': { $exists: true } } },
        { $unwind: '$denominations' },
        { $group: {
            _id: '$denominations.label',
            totalCount: { $sum: '$denominations.count' },
            totalEuro: { $sum: '$denominations.euroAmount' }
        } }
    ]) as Array<{ _id: string; totalCount: number; totalEuro: number }>;

    const returnedMap = new Map(returnedAgg.map((r) => [r._id, r]));

    const items = eventDenoms.map((d) => {
        const returned = returnedMap.get(d.label);
        const returnedCount = returned?.totalCount ?? 0;
        const returnedEuro = returned?.totalEuro ?? 0;
        const lostCount = d.quantity - returnedCount;
        const anomaly = returnedCount > d.quantity;

        return {
            label: d.label,
            value: d.value,
            issued: d.quantity,
            returned: returnedCount,
            returnedEuro: Math.round(returnedEuro * 100) / 100,
            lost: lostCount,
            anomaly
        };
    });

    return res.status(200).json({ items });
}

export const exchangeController = {
    listUsers,
    getEventUserBalance,
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
    createGuest,
    denominationReport,
    setCashFloat,
    addCashMovement,
    listCashMovements,
    listCashRegisters,
    createCashRegister,
    updateCashRegister,
    closeCashRegister,
    closeAllCashRegisters,
    resetAllCashRegisters,
    getCashRegisterBalance,
    getCashRegistersReport,
    listCashRequests,
    createCashRequest,
    updateCashRequest
};
