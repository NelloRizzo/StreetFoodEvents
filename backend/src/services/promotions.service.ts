import mongoose, { Types } from 'mongoose';

import { EventProductModel } from '../models/event-product.model';
import { EventUserModel } from '../models/event-user.model';
import { ProductModel } from '../models/product.model';
import {
    PromotionModel,
    PromotionUsageModel,
    type Promotion,
    type PromotionType
} from '../models/promotion.model';

export function normalizePromotionCode(code: string): string {
    return code.trim().toUpperCase();
}

export class PromotionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PromotionError';
    }
}

export type PromotionValidationContext = {
    eventId: string | Types.ObjectId;
    standId?: string | Types.ObjectId | null;
    customerUserId?: string | Types.ObjectId | null;
    session?: mongoose.ClientSession;
};

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

export type PromotionValidationResult = {
    promotion: Promotion;
    type: Promotion['type'];
    // discount
    discountType?: 'percent' | 'fixed';
    discountValue?: number;
    // product
    eventProductId?: Types.ObjectId | null;
    productName?: string;
    formula?: { paid: number; total: number } | null;
    formulaMaxFree?: number | null;
    // value
    valueAmount?: number;
    remainingPresentations: number | null;
    remainingPerUser?: number | null;
};

export async function findActivePromotionByCode(
    code: string,
    eventId: string | Types.ObjectId,
    session?: mongoose.ClientSession
): Promise<Promotion | null> {
    return PromotionModel.findOne({ eventId, code: normalizePromotionCode(code) }).session(session ?? null);
}

export async function countPromotionUsagesByUser(
    promotionId: string | Types.ObjectId,
    eventUserId: string | Types.ObjectId,
    isValue: boolean,
    session?: mongoose.ClientSession
): Promise<number> {
    const filter: Record<string, unknown> = {
        promotionId: new Types.ObjectId(promotionId.toString()),
        eventUserId: new Types.ObjectId(eventUserId.toString())
    };
    if (isValue) {
        filter.type = 'value';
    } else {
        filter.type = { $ne: 'value' };
    }
    return PromotionUsageModel.countDocuments(filter).session(session ?? null);
}

export async function validatePromotion(
    promotion: Promotion,
    context: PromotionValidationContext
): Promise<PromotionValidationResult> {
    if (!promotion.isActive) {
        throw new PromotionError('Il coupon non è attivo');
    }

    if (promotion.expiresAt && promotion.expiresAt.getTime() < Date.now()) {
        throw new PromotionError('Il coupon è scaduto');
    }

    if (promotion.maxPresentations != null && promotion.usedCount >= promotion.maxPresentations) {
        throw new PromotionError('Il coupon ha esaurito le presentazioni disponibili');
    }

    const eventId = context.eventId.toString();

    if (promotion.eventId.toString() !== eventId) {
        throw new PromotionError('Il coupon non è valido per questo evento');
    }

    if (promotion.standId && context.standId && promotion.standId.toString() !== context.standId.toString()) {
        throw new PromotionError('Il coupon non è valido per questo stand');
    }

    const result: PromotionValidationResult = {
        promotion,
        type: promotion.type,
        remainingPresentations:
            promotion.maxPresentations != null
                ? Math.max(0, promotion.maxPresentations - promotion.usedCount)
                : null
    };

    if (promotion.type === 'discount') {
        result.discountType = promotion.discountType ?? 'percent';
        result.discountValue = promotion.discountValue ?? 0;
    }

    if (promotion.type === 'product') {
        result.eventProductId = promotion.eventProductId ?? null;

        if (promotion.eventProductId) {
            const ep = await EventProductModel.findById(promotion.eventProductId)
                .select('productId eventId')
                .session(context.session ?? null)
                .lean();
            if (!ep || ep.eventId.toString() !== eventId) {
                throw new PromotionError('Il prodotto del coupon non appartiene a questo evento');
            }
            const product = await ProductModel.findById(ep.productId)
                .select('name')
                .session(context.session ?? null)
                .lean();
            result.productName = product?.name ?? 'Prodotto';
        }

        result.formula = promotion.formula ?? null;
        result.formulaMaxFree = promotion.formulaMaxFree ?? null;
    }

    if (promotion.type === 'value') {
        result.valueAmount = promotion.valueAmount ?? 0;
    }

    if (promotion.perUserLimit != null && context.customerUserId) {
        const eventUser = await EventUserModel.findOne({
            eventId,
            userId: context.customerUserId
        }).session(context.session ?? null);

        if (eventUser) {
            const userUsages = await countPromotionUsagesByUser(
                promotion._id.toString(),
                eventUser._id,
                promotion.type === 'value',
                context.session
            );
            result.remainingPerUser = Math.max(0, promotion.perUserLimit - userUsages);

            if (promotion.perUserLimit - userUsages <= 0) {
                throw new PromotionError('Il cliente ha già utilizzato questo coupon');
            }
        }
    }

    return result;
}

export type OrderLineForPromotion = {
    eventProductId: Types.ObjectId;
    quantity: number;
    unitPrice: number;
    subtotal: number;
};

export type PromotionComputation = {
    discountAmount: number;
    freeUnits: number;
};

/**
 * Calcola lo sconto del coupon sul totale e, per i coupon dedicati a un
 * prodotto, riduce direttamente il subtotal delle righe coinvolte.
 *
 * - discount: percentuale sul totale o importo fisso (cappato al totale).
 * - product: pezzi gratuiti; con formula (es. 2x1, 3x2) ogni gruppo pieno
 *   applica la formula e il resto si paga intero; `formulaMaxFree` cappa i
 *   pezzi gratuiti per presentazione.
 */
export function computePromotionDiscount(
    promotion: Promotion,
    lines: OrderLineForPromotion[]
): PromotionComputation {
    if (promotion.type === 'discount') {
        const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
        const discountType = promotion.discountType ?? 'percent';
        const raw =
            discountType === 'percent'
                ? (total * (promotion.discountValue ?? 0)) / 100
                : promotion.discountValue ?? 0;

        return { discountAmount: round2(Math.min(raw, total)), freeUnits: 0 };
    }

    if (promotion.type === 'product' && promotion.eventProductId) {
        const targetId = promotion.eventProductId.toString();
        const matching = lines.filter((line) => line.eventProductId.toString() === targetId);

        if (matching.length === 0) {
            throw new PromotionError('Questo coupon richiede l\'acquisto del prodotto dedicato');
        }

        let totalFree = 0;
        let discount = 0;
        let remainingCap = promotion.formulaMaxFree ?? Number.POSITIVE_INFINITY;

        for (const line of matching) {
            const qty = line.quantity;

            let freeUnits: number;
            if (promotion.formula) {
                const groups = Math.floor(qty / promotion.formula.total);
                freeUnits = groups * (promotion.formula.total - promotion.formula.paid);
            } else {
                freeUnits = qty;
            }

            if (freeUnits >= remainingCap) {
                freeUnits = remainingCap;
            }
            if (remainingCap !== Number.POSITIVE_INFINITY) {
                remainingCap -= freeUnits;
            }

            freeUnits = Math.max(0, Math.min(freeUnits, qty));
            const freeDiscount = round2(line.unitPrice * freeUnits);

            totalFree += freeUnits;
            discount += freeDiscount;
            line.subtotal = round2(line.unitPrice * (qty - freeUnits));
        }

        return { discountAmount: discount, freeUnits: totalFree };
    }

    throw new PromotionError('Coupon di tipo non applicabile a un ordine');
}

/**
 * Consuma il coupon registrando un utilizzo (ordine o riscatto valore).
 * La presentazione NON viene restituita se l'ordine viene annullato.
 */
export async function consumePromotion(
    promotionId: string | Types.ObjectId,
    session: mongoose.ClientSession
) {
    const id = new Types.ObjectId(promotionId.toString());

    const result = await PromotionModel.updateOne(
        {
            _id: id,
            $expr: {
                $or: [
                    { $eq: [{ $ifNull: ['$maxPresentations', null] }, null] },
                    { $gt: ['$maxPresentations', '$usedCount'] }
                ]
            }
        },
        { $inc: { usedCount: 1 } }
    ).session(session);

    return result.modifiedCount === 1;
}

export function promotionTypeLabel(type: PromotionType): string {
    switch (type) {
        case 'discount':
            return 'Sconto';
        case 'product':
            return 'Prodotto gratis';
        case 'value':
            return 'Buono valore';
        default:
            return type;
    }
}

export function formulaLabel(formula: { paid: number; total: number } | null | undefined): string {
    if (!formula) {
        return 'regalo semplice';
    }
    return `${formula.total}x${formula.paid}`;
}