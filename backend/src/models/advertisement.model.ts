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
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

export type Advertisement = InferSchemaType<typeof advertisementSchema>;
export const AdvertisementModel = model('Advertisement', advertisementSchema);