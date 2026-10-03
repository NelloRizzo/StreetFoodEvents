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

    /* ------------------------------------------------------------------
     * FATTURATO COMPRENDENTE LE LIQUIDAZIONI (decisione di prodotto).
     *
     * Il denaro liquidato a uno stand **entra anche nel suo fatturato**, e con
     * lui tutte le colonne che dal fatturato dipendono. Quindi:
     *
     *  - `payoutEuro` è in EURO e il fatturato è in CREDITI: la somma richiede
     *    la conversione (`× exchangeRate`). Senza, con un tasso diverso da 1 si
     *    sommerebbero due unità diverse.
     *  - se lo stand ha ordini nella finestra, le colonne si **proporzionano**
     *    al fatturato (`scale = fatturato comprensivo / fatturato ordini`);
     *  - se NON ha ordini ma ha una liquidazione, ordini e quantità sono
     *    **stimati** dagli scontrini/prezzi medi dell'evento e la ripartizione
     *    contanti/crediti usa le quote osservate sull'evento.
     *
     * AVVERTENZA CONTABILE: per uno stand i cui ordini sono già nella finestra
     * questo **doppia** il valore (quegli stessi euro sono già dentro
     * `order.total`). È una scelta deliberata: il fatturato così dice "quanto
     * denaro è passato dalla cassa cambio", non "quanto è stato venduto". Per
     * questo `orderRevenue` resta esposto accanto a `revenue`: la differenza è
     * la quota di liquidazione, e i due numeri non vanno sommati né confrontati
     * con i report di cassa.
     * ------------------------------------------------------------------ */
    const exchangeRate = event.exchangeRate ?? 1;

    /* Medie e quote dell'evento, calcolate sugli ordini (base "pulita"): servono
       solo per gli stand che non hanno ordini nella finestra. */
    const orderRevenueTotal = byStandRows.reduce((sum, row) => sum + row.revenue, 0);
    const orderOrdersTotal = byStandRows.reduce((sum, row) => sum + row.orders, 0);
    const orderQuantityTotal = byStandRows.reduce((sum, row) => sum + row.quantity, 0);
    const orderCreditTotal = byStandRows.reduce((sum, row) => sum + row.creditRevenue, 0);
    const orderPosTotal = byStandRows.reduce((sum, row) => sum + row.posRevenue, 0);
    const avgOrderValue = orderOrdersTotal > 0 ? orderRevenueTotal / orderOrdersTotal : 0;
    const avgUnitPrice = orderQuantityTotal > 0 ? orderRevenueTotal / orderQuantityTotal : 0;
    const creditShare = orderRevenueTotal > 0 ? orderCreditTotal / orderRevenueTotal : 0;
    const posShare = orderRevenueTotal > 0 ? orderPosTotal / orderRevenueTotal : 0;

    const byStand = [...standIdsInReport].map((standId) => {
        const info = standInfo.get(standId) ?? { name: 'Stand sconosciuto', number: null, location: null };
        const row = salesByStand.get(standId);
        const buckets = settlementByStand.get(standId) ?? emptySettlementBuckets();
        const earnedCreditsObserved = earnedByStand.get(standId) ?? 0;
        const presence = settlementPresence.get(standId);
        const readySamples = row?.readySamples ?? 0;

        const orderRevenue = row?.revenue ?? 0;
        const orderCreditRevenue = row?.creditRevenue ?? 0;
        const orderPosRevenue = row?.posRevenue ?? 0;
        /* Euro erogati riportati in crediti: è la grandezza che si somma. */
        const payoutCredits = buckets.payoutEuro * exchangeRate;
        const revenue = orderRevenue + payoutCredits;

        let orders: number;
        let quantity: number;
        let creditRevenue: number;
        let posRevenue: number;
        let earned: number;

        if (orderRevenue > 0) {
            /* Proporzione sul fatturato: le colonne restano proporzionate a
               come sono state registrate sugli ordini. */
            const scale = revenue / orderRevenue;
            orders = Math.round((row?.orders ?? 0) * scale);
            quantity = (row?.quantity ?? 0) * scale;
            creditRevenue = orderCreditRevenue * scale;
            posRevenue = orderPosRevenue * scale;
            earned = earnedCreditsObserved * scale;
        } else {
            /* Nessun ordine nella finestra: stime dalle medie dell'evento. */
            orders = avgOrderValue > 0 ? Math.round(revenue / avgOrderValue) : 0;
            quantity = avgUnitPrice > 0 ? revenue / avgUnitPrice : 0;
            creditRevenue = revenue * creditShare;
            posRevenue = revenue * posShare;
            earned = revenue * creditShare;
        }

        return {
            standId,
            standName: info.name,
            number: info.number,
            location: info.location,
            orders,
            quantity: round1(quantity),
            /** Fatturato comprensivo delle liquidazioni (vedi blocco sopra). */
            revenue: round1(revenue),
            /** Quota del fatturato che viene dagli ordini: `revenue - orderRevenue`
             *  è la liquidazione. */
            orderRevenue: round1(orderRevenue),
            /** Euro erogati riportati in crediti. */
            payoutCredits: round1(payoutCredits),
            creditRevenue: round1(creditRevenue),
            posRevenue: round1(posRevenue),
            cashRevenue: round1(revenue - creditRevenue - posRevenue),
            prepOrders: readySamples,
            avgPrepSeconds: readySamples > 0 ? Math.round((row?.readySeconds ?? 0) / readySamples) : null,
            /** Crediti guadagnati comprensivi della quota liquidata (cumulativi
             *  sull'evento): base temporale mista, come sopra. */
            earnedCredits: round1(earned),
            settledCredits: round1(buckets.settledCredits),
            settledEuro: round1(buckets.settledEuro),
            loadedCredits: round1(buckets.loadedCredits),
            grossEuro: round1(buckets.grossEuro),
            feeEuro: round1(buckets.feeEuro),
            payoutEuro: round1(buckets.payoutEuro),
            /* Crediti caricati ma non ancora liquidati: mai negativo, è un
             * segnale ("manca la chiusura"), non un errore contabile. */
            toReturnCredits: round1(Math.max(0, buckets.loadedCredits - buckets.settledCredits)),
            /* Crediti guadagnati e non ancora liquidati: è il residuo che
             * l'operatore deve ancora corrispondere. Diverso da `toReturnCredits`
             * (che guarda i soli DARE). */
            remainingEarnedCredits: round1(Math.max(0, earned - buckets.settledCredits)),
            settlementCount: buckets.settlementCount,
            loadCount: buckets.loadCount,
            settlementCountAllTime: presence?.count ?? 0,
            lastSettlementAt: presence?.lastOccurredAt ?? null,
            /* Ha venduto ma non è mai stato liquidato in nessun momento
             * dell'evento: la riga resta con gli zeri delle liquidazioni e il
             * frontend la segnala. */
            neverSettled: presence === undefined && earnedCreditsObserved > 0
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

    /* I totali sommano le righe **comprensive delle liquidazioni**: se
       sommassero gli aggregati sugli ordini, la tabella e il totale
       mostrerebbero due numeri diversi per la stessa cosa. */
    const orders = byStand.reduce((sum, row) => sum + row.orders, 0);
    const quantity = byStand.reduce((sum, row) => sum + row.quantity, 0);
    const revenue = byStand.reduce((sum, row) => sum + row.revenue, 0);
    const creditRevenue = byStand.reduce((sum, row) => sum + row.creditRevenue, 0);
    const posRevenue = byStand.reduce((sum, row) => sum + row.posRevenue, 0);
    const prepOrders = byStandRows.reduce((sum, row) => sum + row.readySamples, 0);
    const prepSeconds = byStandRows.reduce((sum, row) => sum + row.readySeconds, 0);
    /* Quota del fatturato che viene dagli ordini: esposta perche' il fatturato
       ora include le liquidazioni e i due numeri non vanno sommati. */
    const orderRevenue = byStand.reduce((sum, row) => sum + row.orderRevenue, 0);
    const payoutCredits = byStand.reduce((sum, row) => sum + row.payoutCredits, 0);

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
            /** Parte del fatturato che viene dagli ordini (vedi blocco stand). */
            orderRevenue: round1(orderRevenue),
            /** Liquidazioni riportate in crediti e sommate al fatturato. */
            payoutCredits: round1(payoutCredits),
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