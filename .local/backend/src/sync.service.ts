import type { Types } from 'mongoose';
import mongoose from 'mongoose';
import { SyncLedgerModel, type SyncStatus } from './sync-ledger.model';
import {
    CounterModel,
    EventModel,
    EventProductModel,
    EventUserModel,
    EventUserTransactionModel,
    LocalStateModel,
    OrderModel,
    ProductModel,
    StandModel,
    StationModel,
    UserModel
} from './models';
import { config } from './config';
import { localizeEventImages, localizeStandImages, localizeProductImages } from './media.service';

// ─── Ledger ───────────────────────────────────────────────────────────────────

export async function registerSync(
    entityType: 'Order' | 'EventUserTransaction' | 'Counter',
    localId: Types.ObjectId,
    status: SyncStatus = 'pending'
) {
    await SyncLedgerModel.updateOne(
        { entityType, localId },
        {
            $setOnInsert: { entityType, localId, machineId: config.machineId, remoteVersion: 0, syncedAt: null },
            $set: { lastModifiedAt: new Date(), syncStatus: status }
        },
        { upsert: true }
    );
}

export async function markSynced(entityType: 'Order' | 'EventUserTransaction' | 'Counter', localId: Types.ObjectId) {
    await SyncLedgerModel.updateOne(
        { entityType, localId },
        { $set: { syncStatus: 'synced', syncedAt: new Date(), lastModifiedAt: new Date() } }
    );
}

export async function listPending(entityType: 'Order' | 'EventUserTransaction' | 'Counter') {
    return SyncLedgerModel.find({ entityType, syncStatus: 'pending' })
        .sort({ lastModifiedAt: 1 })
        .lean();
}

export async function countPending(): Promise<number> {
    return SyncLedgerModel.countDocuments({ syncStatus: 'pending' });
}

// ─── Meta (active event / stand) ──────────────────────────────────────────────

export interface Meta {
    eventId: string | null;
    standId: string | null;
    eventName: string | null;
    currencyName: string | null;
    importedAt: Date | null;
    hasPending: boolean;
    pendingCount: number;
}

export async function getMeta(): Promise<Meta> {
    const state = await LocalStateModel.findOne({ key: 'current' }).lean();
    const pendingCount = await countPending();
    return {
        eventId: state?.eventId?.toString() ?? null,
        standId: state?.standId?.toString() ?? null,
        eventName: state?.eventName ?? null,
        currencyName: state?.currencyName ?? null,
        importedAt: state?.importedAt ?? null,
        hasPending: pendingCount > 0,
        pendingCount
    };
}

export async function setMeta(eventId: string, standId: string, eventName: string, currencyName: string) {
    await LocalStateModel.findOneAndUpdate(
        { key: 'current' },
        {
            $set: {
                eventId: new mongoose.Types.ObjectId(eventId),
                standId: new mongoose.Types.ObjectId(standId),
                remoteEventId: new mongoose.Types.ObjectId(eventId),
                remoteStandId: new mongoose.Types.ObjectId(standId),
                eventName,
                currencyName,
                importedAt: new Date()
            }
        },
        { upsert: true }
    );
}

// ─── Remote fetch helpers ──────────────────────────────────────────────────────

async function remoteFetch<T>(path: string): Promise<T> {
    if (!config.remoteUrl) throw new Error('REMOTE_URL non configurato');
    const url = `${config.remoteUrl}${path}`;
    const res = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...(config.remoteToken ? { Authorization: `Bearer ${config.remoteToken}` } : {})
        }
    });
    if (!res.ok) {
        const body: any = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(`Remoto ${res.status}: ${body.message ?? res.statusText}`);
    }
    return res.json() as Promise<T>;
}

export async function fetchRemoteEvents() {
    return remoteFetch<{ items: Array<{ id: string; name: string; startDate: string; endDate: string; currencyName: string; exchangeRate: number }> }>('/sync/events');
}

export async function fetchRemoteStands(eventId: string) {
    return remoteFetch<{ event: { id: string; name: string }; items: Array<{ id: string; name: string; type: string; number: number | null }> }>(`/sync/events/${eventId}/stands`);
}

export async function fetchRemoteSnapshot(eventId: string, standId: string) {
    return remoteFetch<{
        event: any;
        stand: any;
        stations: any[];
        products: any[];
        eventProducts: any[];
        eventUsers: any[];
        counter: any;
    }>(`/sync/events/${eventId}/stands/${standId}`);
}

// ─── Import from remote ────────────────────────────────────────────────────────

export async function importFromRemote(eventId: string, standId: string, force: boolean = false) {
    const pendingCount = await countPending();
    if (pendingCount > 0 && !force) {
        return {
            status: 'pending' as const,
            pendingCount
        };
    }

    const snapshot = await fetchRemoteSnapshot(eventId, standId);

    // Localize remote images (download Cloudinary assets to local disk and
    // rewrite url/publicId to the local static endpoint) before the wipe.
    const event = snapshot.event ? await localizeEventImages(snapshot.event) : snapshot.event;
    const stand = snapshot.stand ? await localizeStandImages(snapshot.stand) : snapshot.stand;
    const products = await Promise.all(
        (snapshot.products ?? []).map((p: any) => (p ? localizeProductImages(p) : p))
    );

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // wipe all local business data
        await OrderModel.deleteMany({}, { session });
        await EventUserTransactionModel.deleteMany({}, { session });
        await CounterModel.deleteMany({}, { session });
        await SyncLedgerModel.deleteMany({}, { session });
        await EventUserModel.deleteMany({}, { session });
        await EventProductModel.deleteMany({}, { session });
        await ProductModel.deleteMany({}, { session });
        await StationModel.deleteMany({}, { session });
        await StandModel.deleteMany({}, { session });
        await EventModel.deleteMany({}, { session });
        await UserModel.deleteMany({}, { session });

        // insert snapshot (preserve remote _ids)
        await EventModel.create([event], { session });
        await StandModel.create([stand], { session });

        if (snapshot.stations.length > 0) {
            await StationModel.insertMany(snapshot.stations.map((s: any) => ({ ...s, _id: new mongoose.Types.ObjectId(s._id) })), { session });
        }
        if (products.length > 0) {
            await ProductModel.insertMany(products.map((p: any) => ({ ...p, _id: new mongoose.Types.ObjectId(p._id) })), { session });
        }
        if (snapshot.eventProducts.length > 0) {
            await EventProductModel.insertMany(
                snapshot.eventProducts.map((ep: any) => ({ ...ep, _id: new mongoose.Types.ObjectId(ep._id) })),
                { session }
            );
        }
        if (snapshot.eventUsers.length > 0) {
            await EventUserModel.insertMany(
                snapshot.eventUsers.map((eu: any) => ({ ...eu, _id: new mongoose.Types.ObjectId(eu._id) })),
                { session }
            );
        }
        if (snapshot.counter) {
            await CounterModel.create([{ ...snapshot.counter, _id: new mongoose.Types.ObjectId(snapshot.counter._id ?? new mongoose.Types.ObjectId()) }], { session });
        }

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }

    await setMeta(eventId, standId, event.name, event.currencyName);

    return {
        status: 'ok' as const,
        eventName: event.name,
        standName: stand.name,
        productsCount: products.length,
        stationsCount: snapshot.stations.length
    };
}

// ─── Push to remote ────────────────────────────────────────────────────────────

export async function pushToRemote(): Promise<{ pushed: number; errors: string[] }> {
    const pendingOrders = await SyncLedgerModel.find({ entityType: 'Order', syncStatus: 'pending' }).lean();
    const pendingTxns = await SyncLedgerModel.find({ entityType: 'EventUserTransaction', syncStatus: 'pending' }).lean();
    const pendingCounters = await SyncLedgerModel.find({ entityType: 'Counter', syncStatus: 'pending' }).lean();

    if (pendingOrders.length === 0 && pendingTxns.length === 0 && pendingCounters.length === 0) {
        return { pushed: 0, errors: [] };
    }

    const orderIds = pendingOrders.map((p) => p.localId);
    const txnIds = pendingTxns.map((p) => p.localId);

    const [orders, transactions, counters] = await Promise.all([
        orderIds.length > 0 ? OrderModel.find({ _id: { $in: orderIds } }).lean() : Promise.resolve([]),
        txnIds.length > 0 ? EventUserTransactionModel.find({ _id: { $in: txnIds } }).lean() : Promise.resolve([]),
        pendingCounters.length > 0
            ? Promise.all(
                  pendingCounters.map(async (pc) => {
                      const c = await CounterModel.findOne({ standId: pc.localId }).lean();
                      return c ?? { standId: pc.localId, seq: 0 };
                  })
              )
            : Promise.resolve([])
    ]);

    // build event user balances from transactions (collect affected eventUserIds)
    const affectedEventUserIds = new Set<string>();
    for (const txn of transactions) {
        if (txn.eventUserId) affectedEventUserIds.add(txn.eventUserId.toString());
    }
    const eventUserBalances =
        affectedEventUserIds.size > 0
            ? await EventUserModel.find({ _id: { $in: [...affectedEventUserIds] } })
                  .select('_id balance updatedAt')
                  .lean()
            : [];

    const body = {
        orders: orders.map(cleanForPush),
        transactions: transactions.map(cleanForPush),
        counters: counters.map(cleanForPush),
        eventUserBalances: eventUserBalances.map(cleanForPush)
    };

    const errors: string[] = [];
    let pushed = 0;

    try {
        if (!config.remoteUrl) throw new Error('REMOTE_URL non configurato');
        const url = `${config.remoteUrl}/sync/push`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.remoteToken ? { Authorization: `Bearer ${config.remoteToken}` } : {})
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const errBody: any = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(errBody.message ?? res.statusText);
        }

        // mark all as synced
        const allLedgerIds = [...pendingOrders, ...pendingTxns, ...pendingCounters].map((l) => l._id);
        if (allLedgerIds.length > 0) {
            await SyncLedgerModel.updateMany({ _id: { $in: allLedgerIds } }, { $set: { syncStatus: 'synced', syncedAt: new Date() } });
        }
        pushed = allLedgerIds.length;
    } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
    }

    return { pushed, errors };
}

function cleanForPush(doc: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(doc)) {
        if (key === '__v' || key === 'createdAt') continue;
        if (looksLikeImageDoc(value)) continue;
        if (value instanceof Date) out[key] = value.toISOString();
        else if (value && typeof value === 'object' && '_bsontype' in (value as any)) {
            out[key] = (value as any).toString();
        } else {
            out[key] = value;
        }
    }
    return out;
}

/** An image subdoc has the local `/assets/...` url — it must never reach the cloud. */
function looksLikeImageDoc(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return typeof v.url === 'string' && v.url.startsWith('/assets/');
}
