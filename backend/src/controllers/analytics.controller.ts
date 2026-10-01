import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { EventModel } from '../models/event.model';
import { OrderModel } from '../models/order.model';
import { StandModel } from '../models/stand.model';
import { resolveDateWindow } from '../utils/date-window';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}

/**
 * Bucket per la distribuzione dei tempi di preparazione, in secondi.
 * Confini fissi (non relativi al min/max): devono essere gli stessi per tutti gli
 * eventi, altrimenti due report non sarebbero confrontabili.
 */
const PREP_BUCKETS: { label: string; upperBound: number }[] = [
    { label: 'fino a 2 min', upperBound: 120 },
    { label: '2-5 min', upperBound: 300 },
    { label: '5-10 min', upperBound: 600 },
    { label: '10-15 min', upperBound: 900 },
    { label: '15-20 min', upperBound: 1200 },
    { label: '20-30 min', upperBound: 1800 },
    { label: 'oltre 30 min', upperBound: Infinity }
];

const PREP_BUCKET_LABELS = PREP_BUCKETS.map((b) => b.label);
const PREP_OVERFLOW_LABEL = PREP_BUCKET_LABELS[PREP_BUCKET_LABELS.length - 1];

/* `$bucket` ha due caratteristiche da rispettare:
 *  1. `_id` e' il LIMITE INFERIORE del bucket (l'ultimo boundary non genera un
 *     bucket e finisce nel `default`);
 *  2. il primo boundary deve essere minore del minimo del gruppo.
 * Si parte quindi da 0 (la durata e' sempre >= 0) e si mappa ogni limite
 * inferiore alla sua etichetta. */
const PREP_FINITE_BUCKETS = PREP_BUCKETS.filter((b) => Number.isFinite(b.upperBound));
const PREP_BOUNDARIES = [0, ...PREP_FINITE_BUCKETS.map((b) => b.upperBound)];
const PREP_LABEL_BY_LOWER_BOUND = new Map<number, string>();
PREP_FINITE_BUCKETS.forEach((bucket, i) => {
    const lowerBound = PREP_BOUNDARIES[i];
    if (lowerBound !== undefined) {
        PREP_LABEL_BY_LOWER_BOUND.set(lowerBound, bucket.label);
    }
});

/**
 * La posizione dello stand e' un GeoJSON Point: `coordinates` e' [lng, lat].
 * Leaflet vuole {lat, lng}, quindi si riordina qui una volta sola.
 */
function readLatLng(coords: number[] | null | undefined): { lat: number; lng: number } | null {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const [lng, lat] = coords;
    if (typeof lng !== 'number' || typeof lat !== 'number') return null;
    return { lat, lng };
}

/**
 * GET /api/events/:eventId/analytics
 * Guard: event-admin / event-cashier / platform-admin (stessi di /visitors).
 *
 * Query opzionali: from, to (ISO), standId.
 *
 * CONTEGGIO: gli ordini in omaggio (`isGift`) sono esclusi da tutte le metriche
 * di vendita perché non generano fatturato, ma il loro numero è esposto in
 * `totals.giftOrders`. Gli ordini cancellati sono esclusi ovunque.
 *
 * FUSI ORARI: i bucket orari sono allineati sull'ora UTC e restituiscono
 * `bucketStart` come ISO. Il frontend li etichetta con l'ora locale del
 * browser (l'operatore è sul fuso dell'evento): raggruppare per `$hour`
 * direttamente in Mongo avrebbe spostato la distribuzione di due ore su un
 * evento italiano. Allineare il bucket in UTC e convertirlo solo per l'etichetta
 * evita anche doppioni alle transizioni DST.
 */
export async function getEventAnalytics(req: Request, res: Response) {
    const eventId = req.params.eventId;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await EventModel.findById(eventId)
        .select('name currencyName currencySymbol exchangeRate startDate endDate');
    if (!event) {
        return res.status(404).json({ message: 'Event not found' });
    }

    const eventIdObj = new Types.ObjectId(eventId);

    const { from, to } = resolveDateWindow(event, req.query.from as string | undefined, req.query.to as string | undefined);

    const baseMatch: Record<string, unknown> = {
        eventId: eventIdObj,
        createdAt: { $gte: from, $lte: to }
    };

    const standIdQuery = req.query.standId as string | undefined;
    const standFilter: Record<string, unknown> = standIdQuery && isValidObjectId(standIdQuery)
        ? { standId: new Types.ObjectId(standIdQuery) }
        : {};

    /* Metriche di vendita: niente omaggi, niente cancellati. */
    const salesMatch: Record<string, unknown> = {
        ...baseMatch,
        ...standFilter,
        status: { $ne: 'cancelled' },
        isGift: { $ne: true }
    };

    /* Solo gli ordini che sono arrivati davvero a "ready": il tempo di
       preparazione si misura solo su quelli. */
    const prepMatch: Record<string, unknown> = {
        ...salesMatch,
        status: { $in: ['ready', 'completed'] },
        readyAt: { $ne: null }
    };

    const secondsSinceCreation = { $divide: [{ $subtract: ['$readyAt', '$createdAt'] }, 1000] };

    const [hourlyRows, topProductRows, byStandRows, prepBucketRows, customerRows, giftRows] = await Promise.all([
        /* Distribuzione per ora: i bucket sono allineati sull'ora UTC. */
        OrderModel.aggregate([
            { $match: salesMatch },
            {
                $group: {
                    _id: {
                        y: { $year: '$createdAt' },
                        m: { $month: '$createdAt' },
                        d: { $dayOfMonth: '$createdAt' },
                        h: { $hour: '$createdAt' }
                    },
                    orders: { $sum: 1 },
                    quantity: { $sum: { $sum: '$items.quantity' } },
                    revenue: { $sum: '$total' }
                }
            },
            { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1, '_id.h': 1 } }
        ]),
        OrderModel.aggregate([
            { $match: salesMatch },
            { $unwind: '$items' },
            {
                $group: {
                    _id: { epId: '$items.eventProductId', standId: '$standId' },
                    productName: { $first: '$items.productName' },
                    quantity: { $sum: '$items.quantity' },
                    revenue: { $sum: '$items.subtotal' }
                }
            },
            { $sort: { quantity: -1, revenue: -1 } },
            { $limit: 20 }
        ]),
        /* Per stand: vendite + somma dei tempi di preparazione. La media per
           stand si calcola qui come readySeconds / readySamples, così un solo
           pipeline alimenta sia i totali sia il dettaglio. */
        OrderModel.aggregate([
            { $match: salesMatch },
            {
                $group: {
                    _id: '$standId',
                    orders: { $sum: 1 },
                    quantity: { $sum: { $sum: '$items.quantity' } },
                    revenue: { $sum: '$total' },
                    creditRevenue: { $sum: '$creditAmountUsed' },
                    posRevenue: {
                        $sum: { $cond: ['$isPos', { $subtract: ['$total', '$creditAmountUsed'] }, 0] }
                    },
                    readySamples: { $sum: { $cond: [{ $ne: ['$readyAt', null] }, 1, 0] } },
                    readySeconds: {
                        $sum: {
                            $cond: [
                                { $ne: ['$readyAt', null] },
                                { $divide: [{ $subtract: ['$readyAt', '$createdAt'] }, 1000] },
                                0
                            ]
                        }
                    }
                }
            }
        ]),
        OrderModel.aggregate([
            { $match: prepMatch },
            { $project: { seconds: secondsSinceCreation } },
            {
                $bucket: {
                    groupBy: '$seconds',
                    boundaries: PREP_BOUNDARIES,
                    default: PREP_OVERFLOW_LABEL,
                    output: { count: { $sum: 1 } }
                }
            }
        ]),
        OrderModel.aggregate([
            { $match: salesMatch },
            { $group: { _id: null, customers: { $addToSet: '$customerId' } } }
        ]),
        OrderModel.aggregate([
            { $match: { ...baseMatch, ...standFilter, status: { $ne: 'cancelled' }, isGift: true } },
            { $count: 'count' }
        ])
    ]);

    const hourly = hourlyRows.map((row) => ({
        bucketStart: new Date(Date.UTC(row._id.y, row._id.m - 1, row._id.d, row._id.h)).toISOString(),
        orders: row.orders,
        quantity: row.quantity,
        revenue: round1(row.revenue)
    }));

    /* Bucket di preparazione: si restituiscono tutti, anche vuoti, cosi il
       grafico mantiene la scala e i confronti fra eventi restano leggibili. */
    const bucketCounts = new Map<string, number>(PREP_BUCKET_LABELS.map((label) => [label, 0]));
    for (const row of prepBucketRows) {
        const label = typeof row._id === 'number'
            ? PREP_LABEL_BY_LOWER_BOUND.get(row._id)
            : PREP_OVERFLOW_LABEL;
        if (!label) continue;
        bucketCounts.set(label, row.count);
    }
    const prepBuckets = PREP_BUCKET_LABELS.map((label) => ({ label, count: bucketCounts.get(label) ?? 0 }));

    const stands = await StandModel.find({ eventIds: eventIdObj }).select('name numbers locations').lean();
    const standInfo = new Map<string, { name: string; number: number | null; location: { lat: number; lng: number } | null }>();
    for (const stand of stands) {
        const numberEntry = (stand.numbers ?? []).find((n) => n.eventId.toString() === eventId);
        const locationEntry = (stand.locations ?? []).find((l) => l.eventId.toString() === eventId);
        standInfo.set(stand._id.toString(), {
            name: stand.name,
            number: numberEntry?.number ?? null,
            location: readLatLng(locationEntry?.location?.coordinates)
        });
    }

    const standNameById = new Map<string, string>();
    for (const [id, info] of standInfo) {
        standNameById.set(id, info.name);
    }

    const byStand = byStandRows.map((row) => {
        const standId = row._id.toString();
        const info = standInfo.get(standId) ?? { name: 'Stand sconosciuto', number: null, location: null };
        return {
            standId,
            standName: info.name,
            number: info.number,
            location: info.location,
            orders: row.orders,
            quantity: row.quantity,
            revenue: round1(row.revenue),
            creditRevenue: round1(row.creditRevenue),
            posRevenue: round1(row.posRevenue),
            cashRevenue: round1(row.revenue - row.creditRevenue - row.posRevenue),
            prepOrders: row.readySamples,
            avgPrepSeconds: row.readySamples > 0 ? Math.round(row.readySeconds / row.readySamples) : null
        };
    }).sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.standName.localeCompare(b.standName));

    const topProducts = topProductRows.map((row) => {
        const standId = row._id.standId.toString();
        const info = standInfo.get(standId);
        return {
            eventProductId: row._id.epId.toString(),
            productName: row.productName,
            standId,
            standName: standNameById.get(standId) ?? 'Stand sconosciuto',
            number: info?.number ?? null,
            quantity: row.quantity,
            revenue: round1(row.revenue)
        };
    });

    const orders = byStandRows.reduce((sum, row) => sum + row.orders, 0);
    const quantity = byStandRows.reduce((sum, row) => sum + row.quantity, 0);
    const revenue = byStandRows.reduce((sum, row) => sum + row.revenue, 0);
    const creditRevenue = byStandRows.reduce((sum, row) => sum + row.creditRevenue, 0);
    const posRevenue = byStandRows.reduce((sum, row) => sum + row.posRevenue, 0);
    const prepOrders = byStandRows.reduce((sum, row) => sum + row.readySamples, 0);
    const prepSeconds = byStandRows.reduce((sum, row) => sum + row.readySeconds, 0);

    return res.status(200).json({
        eventId,
        eventName: event.name,
        currencyName: event.currencyName,
        currencySymbol: event.currencySymbol ?? null,
        exchangeRate: event.exchangeRate ?? 1,
        window: { from: from.toISOString(), to: to.toISOString() },
        totals: {
            orders,
            quantity,
            revenue: round1(revenue),
            creditRevenue: round1(creditRevenue),
            posRevenue: round1(posRevenue),
            cashRevenue: round1(revenue - creditRevenue - posRevenue),
            avgOrderValue: orders > 0 ? round1(revenue / orders) : 0,
            distinctCustomers: (customerRows[0]?.customers ?? []).filter((c: unknown) => c !== null).length,
            giftOrders: giftRows[0]?.count ?? 0,
            prepOrders,
            avgPrepSeconds: prepOrders > 0 ? Math.round(prepSeconds / prepOrders) : null
        },
        hourly,
        topProducts,
        prepBuckets,
        byStand
    });
}