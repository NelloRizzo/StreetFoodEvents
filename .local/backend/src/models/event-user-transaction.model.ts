import { Schema, model, type InferSchemaType } from 'mongoose';

export const transactionTypeValues = [
    'top-up',
    'purchase',
    'refund',
    'adjustment',
    'transfer-in',
    'transfer-out'
] as const;

export const transactionDirectionValues = ['credit', 'debit'] as const;

const eventUserTransactionSchema = new Schema(
    {
        eventUserId: {
            type: Schema.Types.ObjectId,
            ref: 'EventUser',
            required: true,
            index: true
        },
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true
        },
        type: {
            type: String,
            enum: transactionTypeValues,
            required: true,
            index: true
        },
        direction: {
            type: String,
            enum: transactionDirectionValues,
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 1
        },
        realAmount: {
            type: Number,
            default: null,
            min: 0
        },
        balanceAfter: {
            type: Number,
            required: true,
            min: 0
        },
        description: {
            type: String,
            trim: true,
            default: null,
            maxlength: 500
        },
        performedByUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true
        },
        referenceType: {
            type: String,
            trim: true,
            default: null,
            maxlength: 80
        },
        referenceId: {
            type: Schema.Types.ObjectId,
            default: null,
            index: true
        },
        occurredAt: {
            type: Date,
            required: true,
            default: Date.now,
            index: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

eventUserTransactionSchema.index({ eventUserId: 1, occurredAt: -1 });
eventUserTransactionSchema.index({ eventId: 1, userId: 1, occurredAt: -1 });

export type EventUserTransaction = InferSchemaType<typeof eventUserTransactionSchema>;
export type EventUserTransactionType = (typeof transactionTypeValues)[number];
export type EventUserTransactionDirection = (typeof transactionDirectionValues)[number];

export const EventUserTransactionModel = model(
    'EventUserTransaction',
    eventUserTransactionSchema
);