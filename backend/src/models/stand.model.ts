import { Schema, model, type InferSchemaType } from 'mongoose';

import { imageSchema } from './schemas/image.schema';

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
