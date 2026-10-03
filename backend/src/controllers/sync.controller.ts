import { Types } from 'mongoose';
import * as argon2 from 'argon2';
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

function toSyncPassword(req: Request): string | null {
    const value = req.headers['x-sync-password'];
    if (typeof value !== 'string' || value.length === 0) return null;
    return value;
}

/**
 * Verifies the per-stand sync password. Returns null when valid, otherwise the
 * HTTP status to answer with: 403 when the stand has no password configured,
 * 401 when the provided password is missing or wrong.
 */
async function verifyStandSyncPassword(
    stand: { syncPasswordHash?: string | null },
    req: Request
): Promise<number | null> {
    if (!stand.syncPasswordHash) return 403;
    const provided = toSyncPassword(req);
    if (!provided) return 401;
    const valid = await argon2.verify(stand.syncPasswordHash, provided);
    return valid ? null : 401;
}

function syncPasswordError(status: number): string {
    return status === 403
        ? 'Password di sincronizzazione non configurata per questo stand'
        : 'Password di sincronizzazione non valida';
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
                number: numberEntry?.number ?? null,
                syncEnabled: stand.syncPasswordHash != null
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

    const passwordStatus = await verifyStandSyncPassword(stand, req);
    if (passwordStatus) {
        return res.status(passwordStatus).json({ message: syncPasswordError(passwordStatus) });
    }

    const [stations, eventProducts, eventUsers, counter] = await Promise.all([
        StationModel.find({ standId: stand._id }).lean(),
        EventProductModel.find({ eventId: new Types.ObjectId(eventId), standId: stand._id }).lean(),
        EventUserModel.find({ eventId: new Types.ObjectId(eventId) }).lean(),
        CounterModel.findOne({ standId: stand._id }).lean()
    ]);

    const productIds = eventProducts.map((ep: { productId: Types.ObjectId }) => ep.productId);
    const products = await ProductModel.find({ _id: { $in: productIds } }).lean();

    const standSafe = { ...stand };
    delete (standSafe as { syncPasswordHash?: string }).syncPasswordHash;

    return res.status(200).json({
        event,
        stand: standSafe,
        stations,
        products,
        eventProducts,
        eventUsers,
        counter: counter ?? { standId: stand._id, seq: 0 }
    });
}

export async function pushSyncChanges(req: Request, res: Response) {
    const body: {
        standId?: string;
        orders?: Array<Record<string, unknown>>;
        transactions?: Array<Record<string, unknown>>;
        counters?: Array<Record<string, unknown>>;
        eventUserBalances?: Array<Record<string, unknown>>;
    } = req.body ?? {};

    if (!body.standId || !isValidObjectId(body.standId)) {
        return res.status(400).json({ message: 'standId richiesto' });
    }
    const stand = await StandModel.findById(body.standId).lean();
    if (!stand) return res.status(404).json({ message: 'Stand not found' });

    const passwordStatus = await verifyStandSyncPassword(stand, req);
    if (passwordStatus) {
        return res.status(passwordStatus).json({ message: syncPasswordError(passwordStatus) });
    }

    const results = { orders: 0, transactions: 0, counters: 0, eventUserBalances: 0 };
    /** Ordini rifiutati: non scritti, e restituiti al locale perché li segnali. */
    const rejected: SyncRejectedOrder[] = [];

    if (Array.isArray(body.orders) && body.orders.length > 0) {
        /* La finestra dell'evento serve a rifiutare gli ordini presi dopo la
           chiusura: si caricano gli eventi distinti presenti nel payload (di
           fatto uno) invece di farlo per ogni ordine. */
        const eventIds = [...new Set(body.orders
            .map((o) => o?.eventId)
            .filter((id): id is string => typeof id === 'string' && isValidObjectId(id))
            .map((id) => new Types.ObjectId(id).toString()))];
        const eventsById = new Map<string, { startDate?: Date | null; endDate?: Date | null }>();
        if (eventIds.length > 0) {
            const events = await EventModel.find({ _id: { $in: eventIds.map((id) => new Types.ObjectId(id)) } })
                .select('startDate endDate')
                .lean();
            for (const ev of events) eventsById.set(ev._id.toString(), ev);
        }

        for (const incoming of body.orders) {
            if (!incoming?._id || !isValidObjectId(incoming._id)) continue;
            const remoteId = new Types.ObjectId(incoming._id);

            /* Fa fede l'orologio del notebook, non l'ora del push: `orderedAt`
               e' l'istante in cui l'ordine e' stato preso in cassa. */
            const orderedAt = readOrderedAt(incoming);
            const event = typeof incoming.eventId === 'string' && isValidObjectId(incoming.eventId)
                ? eventsById.get(new Types.ObjectId(incoming.eventId).toString())
                : undefined;
            const closed = isOrderAfterEventEnd(orderedAt, event);
            if (closed) {
                /* Rifiutato e NON scritto. Non e' un errore di rete: il push
                   va avanti con gli altri ordini, e il locale lo segnala
                   all'operatore (che puo' valutare l'inserimento a mano). */
                rejected.push({
                    localId: incoming._id,
                    orderNumber: typeof incoming.orderNumber === 'number' ? incoming.orderNumber : null,
                    orderedAt: orderedAt ? orderedAt.toISOString() : null,
                    reason: 'event_closed'
                });
                continue;
            }

            const incomingUpdated = new Date((incoming.updatedAt as Date | undefined) ?? 0);
            const existing = await OrderModel.findById(remoteId).lean();
            if (!existing) {
                /* `createdAt` prende l'orologio del notebook quando arriva:
                   senza, un ordine preso alle 23:50 e sincronizzato alle 00:05
                   finirebbe nel giorno e nell'ora sbagliati in ogni report. */
                const doc = sanitizeDoc({ ...incoming, _id: remoteId });
                delete doc.orderedAt;
                await OrderModel.create(orderedAt ? { ...doc, createdAt: orderedAt } : doc);
            } else if (incomingUpdated >= new Date(existing.updatedAt ?? 0)) {
                const doc = sanitizeDoc({ ...incoming, _id: remoteId, createdAt: existing.createdAt });
                delete doc.orderedAt;
                await OrderModel.updateOne({ _id: remoteId }, { $set: doc });
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

    /* `rejected` e' sempre presente (anche vuoto): il locale non deve
       distinguere "nessun rifiuto" da "campo assente" per non marcare come
       sincronizzate righe che in realta sono state scartate. */
    return res.status(200).json({ results, rejected });
}

/**
 * Ordine rifiutato dal push, restituito al locale perché lo segnali.
 *
 * `localId` è l'_id generato dal notebook (= `_id` che avrebbe avuto nel
 * cloud), così il locale sa esattamente quale riga del ledger fermare.
 */
export type SyncRejectedOrder = {
    localId: string;
    orderNumber: number | null;
    /** ISO dell'ordine secondo l'orologio del notebook; `null` se assente. */
    orderedAt: string | null;
    /**
     * - `event_closed`: ordine registrato dopo la chiusura dell'evento.
     */
    reason: 'event_closed';
};

/**
 * Istante in cui l'ordine è stato preso in cassa, secondo il notebook.
 *
 * Va in un campo dedicato (`orderedAt`) e non in `createdAt` perché il
 * timestamp mongoose è comunque gestito dal cloud: `createdAt` viene
 * sovrascritto in ogni update, `orderedAt` no, ed è questo il valore che
 * "fa fede" per il rifiuto.
 */
function readOrderedAt(incoming: Record<string, unknown>): Date | null {
    const raw = incoming.orderedAt;
    if (raw === undefined || raw === null) return null;
    const date = new Date(raw as string | number | Date);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * L'ordine è stato preso dopo la chiusura dell'evento?
 *
 * Il confronto è con `Event.endDate` così com'è, non con la fine giornata
 * dell'evento: `endDate` è l'orologio di chiusura dichiarato, ed è quello con
 * cui l'operatore ragiona. Manca `orderedAt` o l'evento non è caricabile?
 * Allora non si può provare nulla e si accetta (il controllo non deve
 * bloccare la sincronizzazione per un dato mancante).
 */
function isOrderAfterEventEnd(
    orderedAt: Date | null,
    event: { endDate?: Date | null } | undefined
): boolean {
    if (!orderedAt || !event?.endDate) return false;
    return orderedAt.getTime() > new Date(event.endDate).getTime();
}

function sanitizeDoc(doc: Record<string, unknown>): Record<string, unknown> {
    const clone: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(doc)) {
        if (key === 'createdAt' || key === '__v') continue;
        clone[key] = value;
    }
    return clone;
}
