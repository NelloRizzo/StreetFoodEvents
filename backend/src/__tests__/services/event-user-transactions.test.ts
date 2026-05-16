import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import { EventUserModel } from '../../models/event-user.model';
import { createTestEvent, createTestUser } from '../helpers/factory';
import { createEventUserTransaction, EventUserTransactionError } from '../../services/event-user-transactions.service';
import { EventModel } from '../../models/event.model';
import { UserModel } from '../../models/user.model';

describe('EventUserTransactions service', () => {
    it('creates a debit transaction and reduces balance', async () => {
        const user = await UserModel.create(createTestUser());
        const event = await EventModel.create(createTestEvent());
        const eventUser = await EventUserModel.create({
            eventId: event._id,
            userId: user._id,
            balance: 100,
            isActive: true
        });

        const result = await createEventUserTransaction({
            eventUserId: eventUser._id,
            type: 'purchase',
            direction: 'debit',
            amount: 30,
            performedByUserId: user._id
        });

        expect(result.transaction.amount).toBe(30);
        expect(result.transaction.direction).toBe('debit');
        expect(result.transaction.balanceAfter).toBe(70);
        expect(result.eventUser.balance).toBe(70);
    });

    it('creates a credit transaction and increases balance', async () => {
        const user = await UserModel.create(createTestUser());
        const event = await EventModel.create(createTestEvent());
        const eventUser = await EventUserModel.create({
            eventId: event._id,
            userId: user._id,
            balance: 50,
            isActive: true
        });

        const result = await createEventUserTransaction({
            eventUserId: eventUser._id,
            type: 'top-up',
            direction: 'credit',
            amount: 25,
            performedByUserId: user._id
        });

        expect(result.transaction.balanceAfter).toBe(75);
        expect(result.eventUser.balance).toBe(75);
    });

    it('throws when debit exceeds balance', async () => {
        const user = await UserModel.create(createTestUser());
        const event = await EventModel.create(createTestEvent());
        const eventUser = await EventUserModel.create({
            eventId: event._id,
            userId: user._id,
            balance: 10,
            isActive: true
        });

        await expect(
            createEventUserTransaction({
                eventUserId: eventUser._id,
                type: 'purchase',
                direction: 'debit',
                amount: 20,
                performedByUserId: user._id
            })
        ).rejects.toThrow(EventUserTransactionError);
    });

    it('throws when event user not found', async () => {
        await expect(
            createEventUserTransaction({
                eventUserId: new mongoose.Types.ObjectId(),
                type: 'purchase',
                direction: 'debit',
                amount: 10,
                performedByUserId: new mongoose.Types.ObjectId().toString()
            })
        ).rejects.toThrow('Event user not found');
    });

    it('throws when amount is zero or negative', async () => {
        await expect(
            createEventUserTransaction({
                eventUserId: new mongoose.Types.ObjectId(),
                type: 'purchase',
                direction: 'debit',
                amount: 0,
                performedByUserId: new mongoose.Types.ObjectId().toString()
            })
        ).rejects.toThrow(EventUserTransactionError);
    });

    it('throws when event user is inactive', async () => {
        const user = await UserModel.create(createTestUser());
        const event = await EventModel.create(createTestEvent());
        const eventUser = await EventUserModel.create({
            eventId: event._id,
            userId: user._id,
            balance: 100,
            isActive: false
        });

        await expect(
            createEventUserTransaction({
                eventUserId: eventUser._id,
                type: 'purchase',
                direction: 'debit',
                amount: 10,
                performedByUserId: user._id
            })
        ).rejects.toThrow('Event user is not active');
    });

    it('uses provided session when one is passed', async () => {
        const user = await UserModel.create(createTestUser());
        const event = await EventModel.create(createTestEvent());
        const eventUser = await EventUserModel.create({
            eventId: event._id,
            userId: user._id,
            balance: 100,
            isActive: true
        });

        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const result = await createEventUserTransaction({
                eventUserId: eventUser._id,
                type: 'adjustment',
                direction: 'debit',
                amount: 15,
                performedByUserId: user._id,
                session
            });

            expect(result.eventUser.balance).toBe(85);
            await session.abortTransaction();
        } finally {
            await session.endSession();
        }

        const refreshed = await EventUserModel.findById(eventUser._id);
        expect(refreshed!.balance).toBe(100);
    });
});
