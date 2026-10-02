import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { EventModel } from '../models/event.model';
import { OrderModel } from '../models/order.model';
import { StandModel } from '../models/stand.model';
import {
    emptySettlementBuckets,
    getEarnedCreditsByStand,
    getSettlementBucketsByStand,
    getSettlementPresenceByStand
} from '../services/stand-settlements-analytics.service';
import { getTokenLedger, getTokenSpentByProduct } from '../services/token-ledger.service';
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
 *
 * Le label usano la notazione breve dei tempi (apostrofo = minuti, doppio
 * apostrofo = secondi, `5'-10'`) coerente con `formatSeconds` lato frontend:
 * le colonne dei tempi sono strette e `5-10 min` andrebbe a capo.
 */
const PREP_BUCKETS: { label: string; upperBound: number }[] = [
    { label: "0'-2'", upperBound: 120 },
    { label: "2'-5'", upperBound: 300 },
    { label: "5'-10'", upperBound: 600 },
    { label: "10'-15'", upperBound: 900 },
    { label: "15'-20'", upperBound: 1200 },
    { label: "20'-30'", upperBound: 1800 },
    { label: "oltre 30'", upperBound: Infinity }
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
 * Token **emessi finora dal banco cambio**, e confronto con la
 * configurazione dell'evento.
 *
 * "Emessi" non e' il totale dei tagli stampati: sono i token che il banco ha
 * davvero messo in gioco, cioe' **totale ricevuto dai visitatori + contenuto
 * attuale delle casse**. La formula e' quella del cassiere: tutto cio' che e'
 * passato dalla cassa cambio, piu' quello che le casse hanno ancora in
 * cassetto. (Combinata con `inCash = fondo - caricamenti + rimborsi +
 * movimenti`, equivale al fondo iniziale piu' tutto cio' che e' rientrato:
 * i token messi in circolazione non la cambiano, e infatti non devono.)
 *
 * Il confronto e' con `Event.denominations`, cioe' la quantita' di moneta
 * fisica configurata per l'evento (`value` e' il valore del taglio **in
 * crediti**: `count * value / exchangeRate` e' l'euro corrispondente). Serve a
 * sapere quanti token stampati non sono ancora passati dalla cassa.
 *
 * Tutte e tre le grandezze sono **event-wide**: i tagli sono configurazione e
 * `receivedTotal` e `inCash` sono cumulati storici, quindi qui NON si usa il
 * `period` filtrato (mescolare le due cose darebbe uno scarto falso appena si
 * cambia il periodo). Senza tagli configurati `configuredCredits` resta
 * `null`: non e' la stessa cosa di zero token emessi, e la UI non mostra nulla.
 */
function buildIssuedTokens(
    event: { denominations?: unknown },
    ledger: { snapshot: { receivedTotal: number; inCash: number } }
) {
    const denominations = Array.isArray(event.denominations)
        ? event.denominations as Array<{ value?: unknown; quantity?: unknown }>
        : [];

    const round2 = (value: number): number => Math.round(value * 100) / 100;

    const receivedCredits = round2(ledger.snapshot.receivedTotal);
    const inCashCredits = round2(ledger.snapshot.inCash);
    const totalCredits = round2(receivedCredits + inCashCredits);

    const configuredCredits = denominations.length > 0
        ? round2(denominations.reduce((sum, d) => {
            const value = Number(d.value);
            const quantity = Number(d.quantity);
            if (!Number.isFinite(value) || !Number.isFinite(quantity)) return sum;
            return sum + value * quantity;
        }, 0))
        : null;

    return {
        /** Emessi finora: `receivedCredits + inCashCredits`. */
        totalCredits,
        /** Totale ricevuto dai visitatori, tutto il tempo. */
        receivedCredits,
        /** Contenuto attuale di tutte le casse. */
        inCashCredits,
        /** Totale dei tagli configurati in crediti, `null` se non configurati. */
        configuredCredits,
        /** Quanti tagli sono configurati: 0 se l'evento non usa moneta fisica. */
        denominationCount: denominations.length,
        /** `totalCredits - configuredCredits`: positivo = emessi piu' dei tagli configurati. */
        difference: configuredCredits === null ? null : round2(totalCredits - configuredCredits)
    };
}

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
        /* `denominations` serve per il confronto "token emessi" della card token. */
        .select('name currencyName currencySymbol exchangeRate startDate endDate denominations');
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

    /* Liquidazioni e crediti guadagnati: finestra e per_tutto_Evento con
       regole diverse, gestite nel modulo condiviso con i visitatori. */
    const standFilterId = standIdQuery && isValidObjectId(standIdQuery) ? new Types.ObjectId(standIdQuery) : undefined;
    const [settlementByStand, earnedByStand, settlementPresence] = await Promise.all([
        getSettlementBucketsByStand({ eventId: eventIdObj, from, to, standId: standFilterId }),
        getEarnedCreditsByStand({ eventId: eventIdObj, standId: standFilterId }),
        /* Esistenza "mai liquidato": su tutto l'evento, non nella finestra. */
        getSettlementPresenceByStand({ eventId: eventIdObj, standId: standFilterId })
    ]);

    /* Resoconto token: flussi del periodo, istantanea dei portafogli e dei
     * cassoni, e ripartizione dei token spesi per prodotto. */
    const [tokenLedger, tokenByProduct] = await Promise.all([
        getTokenLedger({ eventId: eventIdObj, from, to }),
        getTokenSpentByProduct({ eventId: eventIdObj, from, to, standId: standFilterId })
    ]);

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

    /* 'credit' = AVERE, lo stand viene pagato in euro; 'debit' = DARE, crediti
     * caricati sullo stand senza pagamento. */
    const standIdsInReport = new Set<string>([
        ...byStandRows.map((r) => r._id.toString()),
        ...settlementByStand.keys()
    ]);

    const salesByStand = new Map<string, (typeof byStandRows)[number]>(byStandRows.map((r) => [r._id.toString(), r]));

    const byStand = [...standIdsInReport].map((standId) => {
        const info = standInfo.get(standId) ?? { name: 'Stand sconosciuto', number: null, location: null };
        const row = salesByStand.get(standId);
        const buckets = settlementByStand.get(standId) ?? emptySettlementBuckets();
        const earnedCredits = earnedByStand.get(standId) ?? 0;
        const presence = settlementPresence.get(standId);
        const revenue = row?.revenue ?? 0;
        const creditRevenue = row?.creditRevenue ?? 0;
        const posRevenue = row?.posRevenue ?? 0;
        const readySamples = row?.readySamples ?? 0;
        return {
            standId,
            standName: info.name,
            number: info.number,
            location: info.location,
            orders: row?.orders ?? 0,
            quantity: row?.quantity ?? 0,
            revenue: round1(revenue),
            creditRevenue: round1(creditRevenue),
            posRevenue: round1(posRevenue),
            cashRevenue: round1(revenue - creditRevenue - posRevenue),
            prepOrders: readySamples,
            avgPrepSeconds: readySamples > 0 ? Math.round((row?.readySeconds ?? 0) / readySamples) : null,
            /* Crediti guadagnati su tutto l'evento, indipendentemente dalla finestra. */
            earnedCredits: round1(earnedCredits),
            settledCredits: round1(buckets.settledCredits),
            settledEuro: round1(buckets.settledEuro),
            loadedCredits: round1(buckets.loadedCredits),
            grossEuro: round1(buckets.grossEuro),
            feeEuro: round1(buckets.feeEuro),
            payoutEuro: round1(buckets.payoutEuro),
            /* Crediti caricati ma non ancora liquidati: mai negativo, e' un
             * segnale ("manca la chiusura"), non un errore contabile. */
            toReturnCredits: round1(Math.max(0, buckets.loadedCredits - buckets.settledCredits)),
            /* Crediti guadagnati e non ancora liquidati: e' il residuo che
             * l'operatore deve ancora corrispondere. Diverso da `toReturnCredits`
             * (che guarda i soli DARE) e calcolato sui crediti guadagnati su tutto
             * l'evento contro i liquidati nella finestra. */
            remainingEarnedCredits: round1(Math.max(0, earnedCredits - buckets.settledCredits)),
            settlementCount: buckets.settlementCount,
            loadCount: buckets.loadCount,
            settlementCountAllTime: presence?.count ?? 0,
            lastSettlementAt: presence?.lastOccurredAt ?? null,
            /* Ha venduto ma non e' mai stato liquidato in nessun momento
             * dell'evento: la riga resta con gli zeri delle liquidazioni e il
             * frontend la segnala. */
            neverSettled: presence === undefined && earnedCredits > 0
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
            avgPrepSeconds: prepOrders > 0 ? Math.round(prepSeconds / prepOrders) : null,
            /* Liquidazioni: sezione a parte, mai sommata al fatturato. I crediti
             * guadagnati sono cumulativi sull'evento, le liquidazioni sono
             * quelle cadute nella finestra. */
            settlements: {
                earnedCredits: round1([...earnedByStand.values()].reduce((a, b) => a + b, 0)),
                settledCredits: round1(byStand.reduce((a, s) => a + s.settledCredits, 0)),
                settledEuro: round1(byStand.reduce((a, s) => a + s.settledEuro, 0)),
                loadedCredits: round1(byStand.reduce((a, s) => a + s.loadedCredits, 0)),
                grossEuro: round1(byStand.reduce((a, s) => a + s.grossEuro, 0)),
                feeEuro: round1(byStand.reduce((a, s) => a + s.feeEuro, 0)),
                payoutEuro: round1(byStand.reduce((a, s) => a + s.payoutEuro, 0)),
                toReturnCredits: round1(byStand.reduce((a, s) => a + s.toReturnCredits, 0)),
                remainingEarnedCredits: round1(byStand.reduce((a, s) => a + s.remainingEarnedCredits, 0)),
                settlementCount: byStand.reduce((a, s) => a + s.settlementCount, 0),
                loadCount: byStand.reduce((a, s) => a + s.loadCount, 0),
                /* Stand che hanno guadagnato crediti ma non hanno mai ricevuto
                 * una liquidazione: vanno richiamati all'operatore. */
                standsNeverSettled: byStand.filter((s) => s.neverSettled).length
            }
        },
        hourly,
        topProducts,
        prepBuckets,
        byStand,
        tokens: { ...tokenLedger, issued: buildIssuedTokens(event, tokenLedger) },
        tokensByProduct: tokenByProduct.products
    });
}