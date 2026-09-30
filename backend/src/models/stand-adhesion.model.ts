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
    { key: 'digital-menu', label: 'Menu digitale', weight: 1 },
    { key: 'plastic-free-setup', label: 'Allestimento senza plastica', weight: 2 }
] as const;

export const PLASTIC_FREE_VALUES: string[] = PLASTIC_FREE_PRACTICES.map((p) => p.key);

export function plasticFreeScore(keys: readonly string[]): number {
    const weights = new Map<string, number>(PLASTIC_FREE_PRACTICES.map((p) => [p.key, p.weight]));
    return keys.reduce((sum, key) => sum + (weights.get(key) ?? 0), 0);
}

/**
 * Pratiche di riduzione degli sprechi alimentari (sezione facoltativa).
 * Sono pratiche OPERATIVE e VERIFICABILI, non dichiarazioni: una checkbox che
 * chiunque puo' spuntare senza fare nulla non vale niente (greenwashing).
 * Il "group" serve a raggrupparle nel wizard e nel modulo stampabile.
 */
export const FOOD_WASTE_PRACTICES = [
    // Approvvigionamento
    { key: 'purchase-planning', group: 'Approvvigionamento', label: 'Ordini ai fornitori basati su una stima di vendita', weight: 2 },
    { key: 'pack-sized-purchases', group: 'Approvvigionamento', label: 'Acquisti in formati adatti al consumo dello stand', weight: 1 },
    { key: 'local-suppliers', group: 'Approvvigionamento', label: 'Fornitori locali', weight: 1 },
    // Conservazione
    { key: 'fifo-labelling', group: 'Conservazione', label: 'FIFO con etichettatura e data di apertura dei prodotti', weight: 2 },
    { key: 'closed-containers', group: 'Conservazione', label: 'Stoccaggio in contenitori chiusi e separati per tipologia', weight: 1 },
    // Preparazione e servizio
    { key: 'small-batches', group: 'Preparazione e servizio', label: 'Preparazione in piccoli lotti o a richiesta, invece che in anticipo', weight: 2 },
    { key: 'measured-prep', group: 'Preparazione e servizio', label: 'Brodi, salse e preparazioni base quantificate sul venduto', weight: 2 },
    { key: 'last-minute-discount', group: 'Preparazione e servizio', label: 'Sconto dichiarato sul cibo in eccedenza a fine servizio', weight: 1 },
    // Eccedenze e misura
    { key: 'donate-surplus', group: 'Eccedenze e misura', label: 'Donazione delle eccedenze a soggetto autorizzato in convenzione', weight: 2 },
    { key: 'take-back-unsold', group: 'Eccedenze e misura', label: 'Ritiro a fine evento del non venduto anziché smaltimento', weight: 2 },
    { key: 'waste-log', group: 'Eccedenze e misura', label: 'Registro delle quantità di spreco', weight: 1 }
] as const;

export const FOOD_WASTE_VALUES: string[] = FOOD_WASTE_PRACTICES.map((p) => p.key);

export const FOOD_WASTE_GROUPS: string[] = [...new Set(FOOD_WASTE_PRACTICES.map((p) => p.group))];

export function foodWasteScore(keys: readonly string[]): number {
    const weights = new Map<string, number>(FOOD_WASTE_PRACTICES.map((p) => [p.key, p.weight]));
    return keys.reduce((sum, key) => sum + (weights.get(key) ?? 0), 0);
}

/**
 * Chiavi spostate dalla lista plastic free a quella anti-spreco quando le due
 * pratiche sono state ricategorizzate. Senza questa normalizzazione in LETTURA
 * le adesioni gia' salvate perderebbero il punteggio (l'enum non accetterebbe
 * piu' le chiavi vecchie) e il primo salvaggio le riscriverebbe in forma nuova:
 * la normalizzazione e' quindi anche la migrazione.
 */
const LEGACY_PRACTICE_KEYS: Record<string, string> = {
    'km0-ingredients': 'local-suppliers',
    'waste-reduction-docs': 'waste-log'
};

const ALL_PRACTICE_VALUES: string[] = [...PLASTIC_FREE_VALUES, ...FOOD_WASTE_VALUES];

/** Deduplica, rimappa le chiavi legacy e scarta le chiavi non piu' valide. */
export function normalizePractices(keys: readonly string[] | null | undefined): string[] {
    const out: string[] = [];
    for (const key of keys ?? []) {
        const mapped = LEGACY_PRACTICE_KEYS[key] ?? key;
        if (ALL_PRACTICE_VALUES.includes(mapped) && !out.includes(mapped)) {
            out.push(mapped);
        }
    }
    return out;
}

/** Divide le pratiche normalizzate nelle due liste di appartenenza. */
export function splitPractices(keys: readonly string[] | null | undefined): {
    plasticFreePractices: string[];
    foodWastePractices: string[];
} {
    const normalized = normalizePractices(keys);
    return {
        plasticFreePractices: normalized.filter((k) => PLASTIC_FREE_VALUES.includes(k)),
        foodWastePractices: normalized.filter((k) => FOOD_WASTE_VALUES.includes(k))
    };
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
        foodWastePractices: {
            type: [String],
            enum: FOOD_WASTE_VALUES,
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