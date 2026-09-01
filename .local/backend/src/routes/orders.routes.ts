import { Router, type Request, type Response } from 'express';
import mongoose, { Types } from 'mongoose';

import { CounterModel, EventProductModel, EventUserModel, OrderModel, StandModel, StationModel } from '../models';
import { createEventUserTransaction } from '../event-user-transactions.service';
import { registerSync } from '../sync.service';

export const ordersRouter = Router();

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

async function getNextOrderNumber(standId: string): Promise<number> {
    const counter = await CounterModel.findOneAndUpdate(
        { standId: new Types.ObjectId(standId) },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
    );
    return counter.seq;
}

function toOrderResponse(order: any) {
    return {
        id: order._id.toString(),
        eventId: order.eventId.toString(),
        standId: order.standId.toString(),
        orderNumber: order.orderNumber,
        userId: order.userId?.toString() ?? null,
        customerId: order.customerId?.toString() ?? null,
        customerName: order.customerName ?? null,
        status: order.status,
        isGift: order.isGift,
        items: order.items.map((item: any) => ({
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
        readyAt: order.readyAt ?? null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
    };
}

const LOCAL_USER_ID = new Types.ObjectId('000000000000000000000001');

export async function createOrder(req: Request, res: Response) {
    const { eventId, standId, customerId, customerName, items, paymentOnCreate, notes } = req.body;
    const isGift = req.body.isGift === true;

    if (!isValidObjectId(eventId)) return res.status(400).json({ message: 'Invalid or missing eventId' });
    if (!isValidObjectId(standId)) return res.status(400).json({ message: 'Invalid or missing standId' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const orderItems = [];
        let total = 0;

        for (const item of items) {
            const { eventProductId, stationId, quantity, notes: itemNotes } = item;
            if (!isValidObjectId(eventProductId)) throw new Error(`Invalid eventProductId: ${eventProductId}`);
            if (!isValidObjectId(stationId)) throw new Error(`Invalid stationId: ${stationId}`);
            if (!Number.isFinite(quantity) || quantity < 1) throw new Error(`Invalid quantity: ${quantity}`);

            const ep = await EventProductModel.findById(eventProductId).session(session);
            if (!ep) throw new Error(`EventProduct not found: ${eventProductId}`);
            if (ep.eventId.toString() !== eventId || ep.standId.toString() !== standId) {
                throw new Error('EventProduct does not match the event and stand');
            }
            if (!ep.stationIds.some((sId: Types.ObjectId) => sId.toString() === stationId)) {
                throw new Error('Station is not associated with this product');
            }

            const product = await mongoose.model('Product').findById(ep.productId).session(session);
            if (!product) throw new Error(`Product not found: ${ep.productId}`);

            const station = await StationModel.findById(stationId).session(session);
            if (!station) throw new Error(`Station not found: ${stationId}`);

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

        const effectiveCustomerId = customerId ?? LOCAL_USER_ID;
        const effectiveCustomerName = customerName ?? null;

        let creditAmount = 0;
        let paymentTransactionId: Types.ObjectId | null = null;

        if (paymentOnCreate && !isGift) {
            if (typeof paymentOnCreate === 'object' && paymentOnCreate !== null) {
                creditAmount = Math.max(0, Math.min(Number(paymentOnCreate.creditAmount) || 0, total));
            } else {
                creditAmount = total;
            }

            if (creditAmount > 0) {
                const eventUser = await EventUserModel.findOne({ eventId, userId: effectiveCustomerId }).session(session);
                if (!eventUser) throw new Error('User is not linked to this event');
                if (!eventUser.isActive) throw new Error('User is not active for this event');
                if (eventUser.balance < creditAmount) throw new Error('Insufficient event currency balance');

                const txnResult = await createEventUserTransaction({
                    eventUserId: eventUser._id,
                    type: 'purchase',
                    direction: 'debit',
                    amount: creditAmount,
                    description: `Ordine #${orderItems.length} articoli presso lo stand`,
                    performedByUserId: LOCAL_USER_ID,
                    session
                });
                paymentTransactionId = txnResult.transaction._id as Types.ObjectId;
            }
        }

        const orderNumber = await getNextOrderNumber(standId);
        const isPaidOnCreate = Boolean(paymentOnCreate) || isGift;

        const created = await OrderModel.create(
            [
                {
                    eventId,
                    standId,
                    orderNumber,
                    userId: LOCAL_USER_ID,
                    customerId: effectiveCustomerId,
                    customerName: effectiveCustomerName,
                    status: isPaidOnCreate ? 'confirmed' : 'pending',
                    isGift,
                    items: orderItems,
                    total: isGift ? 0 : total,
                    creditAmountUsed: isGift ? 0 : creditAmount,
                    paymentStatus: isPaidOnCreate ? 'paid' : 'unpaid',
                    paidAt: isPaidOnCreate ? new Date() : null,
                    paymentTransactionId: isGift ? null : paymentTransactionId,
                    performedByUserId: isPaidOnCreate ? LOCAL_USER_ID : null,
                    notes: notes ?? null,
                    cancelledAt: null,
                    cancelReason: null
                }
            ],
            { session }
        );

        const order = created[0];
        if (!order) throw new Error('Failed to create order');

        registerSync('Order', order._id);

        await session.commitTransaction();

        return res.status(201).json({ item: toOrderResponse(order) });
    } catch (error) {
        await session.abortTransaction();
        if (error instanceof Error) return res.status(400).json({ message: error.message });
        throw error;
    } finally {
        await session.endSession();
    }
}

export async function listOrders(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};
    if (req.query.eventId) filter.eventId = req.query.eventId;
    if (req.query.standId) filter.standId = req.query.standId;
    if (req.query.status) {
        const statuses = (req.query.status as string).split(',').map((s) => s.trim()).filter(Boolean);
        filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
    const items = await OrderModel.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ items: items.map(toOrderResponse) });
}

export async function getOrderById(req: Request, res: Response) {
    const orderId = req.params.orderId;
    if (!isValidObjectId(orderId)) return res.status(400).json({ message: 'Invalid order id' });
    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.status(200).json({ item: toOrderResponse(order) });
}

export async function getStandDisplayOrders(req: Request, res: Response) {
    const standId = req.params.standId;
    if (!isValidObjectId(standId)) return res.status(400).json({ message: 'Invalid stand id' });

    const stand = await StandModel.findById(standId).select('name').lean();
    if (!stand) return res.status(404).json({ message: 'Stand not found' });

    const filter: Record<string, unknown> = {
        standId: new Types.ObjectId(standId),
        $or: [
            { status: { $in: ['confirmed', 'preparing'] } },
            { status: 'ready', readyAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) } }
        ]
    };
    if (req.query.eventId && isValidObjectId(req.query.eventId as string)) {
        filter.eventId = new Types.ObjectId(req.query.eventId as string);
    }

    const orders = await OrderModel.find(filter).sort({ createdAt: 1 }).limit(60);
    return res.status(200).json({
        standId: stand._id.toString(),
        standName: stand.name,
        items: orders.map((o: any) => ({
            id: o._id.toString(),
            orderNumber: o.orderNumber,
            status: o.status,
            isGift: o.isGift,
            items: o.items.map((item: any) => ({
                productName: item.productName,
                quantity: item.quantity,
                stationId: item.stationId.toString(),
                stationName: item.stationName,
                ready: item.ready
            }))
        }))
    });
}

export async function updateOrderStatus(req: Request, res: Response) {
    const orderId = req.params.orderId;
    if (!isValidObjectId(orderId)) return res.status(400).json({ message: 'Invalid order id' });
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'Status is required' });

    const validTransitions: Record<string, string[]> = {
        pending: ['confirmed', 'completed', 'cancelled'],
        confirmed: ['preparing', 'completed', 'cancelled'],
        preparing: ['ready'],
        ready: ['completed'],
        completed: [],
        cancelled: []
    };

    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const allowed = validTransitions[order.status];
    if (!allowed || !allowed.includes(status)) {
        return res.status(400).json({ message: `Cannot transition from ${order.status} to ${status}` });
    }

    if (status === 'ready') {
        for (const item of order.items) item.ready = true;
        order.readyAt = new Date();
    }
    if (status === 'completed') {
        for (const item of order.items) item.ready = true;
        if (order.paymentStatus === 'unpaid') {
            order.paymentStatus = 'paid';
            order.paidAt = new Date();
            order.performedByUserId = LOCAL_USER_ID as never;
        }
    }
    order.status = status;
    if (status === 'cancelled') {
        order.cancelledAt = new Date();
        order.cancelReason = req.body.reason ?? null;
    }
    await order.save();
    registerSync('Order', order._id);
    return res.status(200).json({ item: toOrderResponse(order) });
}

export async function cancelOrder(req: Request, res: Response) {
    const orderId = req.params.orderId;
    if (!isValidObjectId(orderId)) return res.status(400).json({ message: 'Invalid order id' });
    const { reason } = req.body;
    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'completed' || order.status === 'cancelled') {
        return res.status(400).json({ message: `Cannot cancel an order with status ${order.status}` });
    }

    const session = await mongoose.startSession();
    try {        session.startTransaction();
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
                    description: 'Rimborso ordine annullato',
                    performedByUserId: LOCAL_USER_ID,
                    referenceType: 'order',
                    referenceId: order._id,
                    session
                });
            }
            order.paymentStatus = 'refunded';
        }
        await order.save({ session });
        registerSync('Order', order._id);
        await session.commitTransaction();
        return res.status(200).json({ item: toOrderResponse(order) });
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
}

export async function markStationReady(req: Request, res: Response) {
    const orderId = req.params.orderId;
    const { stationId } = req.body;
    if (!isValidObjectId(orderId)) return res.status(400).json({ message: 'Invalid order id' });
    if (!isValidObjectId(stationId)) return res.status(400).json({ message: 'Invalid station id' });

    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'preparing') {
        return res.status(400).json({ message: `Cannot mark items ready when order status is ${order.status}` });
    }

    let anyUpdated = false;
    for (const item of order.items) {
        if (item.stationId.toString() === stationId && !item.ready) {
            item.ready = true;
            anyUpdated = true;
        }
    }
    if (!anyUpdated) return res.status(400).json({ message: 'No items to mark ready for this station' });

    const allReady = order.items.every((item: any) => item.ready);
    if (allReady) {
        order.status = 'ready';
        order.readyAt = new Date();
    }
    await order.save();
    registerSync('Order', order._id);
    return res.status(200).json({ item: toOrderResponse(order) });
}

export async function markItemReady(req: Request, res: Response) {
    const orderId = req.params.orderId;
    const { eventProductId } = req.body;
    if (!isValidObjectId(orderId)) return res.status(400).json({ message: 'Invalid order id' });
    if (!isValidObjectId(eventProductId)) return res.status(400).json({ message: 'Invalid eventProductId' });

    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'ready' || order.status === 'completed' || order.status === 'cancelled') {
        return res.status(400).json({ message: `Cannot mark item ready when order status is ${order.status}` });
    }

    let found = false;
    for (const item of order.items) {
        if (item.eventProductId.toString() === eventProductId && !item.ready) {
            item.ready = true;
            found = true;
            break;
        }
    }
    if (!found) return res.status(400).json({ message: 'Item not found or already ready' });

    const allReady = order.items.every((item: any) => item.ready);
    if (allReady) {
        order.status = 'ready';
        order.readyAt = new Date();
    }
    await order.save();
    registerSync('Order', order._id);
    return res.status(200).json({ item: toOrderResponse(order) });
}

ordersRouter.post('/', createOrder);
ordersRouter.get('/', listOrders);
ordersRouter.get('/stand/:standId/ordersqueue', getStandDisplayOrders);
ordersRouter.get('/:orderId', getOrderById);
ordersRouter.patch('/:orderId/status', updateOrderStatus);
ordersRouter.patch('/:orderId/mark-station-ready', markStationReady);
ordersRouter.patch('/:orderId/mark-item-ready', markItemReady);
ordersRouter.post('/:orderId/cancel', cancelOrder);
