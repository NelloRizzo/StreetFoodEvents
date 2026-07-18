import { Schema, model, type InferSchemaType } from 'mongoose';

const eventUserSchema = new Schema(
    {
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
        balance: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        notes: {
            type: String,
            trim: true,
            default: null,
            maxlength: 500
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

eventUserSchema.index({ eventId: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });

export type EventUser = InferSchemaType<typeof eventUserSchema>;

export const EventUserModel = model('EventUser', eventUserSchema);