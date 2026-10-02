import { Types } from 'mongoose';

import { CashRegisterModel } from '../models/cash-register.model';
import { CashRegisterMovementModel } from '../models/cash-register-movement.model';
import { EventModel } from '../models/event.model';
import { EventUserModel } from '../models/event-user.model';
import { EventUserTransactionModel } from '../models/event-user-transaction.model';
import { OrderModel } from '../models/order.model';

/**
 * Resoconto dei token (moneta evento) per `/events/:eventId/analytics`.
 *
 * TRE FLUSSI DISTINTI, da non confondere:
 *  - FLussi del periodo (`period`): quanto è entrato/uscito/usato nel periodo
 *    filtrato. Sommabili: `netLoaded - spent` è il resto del periodo.
 *  - Istantanea (`snapshot.inCirculation`): somma di `EventUser.balance`, cioè i
 *    token che i visitatori hanno ORA nei portafogli. Non è filtrabile per data
 *    (un saldo è uno saldo) né per stand (i portafogli sono per cliente, non per
 *    banco): quando la pagina è filtrata per stand questa cifra resta
 *    evento-wide e va letta come tale.
 *  - Istantanea (`snapshot.inCash`): token fisici nelle casse del banco cambio.
 *
 * `gap` è la quadratura: `inCirculation` meno il movimento netto registrato
 * dalle transazioni. Deve valere 0. Se non vale 0 esiste un movimento passato
 * dalla sola scrittura del saldo (`createEventUserTransaction` tocca sia saldo
 * che transazione, in una transazione Mongo: se diverge, è un bug o un
 * intervento manuale, e serve saperlo invece di mostrarlo come fatturato).
 */
export type TokenLedger = {
    period: {
        /** Crediti caricati dai visitatori (`type: 'top-up'`). */
        loaded: number;
        /** Rimborso del banco cambio (`refund` + `direction: 'debit'`): token usciti. */
        cashRefunded: number;
        /** Ordine annullato o parzialmente annullato (`refund` + `credit`):
         *  i token tornano in circolazione, non sono mai stati spesi. */
        orderRefunded: number;
        /** `loaded - cashRefunded`: token messi in circolazione nel periodo. */
        netLoaded: number;
        /** Token effettivamente spesi in ordini (`Order.creditAmountUsed`). */
        spent: number;
        /** Quota di `netLoaded` già spesa. `null` se `netLoaded` <= 0. */
        spentShareOfNetLoaded: number | null;
        /** `netLoaded - spent`: caricati nel periodo e ancora non spesi. */
        remaining: number;
    };
    snapshot: {
        inCirculation: number;
        netFromTransactions: number;
        gap: number;
        inCash: number;
        cashRegisterCount: number;
        registerFloats: number;
        legacyFloat: number;
        movementsIn: number;
        movementsOut: number;
    };
};

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function round3(value: number): number {
    return Math.round(value * 1000) / 1000;
}

/**
 * `inCash` = somma dei contenuti per cassa, cioè ESATTAMENTE le cifre che la
 * pagina Master Cambio mostra in riga, più il fondo legacy a livello evento.
 *
 * Ricalca la formula di `getCashRegisterStats` cassa per cassa
 * (`fondo - topUp + refund + movements in - out`) invece di usare la formula di
 * `getBalance`, che somma TUTTI i movimenti dell'evento e si basa solo sul fondo
 * legacy: le due non sono additive per costruzione, quindi i due report
 * finirebbero per mostrare cifre diverse sugli stessi token. Sommando per cassa,
 * ogni movimento di credito finisce nel registro che lo ha registrato una e una
 * sola volta (i movimenti senza cassa stanno nel "gusto" legacy, che è il posto
 * giusto dato che non appartengono a nessuna cassa).
 *
 * NOTA (convenzione già del banco cambio, non un bug introdotto qui): i
 * top-up/rimborsi POS contano nel contenuto crediti anche se il denaro è passato
 * dal terminale e non dal cassettone. I token esistono comunque.
 */
export async function getTokenLedger(params: {
    eventId: Types.ObjectId;
    from: Date;
    to: Date;
}): Promise<TokenLedger> {
    const { eventId, from, to } = params;

    const [
        flowRows,
        allTimeFlowRows,
        balanceRow,
        registers,
        movementRows,
        event,
        spentRows,
        allTimeExchangeRows
    ] = await Promise.all([
        /* Flussi del periodo, separati per tipo E direzione: `refund` da solo non
         * basta, perché con `credit` significa "ordine annullato" (i token
         * rientrano) e con `debit` "rimborso del cambio" (i token escono). */
        EventUserTransactionModel.aggregate([
            { $match: { eventId, type: { $in: ['top-up', 'refund'] }, occurredAt: { $gte: from, $lte: to } } },
            {
                $group: {
                    _id: { type: '$type', direction: { $ifNull: ['$direction', 'debit'] } },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]),
        /* Quadratura: TUTTE le transazioni, tutti i tipi, tutto il tempo, con il
         * segno del movimento del saldo. `transfer-in`/`transfer-out`/
         * `adjustment`/`promotion` rientrano qui ed è quello che le rende
         * quadrabili. */
        EventUserTransactionModel.aggregate([
            { $match: { eventId } },
            { $group: { _id: null, net: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', { $multiply: ['$amount', -1] }] } } } }
        ]),
        EventUserModel.aggregate([
            { $match: { eventId } },
            { $group: { _id: null, balance: { $sum: '$balance' } } }
        ]),
        CashRegisterModel.find({ eventId }).select('cashFloat').lean(),
        CashRegisterMovementModel.aggregate([
            { $match: { eventId } },
            {
                $group: {
                    _id: { cashRegisterId: '$cashRegisterId', currency: '$currency', direction: '$direction' },
                    total: { $sum: '$amount' }
                }
            }
        ]),
        EventModel.findById(eventId).select('cashFloat').lean(),
        /* Token spesi: `Order.creditAmountUsed` sull'ordine non cancellato e non
         * omaggio. Su un annullamento parziale il campo è già stato ridotto, su
         * quello totale l'ordine è `cancelled` e i crediti sono tornati con un
         * `refund`+`credit`: in entrambi i casi non risultano come spesi. */
        OrderModel.aggregate([
            {
                $match: {
                    eventId,
                    createdAt: { $gte: from, $lte: to },
                    status: { $ne: 'cancelled' },
                    isGift: { $ne: true }
                }
            },
            { $group: { _id: null, spent: { $sum: '$creditAmountUsed' } } }
        ]),
        /* Scambio per cassa, tutto il tempo: serve al contenuto dei cassoni. */
        EventUserTransactionModel.aggregate([
            { $match: { eventId, type: { $in: ['top-up', 'refund'] } } },
            { $group: { _id: { cashRegisterId: '$cashRegisterId', type: '$type' }, total: { $sum: '$amount' } } }
        ])
    ]);

    const pick = (
        rows: { _id: { type: string; direction: string }; total: number }[],
        type: string,
        direction: string
    ): number => rows.find((r) => r._id.type === type && r._id.direction === direction)?.total ?? 0;

    const loaded = pick(flowRows, 'top-up', 'credit');
    const cashRefunded = pick(flowRows, 'refund', 'debit');
    const orderRefunded = pick(flowRows, 'refund', 'credit');
    const netLoaded = loaded - cashRefunded;

    const spent = spentRows[0]?.spent ?? 0;

    /* Contenuto per cassa. La chiave del registro e' l'id stringa, con il
     * sentinel `null` per il fondo/movimenti legacy a livello evento. */
    const LEGACY = 'null';
    const floatByRegister = new Map<string, number>();
    for (const register of registers) {
        floatByRegister.set(register._id.toString(), register.cashFloat?.credits ?? 0);
    }
    floatByRegister.set(LEGACY, event?.cashFloat?.credits ?? 0);

    const registerFloats = [...floatByRegister.entries()]
        .filter(([key]) => key !== LEGACY)
        .reduce((sum, [, credits]) => sum + credits, 0);
    const legacyFloat = floatByRegister.get(LEGACY) ?? 0;

    const exchangeByRegister = new Map<string, { topUp: number; refund: number }>();
    for (const row of allTimeExchangeRows) {
        const key = row._id.cashRegisterId ? row._id.cashRegisterId.toString() : LEGACY;
        const entry = exchangeByRegister.get(key) ?? { topUp: 0, refund: 0 };
        if (row._id.type === 'top-up') entry.topUp += row.total;
        else entry.refund += row.total;
        exchangeByRegister.set(key, entry);
    }

    const movementByRegister = new Map<string, { in: number; out: number }>();
    for (const row of movementRows) {
        if (row._id.currency !== 'credits') continue;
        const key = row._id.cashRegisterId ? row._id.cashRegisterId.toString() : LEGACY;
        const entry = movementByRegister.get(key) ?? { in: 0, out: 0 };
        if (row._id.direction === 'in') entry.in += row.total;
        else entry.out += row.total;
        movementByRegister.set(key, entry);
    }

    let inCash = 0;
    for (const [key, float] of floatByRegister.entries()) {
        const exchange = exchangeByRegister.get(key) ?? { topUp: 0, refund: 0 };
        const movement = movementByRegister.get(key) ?? { in: 0, out: 0 };
        inCash += float - exchange.topUp + exchange.refund + movement.in - movement.out;
    }

    const movementsIn = [...movementByRegister.values()].reduce((sum, m) => sum + m.in, 0);
    const movementsOut = [...movementByRegister.values()].reduce((sum, m) => sum + m.out, 0);

    const inCirculation = balanceRow[0]?.balance ?? 0;
    const netFromTransactions = allTimeFlowRows[0]?.net ?? 0;

    return {
        period: {
            loaded: round2(loaded),
            cashRefunded: round2(cashRefunded),
            orderRefunded: round2(orderRefunded),
            netLoaded: round2(netLoaded),
            spent: round2(spent),
            spentShareOfNetLoaded: netLoaded > 0 ? round3(spent / netLoaded) : null,
            remaining: round2(netLoaded - spent)
        },
        snapshot: {
            inCirculation: round2(inCirculation),
            netFromTransactions: round2(netFromTransactions),
            gap: round2(inCirculation - netFromTransactions),
            inCash: round2(inCash),
            cashRegisterCount: registers.length,
            registerFloats: round2(registerFloats),
            legacyFloat: round2(legacyFloat),
            movementsIn: round2(movementsIn),
            movementsOut: round2(movementsOut)
        }
    };
}

/**
 * Crediti consumati per prodotto.
 *
 * `creditAmountUsed` sta sull'ORDINE, non sulla riga: non c'è un campo
 * "quanti token per questo piatto". La ripartizione avviene quindi per
 * `subtotal` (il peso del prodotto nel carrello), ed è fatta in una `$project` con
 * `$map`/`$sum` per farlo ESATTAMENTE per riga.
 *
 * GOTCHA (motivo per cui la pipeline non è aggregabile a gruppi): dividere per
 * `total` darebbe quote > 100% quando un coupon ha ridotto il totale sotto la
 * somma delle righe; aggregare per `{orderId, epId}` e poi ri-sommare
 * `creditAmountUsed` conterebbe i crediti una volta per riga e li ripartirebbe
 * male sui prodotti ripetuti. Con `$map` ogni riga riceve la sua quota esatta e i
 * crediti si sommano una sola volta.
 */
export async function getTokenSpentByProduct(params: {
    eventId: Types.ObjectId;
    from: Date;
    to: Date;
    standId?: Types.ObjectId | undefined;
}): Promise<{ products: TokenSpentByProduct[]; totalTokens: number }> {
    const { eventId, from, to, standId } = params;

    const rows = await OrderModel.aggregate([
        {
            $match: {
                eventId,
                ...(standId ? { standId } : {}),
                createdAt: { $gte: from, $lte: to },
                status: { $ne: 'cancelled' },
                isGift: { $ne: true },
                creditAmountUsed: { $gt: 0 }
            }
        },
        {
            $project: {
                standId: 1,
                /* `$sum` su un'espressione-array è la somma vera degli elementi. */
                itemsSubtotal: { $sum: '$items.subtotal' },
                lines: {
                    $map: {
                        input: '$items',
                        as: 'it',
                        in: {
                            epId: '$$it.eventProductId',
                            productName: '$$it.productName',
                            quantity: '$$it.quantity',
                            tokens: {
                                $multiply: [
                                    '$creditAmountUsed',
                                    {
                                        $cond: [
                                            { $gt: [{ $sum: '$items.subtotal' }, 0] },
                                            { $divide: ['$$it.subtotal', { $sum: '$items.subtotal' }] },
                                            0
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        },
        { $match: { itemsSubtotal: { $gt: 0 } } },
        { $unwind: '$lines' },
        {
            $group: {
                _id: { epId: '$lines.epId', standId: '$standId' },
                productName: { $first: '$lines.productName' },
                quantity: { $sum: '$lines.quantity' },
                tokens: { $sum: '$lines.tokens' }
            }
        },
        { $sort: { tokens: -1 } },
        { $limit: 100 }
    ]);

    const totalTokens = rows.reduce((sum, row) => sum + row.tokens, 0);

    const products: TokenSpentByProduct[] = rows.map((row) => ({
        eventProductId: row._id.epId.toString(),
        productName: row.productName,
        standId: row._id.standId.toString(),
        quantity: row.quantity,
        tokens: round2(row.tokens),
        share: totalTokens > 0 ? round3(row.tokens / totalTokens) : 0
    }));

    return { products, totalTokens: round2(totalTokens) };
}

export type TokenSpentByProduct = {
    eventProductId: string;
    productName: string;
    standId: string;
    quantity: number;
    tokens: number;
    share: number;
};