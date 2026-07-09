import { Schema, model, type InferSchemaType } from 'mongoose';

import { imageSchema } from './schemas/image.schema';

const eventPhotoSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        image: {
            type: imageSchema,
            required: true
        },
        sequenceNumber: {
            type: Number,
            required: true
        },
        takenAt: {
            type: Date,
            required: true,
            default: Date.now
        },
        frameId: {
            type: Schema.Types.ObjectId,
            ref: 'Frame',
            default: null
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

eventPhotoSchema.index({ eventId: 1, sequenceNumber: -1 });

export type EventPhoto = InferSchemaType<typeof eventPhotoSchema>;

export const EventPhotoModel = model('EventPhoto', eventPhotoSchema);
