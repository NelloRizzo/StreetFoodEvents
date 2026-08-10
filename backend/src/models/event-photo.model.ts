import { Schema, model, type InferSchemaType } from 'mongoose';

import { imageSchema } from './schemas/image.schema';

export const videoSchema = new Schema(
    {
        url: {
            type: String,
            required: true,
            trim: true
        },
        publicId: {
            type: String,
            required: true,
            trim: true
        },
        width: {
            type: Number,
            default: 0
        },
        height: {
            type: Number,
            default: 0
        },
        format: {
            type: String,
            required: true,
            trim: true
        },
        bytes: {
            type: Number,
            required: true,
            min: 1
        },
        duration: {
            type: Number,
            default: 0
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

const eventPhotoSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        type: {
            type: String,
            enum: ['image', 'video'],
            default: 'image'
        },
        image: {
            type: imageSchema,
            default: null
        },
        video: {
            type: videoSchema,
            default: null
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
