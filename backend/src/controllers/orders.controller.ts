import type { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import * as qrcode from 'qrcode';

import { CounterModel } from '../models/counter.model';
import { EventProductModel } from '../models/event-product.model';
import { EventUserModel } from '../models/event-user.model';
import { OrderModel } from '../models/order.model';
import { StationModel } from '../models/station.model';
import { UserStationModel } from '../models/user-station.model';
import { createEventUserTransaction, EventUserTransactionError } from '../services/event-user-transactions.service';
import { EventModel } from '../models/event.model';
import { StandModel } from '../models/stand.model';
import { RoleModel } from '../models/role.model';
import { UserRoleModel } from '../models/user-role.model';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toOrderResponse(order: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    standId: Types.ObjectId;
    orderNumber: number;
    userId: Types.ObjectId;
    customerId?: Types.ObjectId | null;
    customerName?: string | null;
    status: string;
    items: Array<{
        eventProductId: Types.ObjectId;
        productId: Types.ObjectId;
        productName: string;
        stationId: Types.ObjectId;
        stationName: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
        ready: boolean;
        notes?: string | null;
    }>;
    total: number;
    creditAmountUsed: number;
    paymentStatus: string;
    paidAt?: Date | null;
    paymentTransactionId?: Types.ObjectId | null;
    performedByUserId?: Types.ObjectId | null;
    notes?: string | null;
    cancelledAt?: Date | null;
    cancelReason?: string | null;
    createdAt: Date;
    updatedAt: Date;
}, receiptQrCode?: string | null) {
    return {
        id: order._id.toString(),
        eventId: order.eventId.toString(),
        standId: order.standId.toString(),
        orderNumber: order.orderNumber,
        userId: order.userId.toString(),
        customerId: order.customerId?.toString() ?? null,
        customerName: order.customerName ?? null,
        status: order.status,
        items: order.items.map((item) => ({
            eventProductId: item.eventProductId.toString(),
            productId: item.productId.toString(),
            productName: item.productName,
            stationId: item.stationId.toString(),
            stationName: item.stationName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            ready: item.ready,
            notes: item.notes ?? null
        })),
        total: order.total,
        creditAmountUsed: order.creditAmountUsed,
        paymentStatus: order.paymentStatus,
        paidAt: order.paidAt ?? null,
        paymentTransactionId: order.paymentTransactionId?.toString() ?? null,
        performedByUserId: order.performedByUserId?.toString() ?? null,
        notes: order.notes ?? null,
        cancelledAt: order.cancelledAt ?? null,
        cancelReason: order.cancelReason ?? null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        receiptQrCode: receiptQrCode ?? null
    };
}

export async function listOrders(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const filter: Record<string, unknown> = {};

    if (req.query.eventId) filter.eventId = req.query.eventId;
    if (req.query.standId) filter.standId = req.query.standId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.customerId) filter.customerId = req.query.customerId;
    if (req.query.stationId && Types.ObjectId.isValid(req.query.stationId as string)) {
        filter['items.stationId'] = new Types.ObjectId(req.query.stationId as string);
    }

    if (req.query.startDate) {
        filter.createdAt = { $gte: new Date(req.query.startDate as string) };
    }

    if (req.query.endDate) {
        const end = new Date(req.query.endDate as string);
        end.setHours(23, 59, 59, 999);
        filter.createdAt = { ...((filter.createdAt as object) || {}), $lte: end };
    }

    const items = await OrderModel.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
        items: items.map((o) => toOrderResponse(o))
    });
}

export async function listMyStationOrders(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const userStations = await UserStationModel.find({
        userId: req.user.id,
        isActive: true
    });

    if (userStations.length === 0) {
        return res.status(200).json({ items: [] });
    }

    const stationIds = userStations.map((us) => us.stationId);

    const filter: Record<string, unknown> = {};

    if (req.query.eventId) filter.eventId = req.query.eventId;
    if (req.query.standId) filter.standId = req.query.standId;
    if (req.query.status) filter.status = req.query.status;

    filter['items.stationId'] = { $in: stationIds };

    const items = await OrderModel.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
        items: items.map((o) => toOrderResponse(o))
    });
}

export async function getOrderById(req: Request, res: Response) {
    const orderId = req.params.orderId;

    if (!isValidObjectId(orderId)) {
        return res.status(400).json({ message: 'Invalid order id' });
    }

    const order = await OrderModel.findById(orderId);

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    return res.status(200).json({
        item: toOrderResponse(order)
    });
}

async function getNextOrderNumber(standId: string): Promise<number> {
    const counter = await CounterModel.findOneAndUpdate(
        { standId: new Types.ObjectId(standId) },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
    );
    return counter.seq;
}

export async function getOrderReceipt(req: Request, res: Response) {
    const orderId = req.params.orderId;

    if (!isValidObjectId(orderId)) {
        return res.status(400).json({ message: 'Invalid order id' });
    }

    const order = await OrderModel.findById(orderId).lean();

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    const [event, stand] = await Promise.all([
        EventModel.findById(order.eventId).select('name').lean(),
        StandModel.findById(order.standId).select('name').lean(),
    ]);

    if (!event || !stand) {
        return res.status(404).json({ message: 'Event or stand not found' });
    }

    const origin = req.headers.origin ?? `${req.protocol}://${req.headers.host}`;
    const receiptUrl = `${origin}/receipt/${order._id.toString()}`;

    const receiptQrCode = await qrcode.toDataURL(receiptUrl, {
        width: 400,
        margin: 2,
        color: {
            dark: '#264137',
            light: '#ffffff',
        },
    });

    return res.status(200).json({
        item: {
            id: order._id.toString(),
            orderNumber: order.orderNumber,
            status: order.status,
            eventName: event.name,
            standName: stand.name,
            standId: order.standId.toString(),
            items: order.items.map((item) => ({
                productName: item.productName,
                quantity: item.quantity,
                subtotal: item.subtotal,
            })),
            total: order.total,
            creditAmountUsed: order.creditAmountUsed,
            receiptQrCode,
            createdAt: order.createdAt,
        },
    });
}

export async function getOrderReceiptQrCode(req: Request, res: Response) {
    const orderId = req.params.orderId;

    if (!isValidObjectId(orderId)) {
        return res.status(400).json({ message: 'Invalid order id' });
    }

    const order = await OrderModel.findById(orderId).lean();

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    const origin = req.headers.origin ?? `${req.protocol}://${req.headers.host}`;
    const receiptUrl = `${origin}/receipt/${order._id.toString()}`;

    const qrDataUrl = await qrcode.toDataURL(receiptUrl, {
        width: 400,
        margin: 2,
        color: {
            dark: '#264137',
            light: '#ffffff',
        },
    });

    return res.status(200).json({ qrCode: qrDataUrl });
}

export async function createOrder(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const { eventId, standId, customerId, customerName, items, paymentOnCreate, notes } = req.body;

    if (!eventId || !isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid or missing eventId' });
    }

    if (!standId || !isValidObjectId(standId)) {
        return res.status(400).json({ message: 'Invalid or missing standId' });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'At least one item is required' });
    }

    const event = await EventModel.findById(eventId);
    if (!event) {
        return res.status(404).json({ message: 'Event not found' });
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const orderItems = [];
        let total = 0;

        for (const item of items) {
            const { eventProductId, stationId, quantity, notes: itemNotes } = item;

            if (!isValidObjectId(eventProductId)) {
                throw new Error(`Invalid eventProductId: ${eventProductId}`);
            }

            if (!isValidObjectId(stationId)) {
                throw new Error(`Invalid stationId: ${stationId}`);
            }

            if (!Number.isFinite(quantity) || quantity < 1) {
                throw new Error(`Invalid quantity: ${quantity}`);
            }

            const ep = await EventProductModel.findById(eventProductId).session(session);

            if (!ep) {
                throw new Error(`EventProduct not found: ${eventProductId}`);
            }

            if (ep.eventId.toString() !== eventId || ep.standId.toString() !== standId) {
                throw new Error('EventProduct does not match the event and stand');
            }

            if (!ep.stationIds.some((sId) => sId.toString() === stationId)) {
                throw new Error('Station is not associated with this product');
            }

            const product = await mongoose.model('Product').findById(ep.productId).session(session);

            if (!product) {
                throw new Error(`Product not found: ${ep.productId}`);
            }

            const station = await StationModel.findById(stationId).session(session);

            if (!station) {
                throw new Error(`Station not found: ${stationId}`);
            }

            const unitPrice = ep.priceOverride ?? product.price;
            const subtotal = unitPrice * quantity;
            total += subtotal;

            orderItems.push({
                eventProductId: ep._id,
                productId: ep.productId,
                productName: product.name,
                stationId: new Types.ObjectId(stationId),
                stationName: station.name,
                quantity,
                unitPrice,
                subtotal,
                ready: false,
                notes: itemNotes ?? null
            });
        }

        const effectiveCustomerId = customerId ?? req.user.id;
        const effectiveCustomerName = customerName ?? null;

        let creditAmount = 0;
        let paymentTransactionId: Types.ObjectId | null = null;

        if (paymentOnCreate) {
            if (typeof paymentOnCreate === 'object' && paymentOnCreate !== null) {
                creditAmount = Math.max(0, Math.min(Number(paymentOnCreate.creditAmount) || 0, total));
            } else {
                creditAmount = total;
            }

            if (!event.cashPaymentsEnabled && creditAmount < total) {
                throw new Error('Cash payments are disabled for this event. Payment must be in full using event credits.');
            }

            if (creditAmount > 0) {
                const eventUser = await EventUserModel.findOne({
                    eventId,
                    userId: effectiveCustomerId
                }).session(session);

                if (!eventUser) {
                    throw new Error('User is not linked to this event');
                }

                if (!eventUser.isActive) {
                    throw new Error('User is not active for this event');
                }

                if (eventUser.balance < creditAmount) {
                    throw new Error('Insufficient event currency balance');
                }

                const txnResult = await createEventUserTransaction({
                    eventUserId: eventUser._id,
                    type: 'purchase',
                    direction: 'debit',
                    amount: creditAmount,
                    description: `Ordine #${orderItems.length} articoli presso lo stand`,
                    performedByUserId: req.user.id,
                    session
                });

                paymentTransactionId = txnResult.transaction._id as Types.ObjectId;
            }
        }

        const orderNumber = await getNextOrderNumber(standId);

        const created = await OrderModel.create(
            [
                {
                    eventId,
                    standId,
                    orderNumber,
                    userId: req.user.id,
                    customerId: effectiveCustomerId,
                    customerName: effectiveCustomerName,
                    status: paymentOnCreate ? 'confirmed' : 'pending',
                    items: orderItems,
                    total,
                    creditAmountUsed: creditAmount,
                    paymentStatus: paymentOnCreate ? 'paid' : 'unpaid',
                    paidAt: paymentOnCreate ? new Date() : null,
                    paymentTransactionId,
                    performedByUserId: paymentOnCreate ? req.user.id : null,
                    notes: notes ?? null,
                    cancelledAt: null,
                    cancelReason: null
                }
            ],
            { session }
        );

        const order = created[0];

        if (!order) {
            throw new Error('Failed to create order');
        }

        await session.commitTransaction();

        let qrDataUrl: string | null = null;
        try {
            const origin = req.headers.origin ?? `${req.protocol}://${req.headers.host}`;
            const receiptUrl = `${origin}/receipt/${order._id.toString()}`;
            qrDataUrl = await qrcode.toDataURL(receiptUrl, {
                width: 400,
                margin: 2,
                color: { dark: '#264137', light: '#ffffff' },
            });
        } catch { /* QR generation is optional */ }

        return res.status(201).json({
            item: toOrderResponse(order, qrDataUrl)
        });
    } catch (error) {
        await session.abortTransaction();

        if (error instanceof Error) {
            return res.status(400).json({ message: error.message });
        }

        throw error;
    } finally {
        await session.endSession();
    }
}

export async function updateOrderStatus(req: Request, res: Response) {
    const orderId = req.params.orderId;

    if (!isValidObjectId(orderId)) {
        return res.status(400).json({ message: 'Invalid order id' });
    }

    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ message: 'Status is required' });
    }

    const validTransitions: Record<string, string[]> = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['preparing', 'cancelled'],
        preparing: ['ready'],
        ready: ['completed'],
        completed: [],
        cancelled: []
    };

    const order = await OrderModel.findById(orderId);

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    const allowed = validTransitions[order.status];

    if (!allowed || !allowed.includes(status)) {
        return res.status(400).json({
            message: `Cannot transition from ${order.status} to ${status}`
        });
    }

    // When cashier marks order as ready, all items become ready
    if (status === 'ready') {
        for (const item of order.items) {
            item.ready = true;
        }
    }

    order.status = status;

    if (status === 'cancelled') {
        order.cancelledAt = new Date();
        order.cancelReason = req.body.reason ?? null;
    }

    await order.save();

    return res.status(200).json({
        item: toOrderResponse(order)
    });
}

export async function cancelOrder(req: Request, res: Response) {
    const orderId = req.params.orderId;

    if (!isValidObjectId(orderId)) {
        return res.status(400).json({ message: 'Invalid order id' });
    }

    const { reason } = req.body;

    const order = await OrderModel.findById(orderId);

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'completed' || order.status === 'cancelled') {
        return res.status(400).json({
            message: `Cannot cancel an order with status ${order.status}`
        });
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        order.status = 'cancelled';
        order.cancelledAt = new Date();
        order.cancelReason = reason ?? null;

        if (order.paymentStatus === 'paid' && order.creditAmountUsed > 0) {
            const eventUser = await EventUserModel.findOne({
                eventId: order.eventId,
                userId: order.customerId ?? order.userId
            }).session(session);

            if (eventUser) {
                await createEventUserTransaction({
                    eventUserId: eventUser._id,
                    type: 'refund',
                    direction: 'credit',
                    amount: order.creditAmountUsed,
                    description: `Rimborso ordine annullato`,
                    performedByUserId: req.user?.id ?? null,
                    referenceType: 'order',
                    referenceId: order._id,
                    session
                });
            }

            order.paymentStatus = 'refunded';
        }

        await order.save({ session });
        await session.commitTransaction();

        return res.status(200).json({
            item: toOrderResponse(order)
        });
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
}

export async function payOrder(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const orderId = req.params.orderId;

    if (!isValidObjectId(orderId)) {
        return res.status(400).json({ message: 'Invalid order id' });
    }

    const order = await OrderModel.findById(orderId);

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    if (order.paymentStatus !== 'unpaid') {
        return res.status(400).json({
            message: `Order payment status is already ${order.paymentStatus}`
        });
    }

    const payEvent = await EventModel.findById(order.eventId);
    if (!payEvent) {
        return res.status(404).json({ message: 'Event not found' });
    }

    const creditAmount = Math.max(0, Math.min(
        req.body.creditAmount !== undefined ? Number(req.body.creditAmount) : order.total,
        order.total
    ));

    const useEventCredits = req.body.useEventCredits === true;

    if (useEventCredits) {
        const userId = new Types.ObjectId(req.user.id);
        // Verifica che l'utente abbia un ruolo che permette crediti amministrativi
        const platformAdminRole = await RoleModel.findOne({ slug: 'platform-admin', scope: 'platform' });
        const eventCashierRole = await RoleModel.findOne({ slug: 'event-cashier', scope: 'event' });

        const hasPlatformAdmin = platformAdminRole
            ? !!(await UserRoleModel.findOne({ userId, roleId: platformAdminRole._id, isActive: true }))
            : false;

        const hasEventCashier = eventCashierRole
            ? !!(await UserRoleModel.findOne({ userId, roleId: eventCashierRole._id, eventId: order.eventId, isActive: true }))
            : false;

        const hasStandRole = !!(await UserRoleModel.findOne({ userId, standId: order.standId, isActive: true }));

        if (!hasPlatformAdmin && !hasEventCashier && !hasStandRole) {
            return res.status(403).json({ message: 'You do not have permission to use event credits for this order' });
        }
    }

    if (!payEvent.cashPaymentsEnabled && creditAmount < order.total) {
        return res.status(400).json({ message: 'Cash payments are disabled for this event. Payment must be in full using event credits.' });
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        let paymentTransactionId: Types.ObjectId | null = order.paymentTransactionId ?? null;

        if (creditAmount > 0) {
            if (useEventCredits) {
                // Crediti evento/amministratore — nessun check saldo, nessuna transazione EventUser
                // I crediti vengono comunque registrati in creditAmountUsed per i report
            } else {
                const customerId = order.customerId ?? order.userId;

                const eventUser = await EventUserModel.findOne({
                    eventId: order.eventId,
                    userId: customerId
                }).session(session);

                if (!eventUser) {
                    throw new Error('User is not linked to this event');
                }

                if (!eventUser.isActive) {
                    throw new Error('User is not active for this event');
                }

                if (eventUser.balance < creditAmount) {
                    throw new Error('Insufficient event currency balance');
                }

                const txnResult = await createEventUserTransaction({
                    eventUserId: eventUser._id,
                    type: 'purchase',
                    direction: 'debit',
                    amount: creditAmount,
                    description: `Pagamento ordine`,
                    performedByUserId: req.user.id,
                    referenceType: 'order',
                    referenceId: order._id,
                    session
                });

                paymentTransactionId = txnResult.transaction._id as Types.ObjectId;
            }
        }

        order.paymentStatus = 'paid';
        order.paidAt = new Date();
        order.creditAmountUsed = creditAmount;
        order.paymentTransactionId = paymentTransactionId;
        order.performedByUserId = new Types.ObjectId(req.user.id);

        await order.save({ session });
        await session.commitTransaction();

        return res.status(200).json({
            item: toOrderResponse(order)
        });
    } catch (error) {
        await session.abortTransaction();

        if (error instanceof EventUserTransactionError || error instanceof Error) {
            return res.status(400).json({ message: error.message });
        }

        throw error;
    } finally {
        await session.endSession();
    }
}

export async function markStationReady(req: Request, res: Response) {
    const orderId = req.params.orderId;
    const { stationId } = req.body;

    if (!isValidObjectId(orderId)) {
        return res.status(400).json({ message: 'Invalid order id' });
    }

    if (!isValidObjectId(stationId)) {
        return res.status(400).json({ message: 'Invalid station id' });
    }

    const order = await OrderModel.findById(orderId);

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status !== 'preparing') {
        return res.status(400).json({
            message: `Cannot mark items ready when order status is ${order.status}`
        });
    }

    let anyUpdated = false;
    for (const item of order.items) {
        if (item.stationId.toString() === stationId && !item.ready) {
            item.ready = true;
            anyUpdated = true;
        }
    }

    if (!anyUpdated) {
        return res.status(400).json({ message: 'No items to mark ready for this station' });
    }

    const allReady = order.items.every((item) => item.ready);

    if (allReady) {
        order.status = 'ready';
    }

    await order.save();

    return res.status(200).json({
        item: toOrderResponse(order)
    });
}

export async function markItemReady(req: Request, res: Response) {
    const orderId = req.params.orderId;
    const { eventProductId } = req.body;

    if (!isValidObjectId(orderId)) {
        return res.status(400).json({ message: 'Invalid order id' });
    }

    if (!isValidObjectId(eventProductId)) {
        return res.status(400).json({ message: 'Invalid eventProductId' });
    }

    const order = await OrderModel.findById(orderId);

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'ready' || order.status === 'completed' || order.status === 'cancelled') {
        return res.status(400).json({
            message: `Cannot mark item ready when order status is ${order.status}`
        });
    }

    let found = false;
    for (const item of order.items) {
        if (item.eventProductId.toString() === eventProductId && !item.ready) {
            item.ready = true;
            found = true;
            break;
        }
    }

    if (!found) {
        return res.status(400).json({ message: 'Item not found or already ready' });
    }

    const allReady = order.items.every((item) => item.ready);

    if (allReady) {
        order.status = 'ready';
    }

    await order.save();

    return res.status(200).json({
        item: toOrderResponse(order)
    });
}

export async function cancelOrderItems(req: Request, res: Response) {
    const orderId = req.params.orderId;
    const { itemIds } = req.body;

    if (!isValidObjectId(orderId)) {
        return res.status(400).json({ message: 'Invalid order id' });
    }

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ message: 'itemIds array is required and must not be empty' });
    }

    for (const id of itemIds) {
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: `Invalid item id: ${id}` });
        }
    }

    const order = await OrderModel.findById(orderId);

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'completed' || order.status === 'cancelled') {
        return res.status(400).json({
            message: `Cannot cancel items from an order with status ${order.status}`
        });
    }

    const itemIdSet = new Set(itemIds.map((id: string) => id.toString()));
    const removedItems = order.items.filter((item) => itemIdSet.has(item.eventProductId.toString()));

    if (removedItems.length === 0) {
        return res.status(400).json({ message: 'No matching items found to cancel' });
    }

    const remainingItems = order.items.filter((item) => !itemIdSet.has(item.eventProductId.toString()));

    if (remainingItems.length === 0) {
        return res.status(400).json({ message: 'Cannot cancel all items. Use cancelOrder to cancel the entire order.' });
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        order.items.splice(0, order.items.length, ...remainingItems);
        order.total = remainingItems.reduce((sum, item) => sum + item.subtotal, 0);

        if (order.paymentStatus === 'paid' && order.creditAmountUsed > order.total) {
            const excessCredits = order.creditAmountUsed - order.total;

            const eventUser = await EventUserModel.findOne({
                eventId: order.eventId,
                userId: order.customerId ?? order.userId
            }).session(session);

            if (eventUser) {
                await createEventUserTransaction({
                    eventUserId: eventUser._id,
                    type: 'refund',
                    direction: 'credit',
                    amount: excessCredits,
                    description: `Rimborso per annullamento parziale ordine #${order.orderNumber}`,
                    performedByUserId: req.user?.id ?? null,
                    referenceType: 'order',
                    referenceId: order._id,
                    session
                });
            }

            order.creditAmountUsed = order.total;
        }

        const allReady = order.items.every((item) => item.ready);

        if (allReady && order.status !== 'ready') {
            order.status = 'ready';
        }

        await order.save({ session });
        await session.commitTransaction();

        return res.status(200).json({
            item: toOrderResponse(order)
        });
    } catch (error) {
        await session.abortTransaction();

        if (error instanceof Error) {
            return res.status(400).json({ message: error.message });
        }

        throw error;
    } finally {
        await session.endSession();
    }
}

export async function deleteEventOrders(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const userId = req.user!.id;

    const platformAdminRole = await RoleModel.findOne({ slug: 'platform-admin', scope: 'platform' });
    if (!platformAdminRole) {
        return res.status(500).json({ message: 'Platform admin role not found' });
    }

    const userRole = await UserRoleModel.findOne({
        userId: new Types.ObjectId(userId),
        roleId: platformAdminRole._id,
        isActive: true
    });

    if (!userRole) {
        return res.status(403).json({ message: 'Only platform administrators can delete event orders' });
    }

    const eventObjectId = new Types.ObjectId(eventId);

    const deleteResult = await OrderModel.deleteMany({ eventId: eventObjectId });

    const stands = await StandModel.find({ eventIds: eventObjectId }).select('_id');
    const standIds = stands.map((s) => s._id);

    if (standIds.length > 0) {
        await CounterModel.deleteMany({ standId: { $in: standIds } });
    }

    return res.status(200).json({
        message: `Deleted ${deleteResult.deletedCount} orders and reset counters for ${standIds.length} stands`
    });
}

export async function resetOrderCounter(req: Request, res: Response) {
    const { standId } = req.body;

    if (!isValidObjectId(standId)) {
        return res.status(400).json({ message: 'Invalid stand id' });
    }

    await CounterModel.findOneAndUpdate(
        { standId: new Types.ObjectId(standId) },
        { $set: { seq: 0 } },
        { upsert: true }
    );

    return res.status(200).json({ message: 'Counter reset to 0' });
}

export async function getEventReport(req: Request, res: Response) {
    const eventId = req.params.eventId;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const userId = new Types.ObjectId(req.user!.id);

    const platformAdminRole = await RoleModel.findOne({ slug: 'platform-admin', scope: 'platform' });
    const eventAdminRole = await RoleModel.findOne({ slug: 'event-admin', scope: 'event' });
    const eventCashierRole = await RoleModel.findOne({ slug: 'event-cashier', scope: 'event' });

    const isPlatformAdmin = platformAdminRole
        ? !!(await UserRoleModel.findOne({ userId, roleId: platformAdminRole._id, isActive: true }))
        : false;

    const hasEventRole = (eventAdminRole || eventCashierRole)
        ? !!(await UserRoleModel.findOne({
            userId,
            roleId: { $in: [eventAdminRole?._id, eventCashierRole?._id].filter(Boolean) },
            eventId: new Types.ObjectId(eventId),
            isActive: true
        }))
        : false;

    if (!isPlatformAdmin && !hasEventRole) {
        return res.status(403).json({ message: 'Access denied. Requires event-admin or event-cashier role.' });
    }

    const event = await EventModel.findById(eventId).select('name unifiedCashierEnabled cashPaymentsEnabled currencyName currencySymbol');
    if (!event) {
        return res.status(404).json({ message: 'Event not found' });
    }

    const standIds = (await StandModel.find({ eventIds: new Types.ObjectId(eventId) }).select('_id name').lean());
    const standMap = new Map(standIds.map((s) => [s._id.toString(), s.name]));

    const matchFilter: Record<string, unknown> = { eventId: new Types.ObjectId(eventId) };

    if (req.query.startDate) {
        matchFilter.createdAt = { $gte: new Date(req.query.startDate as string) };
    }

    if (req.query.endDate) {
        const end = new Date(req.query.endDate as string);
        end.setHours(23, 59, 59, 999);
        matchFilter.createdAt = { ...((matchFilter.createdAt as object) || {}), $lte: end };
    }

    const aggregation = await OrderModel.aggregate([
        { $match: matchFilter },
        {
            $group: {
                _id: '$standId',
                totalOrders: { $sum: 1 },
                paidOrders: {
                    $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
                },
                totalRevenue: {
                    $sum: {
                        $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0]
                    }
                },
                creditRevenue: {
                    $sum: {
                        $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$creditAmountUsed', 0]
                    }
                },
                pendingOrders: {
                    $sum: {
                        $cond: [
                            { $and: [{ $ne: ['$paymentStatus', 'paid'] }, { $ne: ['$status', 'completed'] }, { $ne: ['$status', 'cancelled'] }] },
                            1,
                            0
                        ]
                    }
                },
                pendingAmount: {
                    $sum: {
                        $cond: [
                            { $and: [{ $ne: ['$paymentStatus', 'paid'] }, { $ne: ['$status', 'completed'] }, { $ne: ['$status', 'cancelled'] }] },
                            '$total',
                            0
                        ]
                    }
                },
                refundedAmount: {
                    $sum: {
                        $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$total', 0]
                    }
                },
                cashPaymentOrders: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $lt: ['$creditAmountUsed', '$total'] }] },
                            1,
                            0
                        ]
                    }
                },
                creditPaymentOrders: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $eq: ['$creditAmountUsed', '$total'] }] },
                            1,
                            0
                        ]
                    }
                },
                mixedPaymentOrders: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $gt: ['$creditAmountUsed', 0] }, { $lt: ['$creditAmountUsed', '$total'] }] },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const stands = aggregation.map((row) => ({
        standId: row._id.toString(),
        standName: standMap.get(row._id.toString()) ?? 'Stand sconosciuto',
        totalOrders: row.totalOrders,
        paidOrders: row.paidOrders,
        totalRevenue: row.totalRevenue,
        cashRevenue: row.totalRevenue - row.creditRevenue,
        creditRevenue: row.creditRevenue,
        pendingOrders: row.pendingOrders,
        pendingAmount: row.pendingAmount,
        refundedAmount: row.refundedAmount,
        paymentMethods: {
            cash: row.cashPaymentOrders,
            credits: row.creditPaymentOrders,
            mixed: row.mixedPaymentOrders
        }
    }));

    const totals = stands.reduce((acc, s) => ({
        totalOrders: acc.totalOrders + s.totalOrders,
        paidOrders: acc.paidOrders + s.paidOrders,
        totalRevenue: acc.totalRevenue + s.totalRevenue,
        cashRevenue: acc.cashRevenue + s.cashRevenue,
        creditRevenue: acc.creditRevenue + s.creditRevenue,
        pendingOrders: acc.pendingOrders + s.pendingOrders,
        pendingAmount: acc.pendingAmount + s.pendingAmount,
        refundedAmount: acc.refundedAmount + s.refundedAmount
    }), {
        totalOrders: 0,
        paidOrders: 0,
        totalRevenue: 0,
        cashRevenue: 0,
        creditRevenue: 0,
        pendingOrders: 0,
        pendingAmount: 0,
        refundedAmount: 0
    });

    return res.status(200).json({
        eventId,
        eventName: event.name,
        unifiedCashierEnabled: event.unifiedCashierEnabled,
        cashPaymentsEnabled: event.cashPaymentsEnabled,
        currencyName: event.currencyName,
        stands,
        totals
    });
}

export async function getStandReport(req: Request, res: Response) {
    const standId = req.params.standId;

    if (!isValidObjectId(standId)) {
        return res.status(400).json({ message: 'Invalid stand id' });
    }

    const eventId = req.query.eventId as string | undefined;
    const stationId = req.query.stationId as string | undefined;

    const matchFilter: Record<string, unknown> = { standId: new Types.ObjectId(standId) };

    if (eventId && isValidObjectId(eventId)) {
        matchFilter.eventId = new Types.ObjectId(eventId);
    }

    if (stationId && isValidObjectId(stationId)) {
        matchFilter['items.stationId'] = new Types.ObjectId(stationId);
    }

    if (req.query.startDate) {
        matchFilter.createdAt = { $gte: new Date(req.query.startDate as string) };
    }

    if (req.query.endDate) {
        const end = new Date(req.query.endDate as string);
        end.setHours(23, 59, 59, 999);
        matchFilter.createdAt = { ...((matchFilter.createdAt as object) || {}), $lte: end };
    }

    const [summary] = await OrderModel.aggregate([
        { $match: matchFilter },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: {
                    $sum: {
                        $cond: [
                            { $eq: ['$paymentStatus', 'paid'] },
                            '$total',
                            0
                        ]
                    }
                },
                totalCreditRevenue: {
                    $sum: {
                        $cond: [
                            { $eq: ['$paymentStatus', 'paid'] },
                            '$creditAmountUsed',
                            0
                        ]
                    }
                },
                totalRefunded: {
                    $sum: {
                        $cond: [
                            { $eq: ['$paymentStatus', 'refunded'] },
                            '$total',
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const statusBreakdown = await OrderModel.aggregate([
        { $match: matchFilter },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const orders = await OrderModel.find(matchFilter)
        .sort({ createdAt: -1 })
        .limit(200);

    const pendingOrders = await OrderModel.find({
        ...matchFilter,
        paymentStatus: { $ne: 'paid' },
        status: { $ne: 'completed' }
    })
        .sort({ createdAt: -1 })
        .limit(50);

    return res.status(200).json({
        standId,
        eventId: eventId ?? null,
        summary: {
            totalOrders: summary?.totalOrders ?? 0,
            totalRevenue: summary?.totalRevenue ?? 0,
            totalCreditRevenue: summary?.totalCreditRevenue ?? 0,
            cashRevenue: (summary?.totalRevenue ?? 0) - (summary?.totalCreditRevenue ?? 0),
            totalExternalRevenue: (summary?.totalRevenue ?? 0) - (summary?.totalCreditRevenue ?? 0),
            totalRefunded: summary?.totalRefunded ?? 0
        },
        statusBreakdown: statusBreakdown.map((s) => ({
            status: s._id,
            count: s.count
        })),
        orders: orders.map((o) => toOrderResponse(o)),
        pendingOrders: pendingOrders.map((o) => toOrderResponse(o))
    });
}
