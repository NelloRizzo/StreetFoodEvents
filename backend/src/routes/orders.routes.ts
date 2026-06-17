import { Router } from 'express';

import {
    cancelOrder,
    cancelOrderItems,
    createOrder,
    deleteEventOrders,
    getOrderById,
    getOrderReceipt,
    getOrderReceiptQrCode,
    getStandReport,
    listMyStationOrders,
    listOrders,
    markItemReady,
    markStationReady,
    payOrder,
    resetOrderCounter,
    updateOrderStatus
} from '../controllers/orders.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const ordersRouter = Router();

ordersRouter.get('/:orderId/receipt', asyncHandler(getOrderReceipt));

ordersRouter.use(asyncHandler(authMiddleware));

ordersRouter.get('/:orderId/receipt-qrcode', asyncHandler(getOrderReceiptQrCode));

ordersRouter.delete('/event/:eventId', asyncHandler(deleteEventOrders));
ordersRouter.get('/', asyncHandler(listOrders));
ordersRouter.get('/my-station', asyncHandler(listMyStationOrders));
ordersRouter.get('/report/stand/:standId', asyncHandler(getStandReport));
ordersRouter.post('/', asyncHandler(createOrder));
ordersRouter.get('/:orderId', asyncHandler(getOrderById));
ordersRouter.patch('/:orderId/status', asyncHandler(updateOrderStatus));
ordersRouter.post('/:orderId/cancel', asyncHandler(cancelOrder));
ordersRouter.patch('/:orderId/cancel-items', asyncHandler(cancelOrderItems));
ordersRouter.post('/:orderId/pay', asyncHandler(payOrder));
ordersRouter.patch('/:orderId/mark-station-ready', asyncHandler(markStationReady));
ordersRouter.patch('/:orderId/mark-item-ready', asyncHandler(markItemReady));
ordersRouter.post('/reset-counter', asyncHandler(resetOrderCounter));
