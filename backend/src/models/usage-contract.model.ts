import { Schema, model, type InferSchemaType } from 'mongoose';

const usageContractSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        maxStands: {
            type: Number,
            required: true,
            default: 1,
            min: 1
        },
        status: {
            type: String,
            enum: ['active', 'suspended', 'expired'],
            default: 'active',
            index: true
        },
        startsAt: {
            type: Date,
            default: null
        },
        endsAt: {
            type: Date,
            default: null
        },
        notes: {
            type: String,
            trim: true,
            default: null,
            maxlength: 500
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

usageContractSchema.index({ userId: 1, eventId: 1 }, { unique: true });

export type UsageContract = InferSchemaType<typeof usageContractSchema>;

export const UsageContractModel = model('UsageContract', usageContractSchema);
