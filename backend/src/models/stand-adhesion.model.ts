import { Schema, model, type InferSchemaType } from 'mongoose';

import { ALLERGEN_VALUES } from './product.model';
import { imageSchema } from './schemas/image.schema';

export const ADHESION_STATUS_VALUES = ['draft', 'submitted', 'integration', 'approved', 'rejected'] as const;
export type AdhesionStatus = (typeof ADHESION_STATUS_VALUES)[number];

/**
 * Pratiche "plastic free" dichiarabili dallo stand (sezione facoltativa).
 * Ogni pratica ha un peso; il punteggio serve per agevolazioni o come criterio
 * di scelta tra stand che offrono lo stesso prodotto.
 */
export const PLASTIC_FREE_PRACTICES = [
    { key: 'compostable-plates', label: 'Piatti compostabili', weight: 2 },
    { key: 'compostable-cups', label: 'Bicchieri compostabili', weight: 2 },
    { key: 'waste-separation', label: 'Raccolta differenziata allo stand', weight: 1 },
    { key: 'used-oil-container', label: 'Contenitore olio esausto', weight: 1 },
    { key: 'km0-ingredients', label: 'Ingredienti locali a km 0 certificati', weight: 2 },
    { key: 'waste-reduction-docs', label: 'Documentazione per la riduzione di sprechi', weight: 1 },
    { key: 'digital-menu', label: 'Menu digitale', weight: 1 },
    { key: 'plastic-free-setup', label: 'Allestimento senza plastica', weight: 2 }
] as const;

export const PLASTIC_FREE_VALUES: string[] = PLASTIC_FREE_PRACTICES.map((p) => p.key);

export function plasticFreeScore(keys: readonly string[]): number {
    const weights = new Map<string, number>(PLASTIC_FREE_PRACTICES.map((p) => [p.key, p.weight]));
    return keys.reduce((sum, key) => sum + (weights.get(key) ?? 0), 0);
}

const adhesionProductSchema = new Schema(
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
        price: {
            type: Number,
            required: true,
            min: 0
        },
        coverImage: {
            type: imageSchema,
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
        }
    },
    {
        versionKey: false
    }
);

const energyNeedSchema = new Schema(
    {
        equipment: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },
        powerKw: {
            type: Number,
            min: 0,
            default: null
        },
        connectionType: {
            type: String,
            trim: true,
            maxlength: 120,
            default: null
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

const standAdhesionSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
            standId: {
            type: Schema.Types.ObjectId,
            ref: 'Stand',
            default: null
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true
        },
        accessTokenHash: {
            type: String,
            default: null
        },
        status: {
            type: String,
            enum: ADHESION_STATUS_VALUES,
            default: 'draft',
            index: true
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        reviewNote: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: null
        },
        standName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        standType: {
            type: String,
            enum: ['food', 'artigianato', 'divertimento'],
            default: 'food'
        },
        slogan: {
            type: String,
            trim: true,
            maxlength: 280,
            default: null
        },
        description: {
            type: String,
            trim: true,
            default: null
        },
        banner: {
            type: imageSchema,
            default: null
        },
        logo: {
            type: imageSchema,
            default: null
        },
        contactName: {
            type: String,
            trim: true,
            maxlength: 160,
            default: null
        },
        contactEmail: {
            type: String,
            trim: true,
            maxlength: 254,
            default: null
        },
        contactPhone: {
            type: String,
            trim: true,
            maxlength: 40,
            default: null
        },
        contactSocial: {
            type: String,
            trim: true,
            maxlength: 200,
            default: null
        },
        products: {
            type: [adhesionProductSchema],
            default: []
        },
        haccpConfirmed: {
            type: Boolean,
            default: false
        },
        haccpNote: {
            type: String,
            trim: true,
            default: null
        },
        acceptsPointLight: {
            type: Boolean,
            default: false
        },
        energyNeeds: {
            type: [energyNeedSchema],
            default: []
        },
        plasticFreePractices: {
            type: [String],
            enum: PLASTIC_FREE_VALUES,
            default: []
        },
        participationFeeAccepted: {
            type: Boolean,
            default: false
        },
        depositAccepted: {
            type: Boolean,
            default: false
        },
        feesAccepted: {
            type: Boolean,
            default: false
        },
        regulationAccepted: {
            type: Boolean,
            default: false
        },
        exclusionAccepted: {
            type: Boolean,
            default: false
        },
        signature: {
            type: String,
            trim: true,
            maxlength: 200,
            default: null
        },
        signedAt: {
            type: Date,
            default: null
        },
        submittedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

standAdhesionSchema.index({ eventId: 1, standId: 1 });

export type StandAdhesion = InferSchemaType<typeof standAdhesionSchema>;

export const StandAdhesionModel = model('StandAdhesion', standAdhesionSchema);