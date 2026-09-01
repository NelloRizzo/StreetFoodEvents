import { Schema, model, type InferSchemaType } from 'mongoose';

import { imageSchema } from './schemas/image.schema';

/** EU Regulation 1169/2011 — 14 major allergens */
export const ALLERGEN_VALUES = [
    'gluten',
    'crustaceans',
    'eggs',
    'fish',
    'peanuts',
    'soy',
    'milk',
    'tree-nuts',
    'celery',
    'mustard',
    'sesame',
    'sulphites',
    'lupins',
    'molluscs',
] as const;

export type Allergen = (typeof ALLERGEN_VALUES)[number];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
    gluten: 'Glutine (grano, segale, orzo, avena…)',
    crustaceans: 'Crostacei',
    eggs: 'Uova',
    fish: 'Pesce',
    peanuts: 'Arachidi',
    soy: 'Soia',
    milk: 'Latte (incluso lattosio)',
    'tree-nuts': 'Frutta a guscio (mandorle, nocciole, noci…)',
    celery: 'Sedano',
    mustard: 'Senape',
    sesame: 'Sesamo',
    sulphites: 'Anidride solforosa e solfiti (> 10 mg/kg)',
    lupins: 'Lupini',
    molluscs: 'Molluschi',
};

const productSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },
        description: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: null
        },
        ingredients: {
            type: [String],
            default: []
        },
        allergens: {
            type: [{ type: String, enum: ALLERGEN_VALUES }],
            default: []
        },
        isFrozen: {
            type: Boolean,
            default: false
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
