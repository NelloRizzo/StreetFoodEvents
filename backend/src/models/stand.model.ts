import { Schema, model, type InferSchemaType } from 'mongoose';

import { imageSchema } from './schemas/image.schema';

const pointSchema = new Schema(
    {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: null
        }
    },
    { _id: false }
);

const eventLocationSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true
        },
        location: {
            type: pointSchema,
            default: null
        }
    },
    { _id: false }
);

const standSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        slogan: {
            type: String,
            trim: true,
            default: null,
            maxlength: 280
        },
        description: {
            type: String,
            trim: true,
            default: null
        },
        eventIds: {
            type: [{ type: Schema.Types.ObjectId, ref: 'Event' }],
            default: []
        },
        locations: {
            type: [eventLocationSchema],
            default: []
        },
        coverImage: {
            type: imageSchema,
            default: null
        },
        gallery: {
            type: [imageSchema],
            default: []
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

standSchema.index({ eventIds: 1 });
standSchema.index({ name: 1 });

export type Stand = InferSchemaType<typeof standSchema>;

export const StandModel = model('Stand', standSchema);
