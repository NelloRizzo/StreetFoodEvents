import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { EventModel } from '../models/event.model';
import { EventProductModel } from '../models/event-product.model';
import { EventUserTransactionModel } from '../models/event-user-transaction.model';
import { OrderModel } from '../models/order.model';
import { StandModel } from '../models/stand.model';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

/**
 * Stima visitatori.
 *
 * V1 — tabella fissa (non configurabile) di coefficienti "unità vendute → visitatori"
 * per categoria di prodotto. Le categorie sono etichette libere (EventProduct.categoryIds);
 * il match è case-insensitive, con fallback a DEFAULT_COEFFICIENT per le categorie ignote.
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

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}

function coefficientFor(label: string): number {
    const key = label.trim().toLowerCase();
    return CATEGORY_COEFFICIENTS[key] ?? DEFAULT_COEFFICIENT;
}

function isDateOnly(raw: string | undefined): boolean {
    return raw !== undefined && DATE_ONLY_RE.test(raw);
}

/**
 * GET /api/events/:eventId/visitors
 * Guard: event-admin / event-cashier / platform-admin.
 *
 * Query opzionali: from, to (ISO), standId, stationId.
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

    const parsedFrom = fromRaw && !Number.isNaN(new Date(fromRaw).getTime()) ? new Date(fromRaw) : null;
    const parsedTo = toRaw && !Number.isNaN(new Date(toRaw).getTime()) ? new Date(toRaw) : null;

    const from: Date = parsedFrom
        ?? (event.startDate ? new Date(event.startDate) : new Date(0));
    const to: Date = parsedTo
        ?? new Date(event.endDate.getTime());

    if (!parsedTo || isDateOnly(toRaw)) {
        to.setHours(23, 59, 59, 999);
    }

    const matchFilter: Record<string, unknown> = {
        eventId: eventIdObj,
        createdAt: { $gte: from, $lte: to }
    };

    const standIdQuery = req.query.standId as string | undefined;
    const stationIdQuery = req.query.stationId as string | undefined;

    if (standIdQuery && isValidObjectId(standIdQuery)) {
        matchFilter.standId = new Types.ObjectId(standIdQuery);
    }

    if (stationIdQuery && isValidObjectId(stationIdQuery)) {
        matchFilter['items.stationId'] = new Types.ObjectId(stationIdQuery);
    }

    const [categoryRows, standRows, tokenRows, spendRows] = await Promise.all([
        OrderModel.aggregate([
            { $match: { ...matchFilter, status: { $ne: 'cancelled' }, isGift: { $ne: true } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: { standId: '$standId', epId: '$items.eventProductId' },
                    quantity: { $sum: '$items.quantity' }
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
        ])
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

    const quantityByStandCategory = new Map<string, Map<string, number>>();
    for (const row of categoryRows) {
        const standKey = row._id.standId.toString();
        const categories = categoryByEp.get(row._id.epId.toString()) ?? [];
        const labels = categories.length > 0 ? categories : [NO_CATEGORY_LABEL];
        const catMap = quantityByStandCategory.get(standKey) ?? new Map<string, number>();
        for (const label of labels) {
            catMap.set(label, (catMap.get(label) ?? 0) + row.quantity);
        }
        quantityByStandCategory.set(standKey, catMap);
    }

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

    let productEstimatedUnrounded = 0;

    const standsResponse = [...standInfo.keys()].map((standId) => {
        const info = standInfo.get(standId)!;
        const catMap = quantityByStandCategory.get(standId) ?? new Map<string, number>();
        const agg = orderRowByStand.get(standId);

        const categories = [...catMap.entries()]
            .map(([label, quantity]) => {
                const coefficient = coefficientFor(label);
                return { label, quantity, coefficient, estimatedVisitors: round1(quantity * coefficient) };
            })
            .sort((a, b) => b.estimatedVisitors - a.estimatedVisitors || a.label.localeCompare(b.label));

        let standEstimated = 0;
        for (const category of categories) {
            standEstimated += category.quantity * category.coefficient;
        }
        productEstimatedUnrounded += standEstimated;

        return {
            standId,
            standName: info.name,
            number: info.number,
            hasOrders: (agg?.ordersCount ?? 0) > 0,
            ordersCount: agg?.ordersCount ?? 0,
            distinctCustomers: agg?.distinctCustomers ?? 0,
            categories,
            estimatedVisitorsTotal: round1(standEstimated)
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
        totals: {
            productEstimated: round1(productEstimatedUnrounded),
            tokenBasedEstimated,
            distinctTokenBuyers,
            distinctOrderCustomers: standsResponse.reduce((sum, s) => sum + s.distinctCustomers, 0),
            nonCancelledOrders: standRows.reduce((sum, row) => sum + row.ordersCount, 0),
            netTokensSold
        },
        stands: standsResponse
    });
}