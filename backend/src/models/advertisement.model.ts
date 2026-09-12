import { Schema, model, type InferSchemaType } from 'mongoose';
import { imageSchema } from './schemas/image.schema';

const advertisementSchema = new Schema(
    {
        name: {
            type: String,
            trim: true,
            maxlength: 160,
            default: null
        },
        image: {
            type: imageSchema,
            required: true
        },
        enabled: {
            type: Boolean,
            default: true
        },
        weight: {
            type: Number,
            min: 1,
            default: 1
        },
        appearances: {
            type: Number,
            min: 0,
            default: 0
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

export type Advertisement = InferSchemaType<typeof advertisementSchema>;
export const AdvertisementModel = model('Advertisement', advertisementSchema);