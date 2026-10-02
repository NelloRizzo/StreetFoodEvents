import { Types } from 'mongoose';

import { OrderModel } from '../models/order.model';
import { StandSettlementModel } from '../models/stand-settlement.model';

/**
 * Aggregazione delle liquidazioni per stand, condivisa da
 * `/events/:eventId/analytics` e `/events/:eventId/visitors`.
 *
 * Vive in un modulo perche' la parte non ovvia sono i record legacy:
 * `direction` e `unit` non esistevano in tutte le versioni dello schema, e con
 * `required` + `default` (= 'credit' / 'credits') un documento gia' salvato
 * continua a valere come AVERE in crediti. Se i due endpoint ricomponessero la
 * pipeline a mano, un fix su uno lascerebbe l'altro indietro e le due pagine
 * mostrerebbero numeri diversi sulle stesse liquidazioni.
 *
 * SEMANTICA (da StandSettlement):
 *  - `direction: 'credit'` (AVERE) = lo stand viene pagato in euro: contano
 *    `settledCredits`/`settledEuro` e le tre cifre in euro. Senza `direction` il
 *    record vale 'credit' (vedi `$ifNull`).
 *  - `direction: 'debit'` (DARE) = crediti caricati sullo stand, nessun
 *    pagamento: `grossEuro`/`feeEuro`/`payoutEuro` sono forzati a 0.
 *  - `unit: 'euro'` = liquidazione gia' espressa in euro: finisce in
 *    `settledEuro`/`loadedEuro` e MAI nei crediti.
 */
export type SettlementBuckets = {
    /** Crediti liquidati in favore dello stand (AVERE, `unit: 'credits'`). */
    settledCredits: number;
    /** Euro corrisposti allo stand: `unit: 'euro'` + payout delle AVERE. */
    settledEuro: number;
    /** Crediti caricati sullo stand (DARE). */
    loadedCredits: number;
    loadedEuro: number;
    grossEuro: number;
    feeEuro: number;
    payoutEuro: number;
    settlementCount: number;
    loadCount: number;
};

export function emptySettlementBuckets(): SettlementBuckets {
    return {
        settledCredits: 0,
        settledEuro: 0,
        loadedCredits: 0,
        loadedEuro: 0,
        grossEuro: 0,
        feeEuro: 0,
        payoutEuro: 0,
        settlementCount: 0,
        loadCount: 0
    };
}

export function addSettlementBuckets(target: SettlementBuckets, source: SettlementBuckets): SettlementBuckets {
    target.settledCredits += source.settledCredits;
    target.settledEuro += source.settledEuro;
    target.loadedCredits += source.loadedCredits;
    target.loadedEuro += source.loadedEuro;
    target.grossEuro += source.grossEuro;
    target.feeEuro += source.feeEuro;
    target.payoutEuro += source.payoutEuro;
    target.settlementCount += source.settlementCount;
    target.loadCount += source.loadCount;
    return target;
}

/**
 * Liquidazioni per stand nella finestra `[from, to]`.
 *
 * La finestra filtra `occurredAt` (quando la liquidazione e' avvenuta), NON la
 * data degli ordini che l'hanno generata: sono due date diverse e obbligano a
 * tenere separati i due insiemi (vedi `getEarnedCreditsByStand`).
 */
export async function getSettlementBucketsByStand(params: {
    eventId: Types.ObjectId;
    from: Date;
    to: Date;
    standId?: Types.ObjectId | undefined;
}): Promise<Map<string, SettlementBuckets>> {
    const { eventId, from, to, standId } = params;

    const rows = await StandSettlementModel.aggregate([
        {
            $match: {
                eventId,
                ...(standId ? { standId } : {}),
                occurredAt: { $gte: from, $lte: to }
            }
        },
        {
            $group: {
                _id: { standId: '$standId', direction: { $ifNull: ['$direction', 'credit'] } },
                credits: {
                    $sum: {
                        $cond: [{ $ne: [{ $ifNull: ['$unit', 'credits'] }, 'euro'] }, '$amount', 0]
                    }
                },
                euros: {
                    $sum: {
                        $cond: [{ $eq: [{ $ifNull: ['$unit', 'credits'] }, 'euro'] }, '$amount', 0]
                    }
                },
                grossEuro: { $sum: '$grossEuro' },
                feeEuro: { $sum: '$feeEuro' },
                payoutEuro: { $sum: '$payoutEuro' },
                count: { $sum: 1 }
            }
        }
    ]);

    const byStand = new Map<string, SettlementBuckets>();
    for (const row of rows) {
        const standIdKey = row._id.standId.toString();
        const buckets = byStand.get(standIdKey) ?? emptySettlementBuckets();
        if (row._id.direction === 'debit') {
            buckets.loadedCredits += row.credits;
            buckets.loadedEuro += row.euros;
            buckets.loadCount += row.count;
        } else {
            buckets.settledCredits += row.credits;
            buckets.settledEuro += row.euros;
            buckets.grossEuro += row.grossEuro;
            buckets.feeEuro += row.feeEuro;
            buckets.payoutEuro += row.payoutEuro;
            buckets.settlementCount += row.count;
        }
        byStand.set(standIdKey, buckets);
    }
    return byStand;
}

/**
 * Crediti guadagnati dagli stand, SEMPRE su tutto l'evento.
 *
 * Non filtrate dalla finestra di propósito: sono il denominatore del residuo.
 * Se filtrassero come le vendite, una liquidazione caduta dentro la finestra
 * che paga crediti guadagnati fuori darebbe un residuo negativo falso.
 * Esclusioni allineate alle vendite: gli omaggi non generano fatturato e i
 * cancellati non contano.
 */
export async function getEarnedCreditsByStand(params: {
    eventId: Types.ObjectId;
    standId?: Types.ObjectId | undefined;
}): Promise<Map<string, number>> {
    const { eventId, standId } = params;

    const rows = await OrderModel.aggregate([
        {
            $match: {
                eventId,
                ...(standId ? { standId } : {}),
                status: { $ne: 'cancelled' },
                isGift: { $ne: true }
            }
        },
        { $group: { _id: '$standId', earnedCredits: { $sum: '$creditAmountUsed' } } }
    ]);

    return new Map(rows.map((row) => [row._id.toString(), row.earnedCredits ?? 0]));
}

/**
 * Esistenza di almeno una liquidazione per stand, su TUTTO l'evento.
 *
 * Serve al badge "mai liquidato", che per sua natura guarda oltre la finestra:
 * uno stand liquidato a giugno e filtrato su un giorno di maggio ha zero
 * liquidazioni *nella finestra* ma non è mai stato liquidato in assoluto. Se il
 * badge usasse il conteggio filtrato, ogni filtro di data trasformerebbe la
 * segnalazione da "vi siete dimenticati di chiudere lo stand" in un falso
 * allarme. Il badge usa questa mappa; gli importi restano quelli di
 * `getSettlementBucketsByStand`.
 */
export async function getSettlementPresenceByStand(params: {
    eventId: Types.ObjectId;
    standId?: Types.ObjectId | undefined;
}): Promise<Map<string, { count: number; lastOccurredAt: Date | null }>> {
    const { eventId, standId } = params;

    const rows = await StandSettlementModel.aggregate([
        { $match: { eventId, ...(standId ? { standId } : {}) } },
        { $group: { _id: '$standId', count: { $sum: 1 }, lastOccurredAt: { $max: '$occurredAt' } } }
    ]);

    return new Map(rows.map((row) => [row._id.toString(), { count: row.count, lastOccurredAt: row.lastOccurredAt ?? null }]));
}