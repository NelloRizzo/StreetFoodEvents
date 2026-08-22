import { Schema, model, type InferSchemaType } from 'mongoose';

const standSettlementSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        standId: {
            type: Schema.Types.ObjectId,
            ref: 'Stand',
            required: true,
            index: true
        },
        standName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        direction: {
            type: String,
            enum: ['debit', 'credit'],
            required: true,
            default: 'credit',
            index: true
        },
        unit: {
            type: String,
            enum: ['credits', 'euro'],
            required: true,
            default: 'credits'
        },
        amount: {
            type: Number,
            required: true,
            min: 0.01
        },
        denominations: {
            type: [{
                label: { type: String, required: true, trim: true, maxlength: 60 },
                value: { type: Number, required: true, min: 0.01 },
                count: { type: Number, required: true, min: 1 },
                euroAmount: { type: Number, required: true, min: 0 }
            }],
            default: []
        },
        exchangeRate: {
            type: Number,
            required: true,
            default: 1,
            min: 0.01
        },
        feePercent: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
            max: 100
        },
        grossEuro: {
            type: Number,
            required: true,
            min: 0
        },
        feeEuro: {
            type: Number,
            required: true,
            min: 0
        },
        payoutEuro: {
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

standSettlementSchema.index({ eventId: 1, occurredAt: -1 });
standSettlementSchema.index({ eventId: 1, standId: 1, occurredAt: -1 });

export type StandSettlement = InferSchemaType<typeof standSettlementSchema>;

export const StandSettlementModel = model('StandSettlement', standSettlementSchema);
