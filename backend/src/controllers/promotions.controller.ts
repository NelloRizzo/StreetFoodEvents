import type { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import * as qrcode from 'qrcode';

import { EventModel } from '../models/event.model';
import { EventProductModel } from '../models/event-product.model';
import { EventUserModel } from '../models/event-user.model';
import { RoleModel } from '../models/role.model';
import { StandModel } from '../models/stand.model';
import { UserRoleModel } from '../models/user-role.model';
import {
    PromotionModel,
    PromotionUsageModel,
    type Promotion
} from '../models/promotion.model';
import { createEventUserTransaction } from '../services/event-user-transactions.service';
import {
    consumePromotion,
    findActivePromotionByCode,
    normalizePromotionCode,
    PromotionError,
    promotionTypeLabel,
    validatePromotion as validatePromotionRules
} from '../services/promotions.service';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function toPromotionResponse(p: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    standId?: Types.ObjectId | null;
    code: string;
    title?: string | null;
    type: Promotion['type'];
    discountType?: string | null;
    discountValue?: number | null;
    eventProductId?: Types.ObjectId | null;
    formula?: { paid: number; total: number } | null;
    formulaMaxFree?: number | null;
    valueAmount?: number | null;
    maxPresentations?: number | null;
    perUserLimit?: number | null;
    usedCount: number;
    expiresAt?: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}) {
    const remainingPresentations =
        p.maxPresentations != null ? Math.max(0, p.maxPresentations - p.usedCount) : null;

    return {
        id: p._id.toString(),
        eventId: p.eventId.toString(),
        standId: p.standId?.toString() ?? null,
        code: p.code,
        title: p.title ?? null,
        type: p.type,
        typeLabel: promotionTypeLabel(p.type),
        discountType: p.discountType ?? null,
        discountValue: p.discountValue ?? null,
        eventProductId: p.eventProductId?.toString() ?? null,
        formula: p.formula ?? null,
        formulaMaxFree: p.formulaMaxFree ?? null,
        valueAmount: p.valueAmount ?? null,
        maxPresentations: p.maxPresentations ?? null,
        perUserLimit: p.perUserLimit ?? null,
        usedCount: p.usedCount,
        remainingPresentations,
        expiresAt: p.expiresAt ?? null,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
    };
}

function toUsageResponse(u: {
    _id: Types.ObjectId;
    promotionId: Types.ObjectId;
    code: string;
    eventId: Types.ObjectId;
    orderId?: Types.ObjectId | null;
    eventUserId?: Types.ObjectId | null;
    type: string;
    discountAmount: number;
    freeUnits: number;
    valueAmount: number;
    appliedBy?: Types.ObjectId | null;
    createdAt: Date;
}) {
    return {
        id: u._id.toString(),
        promotionId: u.promotionId.toString(),
        code: u.code,
        eventId: u.eventId.toString(),
        orderId: u.orderId?.toString() ?? null,
        eventUserId: u.eventUserId?.toString() ?? null,
        type: u.type,
        discountAmount: u.discountAmount,
        freeUnits: u.freeUnits,
        valueAmount: u.valueAmount,
        appliedBy: u.appliedBy?.toString() ?? null,
        createdAt: u.createdAt
    };
}

async function getEventFromParam(req: Request, res: Response) {
    const eventId = req.params.eventId;
    if (!isValidObjectId(eventId)) {
        res.status(400).json({ message: 'Invalid eventId' });
        return null;
    }
    const event = await EventModel.findById(eventId);
    if (!event) {
        res.status(404).json({ message: 'Event not found' });
        return null;
    }
    return { event, eventId };
}

async function getPromotionFromParam(req: Request, res: Response) {
    const promotionId = req.params.promotionId;
    if (!isValidObjectId(promotionId)) {
        res.status(400).json({ message: 'Invalid promotionId' });
        return null;
    }
    const promotion = await PromotionModel.findById(promotionId);
    if (!promotion) {
        res.status(404).json({ message: 'Promotion not found' });
        return null;
    }
    return promotion;
}

export async function listPromotions(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const items = await PromotionModel.find({ eventId: eventCtx.eventId }).sort({ createdAt: -1 });

    const qrs = await Promise.all(
        items.map(async (p) => ({
            item: p,
            qrCode: await qrcode.toDataURL(p.code, {
                width: 400,
                margin: 2,
                color: { dark: '#264137', light: '#ffffff' }
            })
        }))
    );

    return res.status(200).json({
        items: qrs.map(({ item, qrCode }) => ({
            ...toPromotionResponse(item),
            qrCode
        }))
    });
}

export async function getPromotion(req: Request, res: Response) {
    const promotion = await getPromotionFromParam(req, res);
    if (!promotion) return;

    const qrCode = await qrcode.toDataURL(promotion.code, {
        width: 400,
        margin: 2,
        color: { dark: '#264137', light: '#ffffff' }
    });

    return res.status(200).json({
        item: { ...toPromotionResponse(promotion), qrCode }
    });
}

async function buildPromotionData(req: Request, eventId: Types.ObjectId) {
    const { code, title, type, standId, discountType, discountValue, eventProductId } = req.body;
    const formula = req.body.formula ?? null;
    const formulaMaxFree =
        req.body.formulaMaxFree != null && req.body.formulaMaxFree !== '' ? Number(req.body.formulaMaxFree) : null;
    const valueAmount =
        req.body.valueAmount != null && req.body.valueAmount !== '' ? Number(req.body.valueAmount) : null;
    const maxPresentations =
        req.body.maxPresentations != null && req.body.maxPresentations !== '' ? Number(req.body.maxPresentations) : null;
    const perUserLimit =
        req.body.perUserLimit != null && req.body.perUserLimit !== '' ? Number(req.body.perUserLimit) : null;
    const expiresAt = req.body.expiresAt ?? null;

    if (!code || typeof code !== 'string') {
        throw new PromotionError('Il codice del coupon è obbligatorio');
    }
    if (!type || !['discount', 'product', 'value'].includes(type)) {
        throw new PromotionError('Tipo coupon non valido');
    }

    const data: Record<string, unknown> = {
        eventId,
        code: normalizePromotionCode(code),
        title: title ?? null,
        type,
        isActive: true
    };

    if (standId) {
        if (!isValidObjectId(standId)) {
            throw new PromotionError('standId non valido');
        }
        const stand = await StandModel.findById(standId).select('eventIds');
        if (!stand || !stand.eventIds.some((id) => id.toString() === eventId.toString())) {
            throw new PromotionError('Lo stand non appartiene a questo evento');
        }
        data.standId = new Types.ObjectId(standId);
    } else {
        data.standId = null;
    }

    if (type === 'discount') {
        const dt = discountType ?? 'percent';
        if (!['percent', 'fixed'].includes(dt)) {
            throw new PromotionError('discountType non valido');
        }
        const dv = Number(discountValue);
        if (!Number.isFinite(dv) || dv <= 0) {
            throw new PromotionError('Valore sconto non valido');
        }
        data.discountType = dt;
        data.discountValue = dt === 'percent' ? Math.min(dv, 100) : dv;
        data.eventProductId = null;
        data.formula = null;
        data.formulaMaxFree = null;
        data.valueAmount = null;
    }

    if (type === 'product') {
        if (!isValidObjectId(eventProductId)) {
            throw new PromotionError('È richiesto un prodotto del menu');
        }
        const ep = await EventProductModel.findById(eventProductId).select('eventId standId');
        if (!ep || ep.eventId.toString() !== eventId.toString()) {
            throw new PromotionError('Il prodotto non appartiene a questo evento');
        }
        if (data.standId && ep.standId.toString() !== data.standId.toString()) {
            throw new PromotionError('Il prodotto non appartiene allo stand selezionato');
        }
        data.eventProductId = new Types.ObjectId(eventProductId);
        data.formula = null;
        data.discountType = null;
        data.discountValue = null;
        data.valueAmount = null;

        if (formula) {
            const paid = Number(formula.paid);
            const total = Number(formula.total);
            if (!Number.isFinite(paid) || !Number.isFinite(total) || paid < 1 || total <= paid) {
                throw new PromotionError('Formula non valida (es. 2x1, 3x2)');
            }
            data.formula = { paid, total };
        }

        if (formulaMaxFree != null) {
            if (!Number.isFinite(formulaMaxFree) || formulaMaxFree < 1) {
                throw new PromotionError('Il numero massimo di pezzi gratuiti non è valido');
            }
            data.formulaMaxFree = formulaMaxFree;
        } else {
            data.formulaMaxFree = null;
        }
    }

    if (type === 'value') {
        const va = Number(valueAmount);
        if (!Number.isFinite(va) || va <= 0) {
            throw new PromotionError('Importo del buono non valido');
        }
        data.valueAmount = round2(va);
        data.eventProductId = null;
        data.formula = null;
        data.formulaMaxFree = null;
        data.discountType = null;
        data.discountValue = null;
    }

    if (maxPresentations != null) {
        if (!Number.isFinite(maxPresentations) || maxPresentations < 1) {
            throw new PromotionError('Numero massimo di presentazioni non valido');
        }
        data.maxPresentations = maxPresentations;
    } else {
        data.maxPresentations = null;
    }

    if (perUserLimit != null) {
        if (!Number.isFinite(perUserLimit) || perUserLimit < 1) {
            throw new PromotionError('Limite per cliente non valido');
        }
        data.perUserLimit = perUserLimit;
    } else {
        data.perUserLimit = null;
    }

    data.expiresAt = expiresAt ? new Date(expiresAt) : null;

    return data;
}

export async function createPromotion(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    try {
        const data = await buildPromotionData(req, new Types.ObjectId(eventCtx.eventId));
        data.createdBy = new Types.ObjectId(req.user.id);

        const created = await PromotionModel.create(data);

        const qrCode = await qrcode.toDataURL(created.code, {
            width: 400,
            margin: 2,
            color: { dark: '#264137', light: '#ffffff' }
        });

        return res.status(201).json({
            item: { ...toPromotionResponse(created), qrCode }
        });
    } catch (error) {
        if (error instanceof PromotionError) {
            return res.status(400).json({ message: error.message });
        }
        if ((error as { code?: number }).code === 11000) {
            return res.status(400).json({ message: 'Esiste già un coupon con questo codice' });
        }
        throw error;
    }
}

export async function updatePromotion(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;
    const promotion = await getPromotionFromParam(req, res);
    if (!promotion) return;

    if (promotion.eventId.toString() !== eventCtx.eventId) {
        return res.status(404).json({ message: 'Promotion not found' });
    }

    try {
        const data = await buildPromotionData(req, promotion.eventId);
        if (typeof req.body.isActive === 'boolean') {
            data.isActive = req.body.isActive;
        }

        promotion.set(data);
        await promotion.save();

        return res.status(200).json({
            item: toPromotionResponse(promotion)
        });
    } catch (error) {
        if (error instanceof PromotionError) {
            return res.status(400).json({ message: error.message });
        }
        if ((error as { code?: number }).code === 11000) {
            return res.status(400).json({ message: 'Esiste già un coupon con questo codice' });
        }
        throw error;
    }
}

export async function deletePromotion(req: Request, res: Response) {
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;
    const promotion = await getPromotionFromParam(req, res);
    if (!promotion) return;

    if (promotion.eventId.toString() !== eventCtx.eventId) {
        return res.status(404).json({ message: 'Promotion not found' });
    }

    if (promotion.usedCount > 0) {
        return res.status(400).json({
            message: 'Il coupon è già stato utilizzato: disattivalo invece di eliminarlo per conservare lo storico'
        });
    }

    await promotion.deleteOne();

    return res.status(200).json({ message: 'Promotion deleted' });
}

export async function getPromotionQrCode(req: Request, res: Response) {
    const promotion = await getPromotionFromParam(req, res);
    if (!promotion) return;

    const qrCode = await qrcode.toDataURL(promotion.code, {
        width: 400,
        margin: 2,
        color: { dark: '#264137', light: '#ffffff' }
    });

    return res.status(200).json({
        item: {
            id: promotion._id.toString(),
            code: promotion.code,
            qrCode
        }
    });
}

export async function getPromotionUsage(req: Request, res: Response) {
    const promotion = await getPromotionFromParam(req, res);
    if (!promotion) return;

    const usages = await PromotionUsageModel.find({ promotionId: promotion._id })
        .sort({ createdAt: -1 })
        .limit(200);

    return res.status(200).json({
        items: usages.map((u) => toUsageResponse(u))
    });
}

export async function validatePromotion(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { code, standId, customerId } = req.body;

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: 'Il codice del coupon è obbligatorio' });
    }

    const promotion = await findActivePromotionByCode(code, eventCtx.eventId);
    if (!promotion) {
        return res.status(404).json({ message: 'Coupon non trovato per questo evento' });
    }

    try {
        const valid = await validatePromotionRules(promotion, {
            eventId: eventCtx.eventId,
            standId,
            customerUserId: customerId
        });

        return res.status(200).json({
            valid: true,
            item: {
                id: promotion._id.toString(),
                code: promotion.code,
                type: valid.type,
                typeLabel: promotionTypeLabel(valid.type),
                title: promotion.title,
                discountType: valid.discountType ?? null,
                discountValue: valid.discountValue ?? null,
                eventProductId: valid.eventProductId?.toString() ?? null,
                productName: valid.productName ?? null,
                formula: valid.formula ?? null,
                formulaMaxFree: valid.formulaMaxFree ?? null,
                valueAmount: valid.valueAmount ?? null,
                remainingPresentations: valid.remainingPresentations,
                remainingPerUser: valid.remainingPerUser ?? null,
                expiresAt: promotion.expiresAt ?? null
            }
        });
    } catch (error) {
        if (error instanceof PromotionError) {
            return res.status(200).json({ valid: false, message: error.message });
        }
        throw error;
    }
}

async function canHandleCashierOperations(userId: string, eventId: string): Promise<boolean> {
    const userObjectId = new Types.ObjectId(userId);

    const platformAdminRole = await RoleModel.findOne({ slug: 'platform-admin', scope: 'platform' });
    const isPlatformAdmin = platformAdminRole
        ? !!(await UserRoleModel.findOne({ userId: userObjectId, roleId: platformAdminRole._id, isActive: true }))
        : false;
    if (isPlatformAdmin) {
        return true;
    }

    const eventRoles = await RoleModel.find({ scope: 'event', slug: { $in: ['event-admin', 'event-cashier', 'exchange-admin'] } });
    const eventRoleIds = eventRoles.map((r) => r._id);
    const hasEventRole = eventRoleIds.length > 0
        ? !!(await UserRoleModel.findOne({
            userId: userObjectId,
            roleId: { $in: eventRoleIds },
            eventId: new Types.ObjectId(eventId),
            isActive: true
        }))
        : false;
    if (hasEventRole) {
        return true;
    }

    const standRole = await UserRoleModel.findOne({
        userId: userObjectId,
        standId: { $ne: null },
        isActive: true
    }).select('standId');

    if (!standRole?.standId) {
        return false;
    }

    const stand = await StandModel.findById(standRole.standId).select('eventIds');
    return !!stand && stand.eventIds.some((id) => id.toString() === eventId);
}

export async function redeemValue(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    const eventCtx = await getEventFromParam(req, res);
    if (!eventCtx) return;

    const { code, eventUserId } = req.body;

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: 'Il codice del coupon è obbligatorio' });
    }

    if (!isValidObjectId(eventUserId)) {
        return res.status(400).json({ message: 'eventUserId non valido' });
    }

    const eventUser = await EventUserModel.findOne({
        _id: new Types.ObjectId(eventUserId),
        eventId: eventCtx.eventId,
        isActive: true
    });
    if (!eventUser) {
        return res.status(404).json({ message: 'Cliente non trovato per questo evento' });
    }

    if (!(await canHandleCashierOperations(req.user.id, eventCtx.eventId))) {
        return res.status(403).json({ message: 'Non hai i permessi per riscattare buoni valore' });
    }

    const promotion = await findActivePromotionByCode(code, eventCtx.eventId);
    if (!promotion) {
        return res.status(404).json({ message: 'Coupon non trovato per questo evento' });
    }

    if (promotion.type !== 'value') {
        return res.status(400).json({ message: 'Questo coupon non è un buono valore' });
    }

    if (promotion.valueAmount == null || promotion.valueAmount <= 0) {
        return res.status(400).json({ message: 'Buono senza importo configurato' });
    }

    const txnSession = await mongoose.startSession();

    try {
        txnSession.startTransaction();

        await validatePromotionRules(promotion, {
            eventId: eventCtx.eventId,
            customerUserId: eventUser.userId ?? null,
            session: txnSession
        });

        const consumed = await consumePromotion(promotion._id.toString(), txnSession);
        if (!consumed) {
            throw new PromotionError('Il coupon ha esaurito le presentazioni disponibili');
        }

        const exchangeRate = eventCtx.event.exchangeRate ?? 1;
        const amount = promotion.valueAmount;
        const txnResult = await createEventUserTransaction({
            eventUserId: eventUser._id,
            type: 'promotion',
            direction: 'credit',
            amount,
            realAmount: round2(amount / exchangeRate),
            description: `Buono valore coupon ${promotion.code}`,
            performedByUserId: req.user.id,
            referenceType: 'promotion',
            referenceId: promotion._id.toString(),
            session: txnSession
        });

        await PromotionUsageModel.create(
            [
                {
                    promotionId: promotion._id,
                    code: promotion.code,
                    eventId: eventCtx.eventId,
                    eventUserId: eventUser._id,
                    type: 'value',
                    valueAmount: amount,
                    appliedBy: req.user.id
                }
            ],
            { session: txnSession }
        );

        await txnSession.commitTransaction();

        return res.status(200).json({
            item: {
                promotionId: promotion._id.toString(),
                code: promotion.code,
                valueAmount: amount,
                eventUserId: eventUser._id.toString(),
                balance: txnResult.eventUser.balance,
                transactionId: txnResult.transaction._id.toString()
            }
        });
    } catch (error) {
        await txnSession.abortTransaction();

        if (error instanceof PromotionError || error instanceof Error) {
            return res.status(400).json({ message: error.message });
        }

        throw error;
    } finally {
        await txnSession.endSession();
    }
}