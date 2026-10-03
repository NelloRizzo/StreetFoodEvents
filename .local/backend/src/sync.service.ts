import type { Types } from 'mongoose';
import mongoose from 'mongoose';
import { SyncLedgerModel, type SyncStatus } from './sync-ledger.model';
import {
    CounterModel,
    EventModel,
    EventProductModel,
    LocalStateModel,
    OrderModel,
    ProductModel,
    StandModel,
    StationModel
} from './models';
import { config } from './config';
import { localizeEventImages, localizeStandImages, localizeProductImages } from './media.service';

// ─── Ledger ───────────────────────────────────────────────────────────────────

export async function registerSync(
    entityType: 'Order' | 'Counter',
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

export async function markSynced(entityType: 'Order' | 'Counter', localId: Types.ObjectId) {
    await SyncLedgerModel.updateOne(
        { entityType, localId },
        { $set: { syncStatus: 'synced', syncedAt: new Date(), lastModifiedAt: new Date() } }
    );
}

export async function listPending(entityType: 'Order' | 'Counter') {
    return SyncLedgerModel.find({ entityType, syncStatus: 'pending' })
        .sort({ lastModifiedAt: 1 })
        .lean();
}

export async function countPending(): Promise<number> {
    return SyncLedgerModel.countDocuments({ syncStatus: 'pending' });
}

/** Ordini che il remoto ha rifiutato, con i dati minimi per leggerli in pagina. */
export type RejectedOrderRow = {
    localId: string;
    orderNumber: number | null;
    /** Data/ora dell'ordine secondo l'orologio di questo notebook. */
    orderedAt: string | null;
    total: number | null;
    status: string;
    reason: string;
    rejectedAt: string | null;
};

/**
 * Elenco dei rifiuti, arricchito con i dati dell'ordine locale.
 *
 * Il ledger sa solo che la riga è stata rifiutata e perché: per mostrare
 * "ordine #12 del 5 ottobre" il numero e la data vengono letti dall'ordine
 * locale. `orderedAt` usa `createdAt` locale perché è l'unico orologio
 * dell'ordine (vedi `cleanForPush`).
 */
export async function listRejectedOrders(): Promise<RejectedOrderRow[]> {
    const rows = await SyncLedgerModel.find({ entityType: 'Order', syncStatus: 'rejected' })
        .sort({ rejectedAt: 1 })
        .lean();

    if (rows.length === 0) return [];

    const orders = await OrderModel.find({ _id: { $in: rows.map((r) => r.localId) } })
        .select('orderNumber createdAt total status')
        .lean();
    const byId = new Map(orders.map((o) => [o._id.toString(), o]));

    return rows.map((row) => {
        const order = byId.get(row.localId.toString());
        return {
            localId: row.localId.toString(),
            orderNumber: order?.orderNumber ?? null,
            orderedAt: order?.createdAt ? new Date(order.createdAt).toISOString() : null,
            total: typeof order?.total === 'number' ? order.total : null,
            status: order?.status ?? '',
            reason: row.rejectReason ?? 'unknown',
            rejectedAt: row.rejectedAt ? new Date(row.rejectedAt).toISOString() : null
        };
    });
}

/**
 * Dimentica i rifiuti.
 *
 * Serve dopo che l'operatore ha gestito il caso a mano (inserimento
 * manuale nel DB dell'app): senza, la pagina mostrerebbe per sempre ordini
 * "rifiutati" che l'operatore ha già sistemato. Le righe restano in ledger
 * come `synced` con il motivo, così non tornano indietro a `pending`.
 */
export async function clearRejectedOrders(): Promise<number> {
    const res = await SyncLedgerModel.updateMany(
        { entityType: 'Order', syncStatus: 'rejected' },
        { $set: { syncStatus: 'synced', syncedAt: new Date() } }
    );
    return res.modifiedCount ?? 0;
}

// ─── Meta (active event / stand) ──────────────────────────────────────────────

export interface EventThemeColors {
    brand: string | null;
    text: string | null;
    surface: string | null;
    highlight: string | null;
}

export interface Meta {
    eventId: string | null;
    standId: string | null;
    eventName: string | null;
    currencyName: string | null;
    importedAt: Date | null;
    hasSyncPassword: boolean;
    hasPending: boolean;
    pendingCount: number;
    theme: EventThemeColors | null;
}

export async function getMeta(): Promise<Meta> {
    const state = await LocalStateModel.findOne({ key: 'current' }).lean();
    const pendingCount = await countPending();

    let theme: EventThemeColors | null = null;
    if (state?.eventId) {
        const event = await EventModel.findById(state.eventId).select('themeBrand themeText themeSurface themeHighlight').lean();
        if (event) {
            theme = {
                brand: event.themeBrand ?? null,
                text: event.themeText ?? null,
                surface: event.themeSurface ?? null,
                highlight: event.themeHighlight ?? null
            };
        }
    }

    return {
        eventId: state?.eventId?.toString() ?? null,
        standId: state?.standId?.toString() ?? null,
        eventName: state?.eventName ?? null,
        currencyName: state?.currencyName ?? null,
        importedAt: state?.importedAt ?? null,
        hasSyncPassword: Boolean(state?.syncPassword),
        hasPending: pendingCount > 0,
        pendingCount,
        theme
    };
}

export async function setSyncPassword(password: string | null) {
    await LocalStateModel.findOneAndUpdate(
        { key: 'current' },
        { $set: { syncPassword: password?.trim() ? password.trim() : null } },
        { upsert: true }
    );
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

async function remoteFetch<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
    if (!config.remoteUrl) throw new Error('REMOTE_URL non configurato');
    const url = `${config.remoteUrl}${path}`;
    const res = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...(config.remoteToken ? { Authorization: `Bearer ${config.remoteToken}` } : {}),
            ...headers
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
    return remoteFetch<{
        event: { id: string; name: string };
        items: Array<{ id: string; name: string; type: string; number: number | null; syncEnabled: boolean }>;
    }>(`/sync/events/${eventId}/stands`);
}

export async function fetchRemoteSnapshot(eventId: string, standId: string, syncPassword?: string | null) {
    return remoteFetch<{
        event: any;
        stand: any;
        stations: any[];
        products: any[];
        eventProducts: any[];
        eventUsers: any[];
        counter: any;
    }>(`/sync/events/${eventId}/stands/${standId}`, syncPassword ? { 'X-Sync-Password': syncPassword } : {});
}

// ─── Import from remote ────────────────────────────────────────────────────────

export async function importFromRemote(eventId: string, standId: string, force: boolean = false, syncPassword?: string | null) {
    const pendingCount = await countPending();
    if (pendingCount > 0 && !force) {
        return {
            status: 'pending' as const,
            pendingCount
        };
    }

    const state = await LocalStateModel.findOne({ key: 'current' }).lean();
    const password = syncPassword ?? state?.syncPassword ?? null;
    if (!password) {
        return {
            status: 'password-required' as const
        };
    }

    const snapshot = await fetchRemoteSnapshot(eventId, standId, password);

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
        await CounterModel.deleteMany({}, { session });
        await SyncLedgerModel.deleteMany({}, { session });
        await EventProductModel.deleteMany({}, { session });
        await ProductModel.deleteMany({}, { session });
        await StationModel.deleteMany({}, { session });
        await StandModel.deleteMany({}, { session });
        await EventModel.deleteMany({}, { session });

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
    await setSyncPassword(password);

    return {
        status: 'ok' as const,
        eventName: event.name,
        standName: stand.name,
        productsCount: products.length,
        stationsCount: snapshot.stations.length
    };
}

// ─── Push to remote ────────────────────────────────────────────────────────────

/**
 * Esito del push verso il remoto.
 *
 * `rejected` è distinto da `errors`: un errore è un problema di trasporto (la
 * coda resta `pending` e si ritenta), un rifiuto è una **decisione del
 * remoto** su quei dati (l'ordine è stato preso dopo la chiusura
 * dell'evento) e non si ritenta da solo.
 */
export type RejectedSyncRow = {
    localId: string;
    reason: string;
    orderNumber?: number | null;
    orderedAt?: string | null;
};

export type PushResult = {
    pushed: number;
    errors: string[];
    rejected?: RejectedSyncRow[];
};

export async function pushToRemote(): Promise<PushResult> {
    const state = await LocalStateModel.findOne({ key: 'current' }).lean();
    const syncPassword = state?.syncPassword ?? null;
    const remoteStandId = state?.remoteStandId ?? null;

    if (!remoteStandId) {
        return { pushed: 0, errors: ['Nessuno stand importato dal remoto'] };
    }

    if (!syncPassword) {
        return { pushed: 0, errors: ['Password di sincronizzazione non configurata'] };
    }

    const pendingOrders = await SyncLedgerModel.find({ entityType: 'Order', syncStatus: 'pending' }).lean();
    const pendingCounters = await SyncLedgerModel.find({ entityType: 'Counter', syncStatus: 'pending' }).lean();

    if (pendingOrders.length === 0 && pendingCounters.length === 0) {
        return { pushed: 0, errors: [] };
    }

    const orderIds = pendingOrders.map((p) => p.localId);

    const [orders, counters] = await Promise.all([
        orderIds.length > 0 ? OrderModel.find({ _id: { $in: orderIds } }).lean() : Promise.resolve([]),
        pendingCounters.length > 0
            ? Promise.all(
                  pendingCounters.map(async (pc) => {
                      const c = await CounterModel.findOne({ standId: pc.localId }).lean();
                      return c ?? { standId: pc.localId, seq: 0 };
                  })
              )
            : Promise.resolve([])
    ]);

    const body = {
        orders: orders.map(cleanForPush),
        counters: counters.map(cleanForPush),
        standId: remoteStandId.toString()
    };

    const errors: string[] = [];
    let pushed = 0;
    let rejected: RejectedSyncRow[] = [];

    try {
        if (!config.remoteUrl) throw new Error('REMOTE_URL non configurato');
        const url = `${config.remoteUrl}/sync/push`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.remoteToken ? { Authorization: `Bearer ${config.remoteToken}` } : {}),
                ...(syncPassword ? { 'X-Sync-Password': syncPassword } : {})
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const errBody: any = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(errBody.message ?? res.statusText);
        }

        const payload: any = await res.json().catch(() => ({}));

        /* Ordini che il remoto ha **rifiutato** (registrati dopo la chiusura
           dell'evento): non sono errori di rete e non verranno riprovati. Le
           righe di ledger passano a `rejected` con il motivo, così restano
           visibili nella pagina Sync e l'operatore può valutare l'inserimento
           a mano. */
        const rejectedRemote: Array<{ localId: string; reason: string }> = Array.isArray(payload?.rejected)
            ? payload.rejected
                  .filter((r: any) => r?.localId)
                  .map((r: any) => ({ localId: String(r.localId), reason: String(r.reason ?? 'unknown') }))
            : [];
        rejected = rejectedRemote;

        const rejectedLocalIds = new Set(rejectedRemote.map((r) => r.localId));
        const syncedOrders = pendingOrders.filter((o) => !rejectedLocalIds.has(o.localId.toString()));
        const syncedCounters = pendingCounters;

        const acceptedLedgerIds = [...syncedOrders, ...syncedCounters].map((l) => l._id);
        if (acceptedLedgerIds.length > 0) {
            await SyncLedgerModel.updateMany(
                { _id: { $in: acceptedLedgerIds } },
                { $set: { syncStatus: 'synced', syncedAt: new Date(), rejectReason: null, rejectedAt: null } }
            );
        }

        /* I rifiutati si fermano qui: se restassero `pending` verrebbero
           rinviati al prossimo push e il badge "modifiche non sincronizzate"
           non scenderebbe mai. Il motivo è per riga (un `updateMany` metterebbe
           quello del primo a tutti). */
        for (const row of rejectedRemote) {
            if (!mongoose.Types.ObjectId.isValid(row.localId)) continue;
            await SyncLedgerModel.updateOne(
                { entityType: 'Order', localId: new mongoose.Types.ObjectId(row.localId) },
                { $set: { syncStatus: 'rejected', rejectReason: row.reason, rejectedAt: new Date(), syncedAt: null } }
            );
        }

        pushed = acceptedLedgerIds.length;
    } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
    }

    return { pushed, errors, rejected };
}

/**
 * Prepara un documento per il push.
 *
 * `createdAt` viene scartato di proposito: è un timestamp mongoose e il
 * remoto usa il suo. **Ma l'istante in cui l'ordine è stato preso in cassa
 * non può perdersi**, altrimenti sul cloud l'ordine nasce con la data del push
 * (un ordine delle 23:50 sincronizzato alle 00:05 finisce nel giorno
 * sbagliato) e soprattutto il remoto non può più rifiutare un ordine preso
 * dopo la chiusura dell'evento. Per questo lo viaggio in `orderedAt`, un campo
 * dedicato che nessuno dei due lati sovrascrive.
 */
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
    if (doc.createdAt instanceof Date && !Number.isNaN(doc.createdAt.getTime())) {
        out.orderedAt = doc.createdAt.toISOString();
    }
    return out;
}

/** An image subdoc has the local `/assets/...` url — it must never reach the cloud. */
function looksLikeImageDoc(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return typeof v.url === 'string' && v.url.startsWith('/assets/');
}
