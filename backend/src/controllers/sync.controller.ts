import { Types } from 'mongoose';
import type { Request, Response } from 'express';

import { env } from '../config/env';
import { CounterModel } from '../models/counter.model';
import { EventUserModel } from '../models/event-user.model';
import { EventUserTransactionModel } from '../models/event-user-transaction.model';
import { EventProductModel } from '../models/event-product.model';
import { EventModel } from '../models/event.model';
import { OrderModel } from '../models/order.model';
import { ProductModel } from '../models/product.model';
import { StandModel } from '../models/stand.model';
import { StationModel } from '../models/station.model';

function isValidObjectId(value: unknown): value is string {
    return typeof value === 'string' && Types.ObjectId.isValid(value);
}

function toAuth(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
    return token;
}

export function syncAuthMiddleware(req: Request, res: Response, next: () => void) {
    if (!env.SYNC_API_TOKEN) {
        return res.status(503).json({ message: 'Sync API non configurata (SYNC_API_TOKEN mancante)' });
    }
    if (toAuth(req) !== env.SYNC_API_TOKEN) {
        return res.status(401).json({ message: 'Sync token non valido' });
    }
    return next();
}

function toEventLite(event: { _id: Types.ObjectId | string; name: string; startDate: Date; endDate: Date; currencyName: string; exchangeRate?: number }) {
    return {
        id: event._id.toString(),
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        currencyName: event.currencyName,
        exchangeRate: event.exchangeRate
    };
}

export async function listSyncEvents(req: Request, res: Response) {
    const now = new Date();
    const events = await EventModel.find({ endDate: { $gte: now } }).sort({ startDate: 1 }).lean();
    return res.status(200).json({ items: events.map(toEventLite) });
}

export async function listSyncStands(req: Request, res: Response) {
    const { eventId } = req.params;
    if (!isValidObjectId(eventId)) return res.status(400).json({ message: 'Invalid eventId' });

    const event = await EventModel.findById(eventId).lean();
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const stands = await StandModel.find({ eventIds: new Types.ObjectId(eventId) }).lean();
    const items = stands
        .map((stand) => {
            const numberEntry = (stand.numbers as unknown as Array<{ eventId?: { toString(): string }; number?: number }> | undefined)?.find(
                (n) => n?.eventId?.toString() === eventId
            );
            return {
                id: stand._id.toString(),
                name: stand.name,
                type: stand.type,
                number: numberEntry?.number ?? null
            };
        })
        .sort((a, b) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER));

    return res.status(200).json({
        event: toEventLite(event),
        items
    });
}

export async function getSyncSnapshot(req: Request, res: Response) {
    const { eventId, standId } = req.params;
    if (!isValidObjectId(eventId)) return res.status(400).json({ message: 'Invalid eventId' });
    if (!isValidObjectId(standId)) return res.status(400).json({ message: 'Invalid standId' });

    const event = await EventModel.findById(eventId).lean();
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const stand = await StandModel.findById(standId).lean();
    if (!stand) return res.status(404).json({ message: 'Stand not found' });
    if (!stand.eventIds.some((id) => id.toString() === eventId)) {
        return res.status(400).json({ message: 'Stand does not belong to the event' });
    }

    const [stations, eventProducts, eventUsers, counter] = await Promise.all([
        StationModel.find({ standId: stand._id }).lean(),
        EventProductModel.find({ eventId: new Types.ObjectId(eventId), standId: stand._id }).lean(),
        EventUserModel.find({ eventId: new Types.ObjectId(eventId) }).lean(),
        CounterModel.findOne({ standId: stand._id }).lean()
    ]);

    const productIds = eventProducts.map((ep: { productId: Types.ObjectId }) => ep.productId);
    const products = await ProductModel.find({ _id: { $in: productIds } }).lean();

    return res.status(200).json({
        event,
        stand,
        stations,
        products,
        eventProducts,
        eventUsers,
        counter: counter ?? { standId: stand._id, seq: 0 }
    });
}

export async function pushSyncChanges(req: Request, res: Response) {
    const body: {
        orders?: Array<Record<string, unknown>>;
        transactions?: Array<Record<string, unknown>>;
        counters?: Array<Record<string, unknown>>;
        eventUserBalances?: Array<Record<string, unknown>>;
    } = req.body ?? {};

    const results = { orders: 0, transactions: 0, counters: 0, eventUserBalances: 0 };

    if (Array.isArray(body.orders) && body.orders.length > 0) {
        for (const incoming of body.orders) {
            if (!incoming?._id || !isValidObjectId(incoming._id)) continue;
            const remoteId = new Types.ObjectId(incoming._id);
            const incomingUpdated = new Date((incoming.updatedAt as Date | undefined) ?? 0);
            const existing = await OrderModel.findById(remoteId).lean();
            if (!existing) {
                await OrderModel.create(sanitizeDoc({ ...incoming, _id: remoteId }));
            } else if (incomingUpdated >= new Date(existing.updatedAt ?? 0)) {
                await OrderModel.updateOne(
                    { _id: remoteId },
                    { $set: sanitizeDoc({ ...incoming, _id: remoteId, createdAt: existing.createdAt }) }
                );
            }
            results.orders += 1;
        }
    }

    if (Array.isArray(body.transactions) && body.transactions.length > 0) {
        for (const incoming of body.transactions) {
            if (!incoming?._id || !isValidObjectId(incoming._id)) continue;
            const remoteId = new Types.ObjectId(incoming._id);
            const incomingAt = new Date((incoming.occurredAt as Date | undefined) ?? 0);
            const existing = await EventUserTransactionModel.findById(remoteId).lean();
            if (!existing) {
                await EventUserTransactionModel.create(sanitizeDoc({ ...incoming, _id: remoteId }));
            } else if (incomingAt >= new Date(existing.occurredAt ?? 0)) {
                await EventUserTransactionModel.updateOne({ _id: remoteId }, { $set: sanitizeDoc(incoming) });
            }
            results.transactions += 1;
        }
    }

    if (Array.isArray(body.counters) && body.counters.length > 0) {
        for (const incoming of body.counters) {
            if (!incoming?.standId || !isValidObjectId(incoming.standId)) continue;
            const standId = new Types.ObjectId(incoming.standId);
            const existing = await CounterModel.findOne({ standId });
            const incomingSeq = Number(incoming.seq) || 0;
            if (!existing) {
                await CounterModel.create({ standId, seq: incomingSeq });
            } else if (incomingSeq > existing.seq) {
                existing.seq = incomingSeq;
                await existing.save();
            }
            results.counters += 1;
        }
    }

    if (Array.isArray(body.eventUserBalances) && body.eventUserBalances.length > 0) {
        for (const incoming of body.eventUserBalances) {
            if (!incoming?._id || !isValidObjectId(incoming._id)) continue;
            const remoteId = new Types.ObjectId(incoming._id);
            const incomingUpdated = new Date((incoming.updatedAt as Date | undefined) ?? 0);
            const existing = await EventUserModel.findById(remoteId).lean();
            if (!existing) {
                await EventUserModel.create(sanitizeDoc({ ...incoming, _id: remoteId }));
            } else if (incomingUpdated >= new Date(existing.updatedAt ?? 0)) {
                await EventUserModel.updateOne({ _id: remoteId }, { $set: { balance: Number(incoming.balance) || 0 } });
            }
            results.eventUserBalances += 1;
        }
    }

    return res.status(200).json({ results });
}

function sanitizeDoc(doc: Record<string, unknown>): Record<string, unknown> {
    const clone: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(doc)) {
        if (key === 'createdAt' || key === '__v') continue;
        clone[key] = value;
    }
    return clone;
}
