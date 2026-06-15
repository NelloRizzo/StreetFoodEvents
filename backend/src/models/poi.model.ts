import { Schema, model, type InferSchemaType } from 'mongoose';

import { imageSchema } from './schemas/image.schema';

const locationSchema = new Schema(
    {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    { _id: false }
);

const poiSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        description: {
            type: String,
            trim: true,
            default: null
        },
        location: {
            type: locationSchema,
            required: true
        },
        iconType: {
            type: String,
            enum: ['toilet', 'info', 'entrance', 'parking', 'stage', 'food', 'drink', 'other'],
            default: null
        },
        iconImage: {
            type: imageSchema,
            default: null
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

poiSchema.index({ eventId: 1 });

export type POI = InferSchemaType<typeof poiSchema>;

export const POIModel = model('POI', poiSchema);
