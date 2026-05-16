import { Schema, model, type InferSchemaType } from 'mongoose';

import { imageSchema } from './schemas/image.schema';

const productSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },
        ingredients: {
            type: [String],
            default: []
        },
        price: {
            type: Number,
            required: true,
            min: 0
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

export type Product = InferSchemaType<typeof productSchema>;

export const ProductModel = model('Product', productSchema);
