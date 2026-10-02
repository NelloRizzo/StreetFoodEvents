import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { EventModel } from '../models/event.model';
import { EventProductModel } from '../models/event-product.model';
import { EventUserTransactionModel } from '../models/event-user-transaction.model';
import { OrderModel } from '../models/order.model';
import { StandModel } from '../models/stand.model';
import {
    getEarnedCreditsByStand,
    getSettlementBucketsByStand
} from '../services/stand-settlements-analytics.service';
import { resolveDateWindow } from '../utils/date-window';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

/**
 * Stima visitatori.
 *
 * V1 — tabella fissa (non configurabile) di coefficienti "unità vendute → visitatori"
 * per categoria di prodotto. Le categorie sono etichette libere (EventProduct.categoryIds);
 * il match è case-insensitive, con fallback a DEFAULT_COEFFICIENT per le categorie ignote.
 * Un prodotto può appartenere a più categorie: ogni unità venduta è attribuita UNA sola volta,
 * alla categoria col coefficiente più alto (le altre categorie, se presenti, non ricevono la
 * quantità) così il totale non conteggia più volte lo stesso prodotto.
 */
const CATEGORY_COEFFICIENTS: Record<string, number> = {
    bevande: 0.33,
    bibite: 0.33,
    acqua: 0.33,
    birra: 0.33,
    vino: 0.5,
    caffè: 0.25,
    'caffe': 0.25,
    dolci: 0.8,
    dessert: 0.8,
    gelato: 0.8
};

const DEFAULT_COEFFICIENT = 1;

/**
 * Fallback "token per visitatore" quando non ci sono ordini pagati osservabili
 * (allineato all'idea "10 unità ≈ 1 visitatore" della sezione GTM del TODO).
 */
const DEFAULT_TOKENS_PER_VISITOR = 10;

const NO_CATEGORY_LABEL = 'Senza categoria';

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}

/** Le quote di sovrapposizione servono a un decimale: arrotondare a intero le
 *  renderebbe tutte 0 o 1 e la correzione sparirebbe. */
function round3(value: number): number {
    return Math.round(value * 1000) / 1000;
}

function coefficientFor(label: string): number {
    const key = label.trim().toLowerCase();
    return CATEGORY_COEFFICIENTS[key] ?? DEFAULT_COEFFICIENT;
}

function pickCategoryLabel(categories: string[]): string {
    if (categories.length === 0) return NO_CATEGORY_LABEL;
    return [...categories].sort(
        (a, b) => coefficientFor(b) - coefficientFor(a) || a.localeCompare(b)
    )[0] as string;
}

/**
 * GET /api/events/:eventId/visitors
 * Guard: event-admin / event-cashier / platform-admin.
 *
 * Query opzionali: from, to (ISO), standId, stationId.
 *
 * TRE BASI DI STIMA, tenute separate e mai sommate fra loro:
 *  1. `productEstimated` — per categoria, con correzione di sovrapposizione.
 *  2. `tokenBasedEstimated` — crediti caricati (top-up − refund) ÷ token per
 *     visitatore. Conta come visitatori anche chi non ha speso nulla, quindi
 *     sopravvaluta se i token restano nei portafogli.
 *  3. `settlementBasedEstimated` — crediti che gli stand hanno davvero
 *     convertito in euro ÷ token per visitatore: il consumo reale, non il
 *     caricamento. `null` se non ci sono liquidazioni (zero non è un dato).
 *
 * SOVRAPPOSIZIONE (perché il totale non è la somma delle categorie): un
 * visitatore che mangia da un banco e beve da un altro viene visto due volte
 * dalla somma per categoria. Il peso delle categorie successive al maggiore si
 * misura dagli ordini veri: `soloQuota[c]` = quota di carrelli che contengono
 * la categoria `c` e NULLA ALTRA. Chi ha comprato solo panini è un visitatore
 * nuovo anche se il totale è già stato saturato dai panini; chi ha fatto un
 * carrello misto è già stato contato. Il peso è quindi un dato osservato e si
 * ricalcola da solo a ogni evento. `productEstimatedUnweighted` espone la vecchia
 * somma grezza, così l'effetto della correzione resta visibile.
 *
 * LIQUIDAZIONI PER CATEGORIA: non hanno prodotti, solo un totale per stand, e i
 * crediti sono in valore non in pezzi — non si possono moltiplicare per un
 * coefficiente "visitatori per unità". Vengono quindi ripartiti sulle categorie
 * in proporzione al mix di vendita reale del loro stand (`subtotal`), e la
 * ripartizione è informativa: il totale della terza base resta
 * `crediti liquidati ÷ token per visitatore`. I crediti di uno stand senza
 * vendite non sono attribuibili e finiscono in `unattributedSettledCredits`.
 */
export async function getVisitorEstimate(req: Request, res: Response) {
    const eventId = req.params.eventId;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await EventModel.findById(eventId).select('name currencyName currencySymbol exchangeRate startDate endDate');
    if (!event) {
        return res.status(404).json({ message: 'Event not found' });
    }

    const eventIdObj = new Types.ObjectId(eventId);

    const fromRaw = req.query.from as string | undefined;
    const toRaw = req.query.to as string | undefined;

    const { from, to } = resolveDateWindow(event, fromRaw, toRaw);

    const matchFilter: Record<string, unknown> = {
        eventId: eventIdObj,
        createdAt: { $gte: from, $lte: to }
    };

    const standIdQuery = req.query.standId as string | undefined;
    const stationIdQuery = req.query.stationId as string | undefined;

    const standIdObj = standIdQuery && isValidObjectId(standIdQuery)
        ? new Types.ObjectId(standIdQuery)
        : undefined;

    if (standIdObj) {
        matchFilter.standId = standIdObj;
    }

    if (stationIdQuery && isValidObjectId(stationIdQuery)) {
        matchFilter['items.stationId'] = new Types.ObjectId(stationIdQuery);
    }

    /* La categoria di un prodotto sta su EventProduct, non sull'ordine: per il
     * peso di sovrapposizione serve sapere quante categorie diverse compaiono
     * in ogni singolo carrello, quindi si raccolgono i prodotti per ordine e la
     * traduzione in categorie si fa in JS (stessa `pickCategoryLabel` usata per
     * i totali: un prodotto non viene contato due volte su due categorie). */
    const [categoryRows, standRows, tokenRows, spendRows, basketRows, settlementByStand, earnedByStand] = await Promise.all([
        OrderModel.aggregate([
            { $match: { ...matchFilter, status: { $ne: 'cancelled' }, isGift: { $ne: true } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: { standId: '$standId', epId: '$items.eventProductId' },
                    quantity: { $sum: '$items.quantity' },
                    /* Serve al mix di vendita con cui i crediti liquidati vengono
                     * ripartiti sulle categorie: è denaro, non pezzi. */
                    revenue: { $sum: '$items.subtotal' }
                }
            }
        ]),
        OrderModel.aggregate([
            { $match: { ...matchFilter, status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: '$standId',
                    ordersCount: { $sum: 1 },
                    customers: {
                        $addToSet: {
                            $cond: [
                                { $ne: ['$customerId', null] },
                                '$customerId',
                                { $ifNull: ['$customerName', ''] }
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    ordersCount: 1,
                    distinctCustomers: {
                        $size: { $filter: { input: '$customers', as: 'c', cond: { $ne: ['$$c', ''] } } }
                    }
                }
            }
        ]),
        EventUserTransactionModel.aggregate([
            {
                $match: {
                    eventId: eventIdObj,
                    type: { $in: ['top-up', 'refund'] },
                    occurredAt: { $gte: from, $lte: to }
                }
            },
            { $group: { _id: '$type', total: { $sum: '$amount' }, buyers: { $addToSet: '$eventUserId' } } }
        ]),
        OrderModel.aggregate([
            {
                $match: {
                    ...matchFilter,
                    status: { $ne: 'cancelled' },
                    isGift: { $ne: true },
                    paymentStatus: 'paid',
                    creditAmountUsed: { $gt: 0 }
                }
            },
            { $group: { _id: null, avgSpend: { $avg: '$creditAmountUsed' }, orders: { $sum: 1 } } }
        ]),
        /* Un documento per ordine con i suoi prodotti distinti: serve a capire se
         * il carrello mescola categorie diverse (peso di sovrapposizione). */
        OrderModel.aggregate([
            { $match: { ...matchFilter, status: { $ne: 'cancelled' }, isGift: { $ne: true } } },
            { $unwind: '$items' },
            { $group: { _id: '$_id', eps: { $addToSet: '$items.eventProductId' } } }
        ]),
        /* Liquidazioni nella finestra: crediti davvero convertiti in euro dal
         * banco cambio, quindi il consumo reale dei token. Stesso helper di
         * `/analytics`, così le due pagine non possono divergere. */
        getSettlementBucketsByStand({
            eventId: eventIdObj,
            from,
            to,
            standId: standIdObj
        }),
        /* Credi guadagnati su TUTTO l'evento (nessuna finestra): è la base del
         * confronto "guadagnato vs liquidato" per stand. */
        getEarnedCreditsByStand({ eventId: eventIdObj, standId: standIdObj })
    ]);

    let topUp = 0;
    let refund = 0;
    const topUpBuyers = new Set<string>();
    for (const row of tokenRows) {
        if (row._id === 'top-up') {
            topUp = row.total;
            for (const buyer of row.buyers ?? []) {
                topUpBuyers.add(buyer.toString());
            }
        } else if (row._id === 'refund') {
            refund = row.total;
        }
    }
    const netTokensSold = topUp - refund;
    const distinctTokenBuyers = topUpBuyers.size;

    const spendRow = spendRows[0];
    const tokensPerVisitor = spendRow && spendRow.orders > 0
        ? round1(spendRow.avgSpend)
        : DEFAULT_TOKENS_PER_VISITOR;
    const tokenBasedEstimated = round1(netTokensSold / tokensPerVisitor);

    const epIds = [...new Set(categoryRows.map((row) => row._id.epId.toString()))]
        .map((id) => new Types.ObjectId(id));
    const categoryByEp = new Map<string, string[]>();
    if (epIds.length > 0) {
        const products = await EventProductModel.find({ eventId: eventIdObj, _id: { $in: epIds } })
            .select('categoryIds')
            .lean();
        for (const product of products) {
            categoryByEp.set(product._id.toString(), product.categoryIds ?? []);
        }
    }

    /* Una categoria sola per prodotto: `pickCategoryLabel` garantisce che lo
     * stesso prodotto non venga attribuito a due categorie, né nei totali né nel
     * conteggio "carrello misto" più sotto. */
    const labelByEp = new Map<string, string>();
    for (const [epId, categories] of categoryByEp) {
        labelByEp.set(epId, pickCategoryLabel(categories));
    }
    const labelOfEp = (epId: unknown): string => labelByEp.get(String(epId)) ?? NO_CATEGORY_LABEL;

    const quantityByStandCategory = new Map<string, Map<string, { quantity: number; revenue: number }>>();
    for (const row of categoryRows) {
        const standKey = row._id.standId.toString();
        const label = labelOfEp(row._id.epId);
        const catMap = quantityByStandCategory.get(standKey) ?? new Map<string, { quantity: number; revenue: number }>();
        const entry = catMap.get(label) ?? { quantity: 0, revenue: 0 };
        entry.quantity += row.quantity;
        entry.revenue += row.revenue ?? 0;
        catMap.set(label, entry);
        quantityByStandCategory.set(standKey, catMap);
    }

    /* PESO DI SOVRAPPOSIZIONE misurato sui carrelli reali: `soloQuota[c]` = quota
     * di ordini che contengono la categoria `c` e NESSUN'ALTRA categoria. Se un
     * carrello mescola bibite e panini, quelle persone sono già state contate da
     * chi delle due categorie domina il totale: sommarle di nuovo le conterebbe
     * due volte. Chi invece ha comprato solo panini è un visitatore nuovo.
     * Il peso è dunque un dato osservato, non una costante: su un evento dove
     * nessuno mescola le categorie vale 1 e il totale coincide con la somma
     * grezza, su un evento "tutto misto" la correzione agisce da sola. */
    const basketsContaining = new Map<string, number>();
    const soloBaskets = new Map<string, number>();
    let multiCategoryBaskets = 0;
    let totalBaskets = 0;
    for (const row of basketRows) {
        const labels = new Set<string>();
        for (const epId of row.eps ?? []) {
            labels.add(labelOfEp(epId));
        }
        if (labels.size === 0) continue;
        totalBaskets += 1;
        const isSolo = labels.size === 1;
        if (!isSolo) multiCategoryBaskets += 1;
        for (const label of labels) {
            basketsContaining.set(label, (basketsContaining.get(label) ?? 0) + 1);
            if (isSolo) soloBaskets.set(label, (soloBaskets.get(label) ?? 0) + 1);
        }
    }
    const multiCategoryBasketShare = totalBaskets > 0 ? multiCategoryBaskets / totalBaskets : 0;

    /* Pool per CATEGORIA e non per stand: è il passaggio che rende confrontabili
     * le due stime. Un visitatore che compra panini da due stand finisce in un
     * solo pool (stessa etichetta) invece di essere contato due volte. Con
     * coefficienti lineari la quantità totale non cambia, ma il totale stimato
     * ora può essere corretto: è la somma di categorie diverse a essere
     * sovrastimata, non la somma delle unità di una stessa categoria. */
    const quantityByCategory = new Map<string, number>();
    for (const catMap of quantityByStandCategory.values()) {
        for (const [label, entry] of catMap) {
            quantityByCategory.set(label, (quantityByCategory.get(label) ?? 0) + entry.quantity);
        }
    }

    const categoryPools = [...quantityByCategory.entries()]
        .map(([label, quantity]) => {
            const coefficient = coefficientFor(label);
            const containing = basketsContaining.get(label) ?? 0;
            return {
                label,
                quantity,
                coefficient,
                visitors: quantity * coefficient,
                /* Nessun carrello osservato per la categoria = nessuna prova di
                 * mescolanza, quindi non si trattiene nulla (peso 1). */
                soloQuota: containing > 0 ? (soloBaskets.get(label) ?? 0) / containing : 1
            };
        })
        .sort((a, b) => b.visitors - a.visitors || a.label.localeCompare(b.label));

    let productEstimatedUnrounded = 0;
    let productEstimatedUnweightedUnrounded = 0;
    const categoriesResponse = categoryPools.map((pool, index) => {
        /* La categoria più grande fa da base (peso 1): è la visita "di fondo".
         * Le altre valgono quanto la quota dei loro carrelli esclusivi. */
        const weight = index === 0 ? 1 : pool.soloQuota;
        productEstimatedUnweightedUnrounded += pool.visitors;
        productEstimatedUnrounded += pool.visitors * weight;
        return {
            label: pool.label,
            quantity: pool.quantity,
            coefficient: pool.coefficient,
            estimatedVisitors: round1(pool.visitors),
            soloQuota: round3(pool.soloQuota),
            weight: round3(weight),
            weightedVisitors: round1(pool.visitors * weight)
        };
    });

    /* LIQUIDAZIONI ripartite sul mix di vendita del loro stand: i crediti sono in
     * valore (euro), i coefficienti sono "visitatori per unità" (pezzi), quindi
     * non si moltiplicano: si attribuisce a ogni categoria la quota dei crediti
     * liquidati pari al suo peso nel fatturato di quel singolo stand. La
     * ripartizione è informativa; il totale della terza base resta crediti
     * liquidati ÷ token per visitatore. */
    let settledCreditsTotal = 0;
    let unattributedSettledCredits = 0;
    const settledCreditsByStand = new Map<string, number>();
    /* Per STAND e non globale: la ripartizione è quella di quel banco, quindi la
     * tabella di uno stand con piu' categorie non deve farsi comparire i crediti
     * liquidati dagli altri stand. */
    const settledCreditsByStandCategory = new Map<string, Map<string, number>>();
    for (const [standKey, buckets] of settlementByStand) {
        const standSettled = round1(buckets.settledCredits);
        if (standSettled <= 0) continue;
        settledCreditsTotal += standSettled;
        settledCreditsByStand.set(standKey, (settledCreditsByStand.get(standKey) ?? 0) + standSettled);
        const catMap = quantityByStandCategory.get(standKey);
        let standRevenue = 0;
        if (catMap) {
            for (const entry of catMap.values()) standRevenue += entry.revenue;
        }
        if (!catMap || standRevenue <= 0) {
            /* Stand liquidato ma senza vendite nel periodo: il mix con cui
             * ripartire non esiste, quindi i crediti restano non attribuibili e si
             * segnalano invece di essere spalmati a caso. */
            unattributedSettledCredits += standSettled;
            continue;
        }
        const perCategory = new Map<string, number>();
        for (const [label, entry] of catMap) {
            perCategory.set(label, standSettled * (entry.revenue / standRevenue));
        }
        settledCreditsByStandCategory.set(standKey, perCategory);
    }
    /* `null` e non 0 quando non ci sono liquidazioni: zero liquidati non è una
     * stima di visitatori, è un dato assente. */
    const settlementBasedEstimated = settledCreditsTotal > 0
        ? round1(settledCreditsTotal / tokensPerVisitor)
        : null;

    const orderRowByStand = new Map(standRows.map((row) => [row._id.toString(), row]));

    const stands = await StandModel.find({ eventIds: eventIdObj }).select('name numbers').lean();
    const standInfo = new Map<string, { name: string; number: number | null }>();
    for (const stand of stands) {
        const numberEntry = (stand.numbers ?? []).find((n) => n.eventId.toString() === eventId);
        standInfo.set(stand._id.toString(), {
            name: stand.name,
            number: numberEntry?.number ?? null
        });
    }

    for (const standKey of quantityByStandCategory.keys()) {
        if (!standInfo.has(standKey)) {
            standInfo.set(standKey, { name: 'Stand sconosciuto', number: null });
        }
    }

    if (standIdQuery && isValidObjectId(standIdQuery)) {
        const standKey = new Types.ObjectId(standIdQuery).toString();
        const requested = standInfo.get(standKey) ?? { name: 'Stand sconosciuto', number: null };
        standInfo.clear();
        standInfo.set(standKey, requested);
    }

    const standsResponse = [...standInfo.keys()].map((standId) => {
        const info = standInfo.get(standId)!;
        const catMap = quantityByStandCategory.get(standId) ?? new Map<string, { quantity: number; revenue: number }>();
        const agg = orderRowByStand.get(standId);

        /* La riga per stand resta la stima "di quel banco": categorie sommate
         * senza pesi, perché la sovrapposizione si misura a livello di evento (i
         * carrelli attraversano più stand). Per questo le righe NON sono
         * addizionabili fra loro e il totale eventi va letto in `totals`. */
        const perStandSettled = settledCreditsByStandCategory.get(standId) ?? new Map<string, number>();
        const categories = [...catMap.entries()]
            .map(([label, entry]) => {
                const coefficient = coefficientFor(label);
                return {
                    label,
                    quantity: entry.quantity,
                    coefficient,
                    estimatedVisitors: round1(entry.quantity * coefficient),
                    /* Quota dei crediti liquidati di QUESTO stand attribuita a
                     * questa categoria in base al suo peso nel fatturato. */
                    settledCredits: round1(perStandSettled.get(label) ?? 0)
                };
            })
            .sort((a, b) => b.estimatedVisitors - a.estimatedVisitors || a.label.localeCompare(b.label));

        let standEstimated = 0;
        for (const category of categories) {
            standEstimated += category.quantity * category.coefficient;
        }

        return {
            standId,
            standName: info.name,
            number: info.number,
            hasOrders: (agg?.ordersCount ?? 0) > 0,
            ordersCount: agg?.ordersCount ?? 0,
            distinctCustomers: agg?.distinctCustomers ?? 0,
            categories,
            estimatedVisitorsTotal: round1(standEstimated),
            earnedCredits: round1(earnedByStand.get(standId) ?? 0),
            settledCredits: round1(settledCreditsByStand.get(standId) ?? 0)
        };
    }).sort(
        (a, b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.standName.localeCompare(b.standName)
    );

    return res.status(200).json({
        eventId,
        eventName: event.name,
        currencyName: event.currencyName,
        currencySymbol: event.currencySymbol ?? null,
        exchangeRate: event.exchangeRate ?? 1,
        window: { from: from.toISOString(), to: to.toISOString() },
        coefficientMap: CATEGORY_COEFFICIENTS,
        defaultCoefficient: DEFAULT_COEFFICIENT,
        tokensPerVisitor,
        overlap: {
            /* Quota di carrelli che mescolano più categorie: il numero da cui
             * capire se il peso di sovrapposizione sta lavorando o è un no-op. */
            multiCategoryBasketShare: round3(multiCategoryBasketShare),
            mixedBaskets: multiCategoryBaskets,
            totalBaskets
        },
        totals: {
            /* Le tre basi sono alternative, non addizionabili. */
            productEstimated: round1(productEstimatedUnrounded),
            productEstimatedUnweighted: round1(productEstimatedUnweightedUnrounded),
            tokenBasedEstimated,
            settlementBasedEstimated,
            distinctTokenBuyers,
            distinctOrderCustomers: standsResponse.reduce((sum, s) => sum + s.distinctCustomers, 0),
            nonCancelledOrders: standRows.reduce((sum, row) => sum + row.ordersCount, 0),
            netTokensSold,
            settledCredits: round1(settledCreditsTotal),
            unattributedSettledCredits: round1(unattributedSettledCredits),
            earnedCredits: round1([...earnedByStand.values()].reduce((sum, value) => sum + value, 0))
        },
        categories: categoriesResponse,
        stands: standsResponse
    });
}