import { Schema, model, type InferSchemaType } from 'mongoose';

const cashRegisterMovementSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        currency: {
            type: String,
            enum: ['euro', 'credits'],
            required: true
        },
        direction: {
            type: String,
            enum: ['in', 'out'],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0.01
        },
        description: {
            type: String,
            trim: true,
            default: null,
            maxlength: 300
        },
        performedByUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
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

cashRegisterMovementSchema.index({ eventId: 1, occurredAt: -1 });

export type CashRegisterMovement = InferSchemaType<typeof cashRegisterMovementSchema>;

export const CashRegisterMovementModel = model('CashRegisterMovement', cashRegisterMovementSchema);
