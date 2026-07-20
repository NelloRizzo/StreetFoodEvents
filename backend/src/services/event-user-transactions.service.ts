import mongoose, { type ClientSession, type Types } from 'mongoose';

import {
    EventUserTransactionModel,
    type EventUserTransactionDirection,
    type EventUserTransactionType
} from '../models/event-user-transaction.model';
import { EventUserModel } from '../models/event-user.model';

type CreateEventUserTransactionInput = {
    eventUserId: string | Types.ObjectId;
    type: EventUserTransactionType;
    direction: EventUserTransactionDirection;
    amount: number;
    realAmount?: number | null;
    description?: string | null;
    performedByUserId?: string | Types.ObjectId | null;
    referenceType?: string | null;
    referenceId?: string | Types.ObjectId | null;
    occurredAt?: Date;
    session?: ClientSession;
};

export class EventUserTransactionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EventUserTransactionError';
    }
}

export async function createEventUserTransaction(input: CreateEventUserTransactionInput) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
        throw new EventUserTransactionError('Transaction amount must be greater than 0');
    }

    const ownSession = !input.session;
    const session = input.session ?? (await mongoose.startSession());

    try {
        if (ownSession) {
            session.startTransaction();
        }

        const eventUser = await EventUserModel.findById(input.eventUserId).session(session);

        if (!eventUser) {
            throw new EventUserTransactionError('Event user not found');
        }

        if (!eventUser.isActive) {
            throw new EventUserTransactionError('Event user is not active');
        }

        const balanceChange = input.direction === 'credit' ? input.amount : -input.amount;
        const nextBalance = eventUser.balance + balanceChange;

        if (nextBalance < 0) {
            throw new EventUserTransactionError('Insufficient event currency balance');
        }

        eventUser.balance = nextBalance;
        await eventUser.save({ session });

        const transaction = new EventUserTransactionModel({
            eventUserId: eventUser._id,
            eventId: eventUser.eventId,
            userId: eventUser.userId,
            type: input.type,
            direction: input.direction,
            amount: input.amount,
            realAmount: input.realAmount ?? null,
            balanceAfter: nextBalance,
            description: input.description ?? null,
            performedByUserId: input.performedByUserId ?? null,
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            occurredAt: input.occurredAt ?? new Date()
        });

        await transaction.save({ session });

        if (ownSession) {
            await session.commitTransaction();
        }

        return {
            eventUser,
            transaction
        };
    } catch (error) {
        if (ownSession) {
            await session.abortTransaction();
        }

        throw error;
    } finally {
        if (ownSession) {
            await session.endSession();
        }
    }
}
