import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import { EventModel } from '../../models/event.model';
import { OrderModel } from '../../models/order.model';
import { StandModel } from '../../models/stand.model';
import { UserModel } from '../../models/user.model';
import { createTestEvent, createTestStand, createTestUser } from '../helpers/factory';

describe('Order model', () => {
    it('rejects creation with empty items', async () => {
        const user = await UserModel.create(createTestUser());
        const event = await EventModel.create(createTestEvent());
        const stand = await StandModel.create(createTestStand());

        await expect(
            OrderModel.create({
                eventId: event._id,
                standId: stand._id,
                orderNumber: 1,
                userId: user._id,
                items: [],
                total: 0,
                creditAmountUsed: 0
            })
        ).rejects.toThrow();
    });

    it('creates an order with items', async () => {
        const user = await UserModel.create(createTestUser());
        const event = await EventModel.create(createTestEvent());
        const stand = await StandModel.create(createTestStand());

        const order = await OrderModel.create({
            eventId: event._id,
            standId: stand._id,
            orderNumber: 1,
            userId: user._id,
            items: [
                {
                    eventProductId: new Types.ObjectId(),
                    productId: new Types.ObjectId(),
                    productName: 'Test Product',
                    stationId: new Types.ObjectId(),
                    stationName: 'Test Station',
                    quantity: 2,
                    unitPrice: 10,
                    subtotal: 20,
                    ready: false
                }
            ],
            total: 20,
            creditAmountUsed: 0,
            paymentStatus: 'unpaid',
            status: 'pending'
        });

        expect(order.orderNumber).toBe(1);
        expect(order.items).toHaveLength(1);
        expect(order.items[0]!.productName).toBe('Test Product');
        expect(order.items[0]!.subtotal).toBe(20);
        expect(order.status).toBe('pending');
        expect(order.paymentStatus).toBe('unpaid');
    });

    it('defaults status to pending', async () => {
        const user = await UserModel.create(createTestUser());
        const event = await EventModel.create(createTestEvent());
        const stand = await StandModel.create(createTestStand());

        const order = await OrderModel.create({
            eventId: event._id,
            standId: stand._id,
            orderNumber: 1,
            userId: user._id,
            items: [
                {
                    eventProductId: new Types.ObjectId(),
                    productId: new Types.ObjectId(),
                    productName: 'P',
                    stationId: new Types.ObjectId(),
                    stationName: 'S',
                    quantity: 1,
                    unitPrice: 5,
                    subtotal: 5,
                    ready: false
                }
            ],
            total: 5,
            creditAmountUsed: 0
        });

        expect(order.status).toBe('pending');
    });
});
