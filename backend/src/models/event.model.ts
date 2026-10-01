import { Schema, model, type InferSchemaType } from 'mongoose';

import { imageSchema } from './schemas/image.schema';
import { documentSchema } from './schemas/document.schema';
import { locationSchema } from './schemas/location.schema';

const feeBandSchema = new Schema(
    {
        maxAmount: {
            type: Number,
            required: true,
            min: 0
        },
        feePercent: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        feeFlat: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    { _id: false }
);

const denominationSchema = new Schema(
    {
        label: {
            type: String,
            required: true,
            trim: true,
            maxlength: 60
        },
        value: {
            type: Number,
            required: true,
            min: 0.01
        },
        quantity: {
            type: Number,
            required: true,
            min: 0
        }
    },
    { _id: false }
);

const categorySchema = new Schema(
    {
        label: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80
        },
        sortOrder: {
            type: Number,
            default: 0
        }
    },
    { _id: false }
);

/**
 * Sponsor/partner dell'evento. Array embedded su Event (nessun model
 * dedicato): sono una configurazione dell'evento, come fasce e tagli, e una
 * manifestazione ne conta una decina. Il `tier` governa il peso visivo sul
 * volantino stampabile: 'main' = main partner (logo grande), 'sponsor' = fascia
 * a griglia, 'partner' = riga piccola dei fornitori/tecnici.
 * `enabled` permette di caricare gli sponsor prima dell'accordo e accenderli
 * solo quando scatta, senza toccare il frontend.
 */
const sponsorSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        logo: {
            type: imageSchema,
            required: true
        },
        url: {
            type: String,
            trim: true,
            maxlength: 2048,
            default: null
        },
        tier: {
            type: String,
            enum: ['main', 'sponsor', 'partner'],
            default: 'sponsor'
        },
        enabled: {
            type: Boolean,
            default: true
        },
        sortOrder: {
            type: Number,
            default: 0
        }
    },
    { _id: false }
);

const eventSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        location: {
            type: locationSchema,
            required: true
        },
        startDate: {
            type: Date,
            required: true,
            index: true
        },
        endDate: {
            type: Date,
            required: true,
            index: true,
            validate: {
                validator(this: { startDate?: Date }, value: Date) {
                    if (!this.startDate) {
                        return true;
                    }

                    return value >= this.startDate;
                },
                message: 'endDate must be greater than or equal to startDate'
            }
        },
        currencyName: {
            type: String,
            default: '€',
            trim: true,
            maxlength: 80
        },
        currencySymbol: {
            type: imageSchema,
            default: null
        },
        exchangeRate: {
            type: Number,
            default: 1,
            min: 0.01
        },
        /**
         * Fuso orario IANA dell'evento (es. 'Europe/Rome').
         *
         * Serve per ogni dato che dipende dall'ORA LOCALE e non solo dalla
         * data: senza, "l'ordine delle 22" finirebbe valutato in UTC e su un
         * evento italiano scatterebbe due ore fuori tempo. E' usato dal badge
         * "Nottefondista", che assegna i badge in UTC e deve però dire "dopo
         * le 22 di sera, ora dell'evento".
         *
         * Il default e' Europe/Rome perche' il prodotto nasce per eventi di
         * street food italiani; il controller lo valida contro l'elenco IANA e
         * ricade sul default se non valido.
         */
        timezone: {
            type: String,
            default: 'Europe/Rome',
            trim: true,
            maxlength: 80
        },
        participationFee: {
            type: Number,
            min: 0,
            default: null
        },
        participationFeeDeadline: {
            type: Date,
            default: null
        },
        deposit: {
            type: Number,
            min: 0,
            default: null
        },
        depositDeadline: {
            type: Date,
            default: null
        },
        adhesionDeadline: {
            type: Date,
            default: null
        },
        adhesionEnabled: {
            type: Boolean,
            default: false
        },
        themeBrand: {
            type: String,
            trim: true,
            default: null,
            maxlength: 7
        },
        themeText: {
            type: String,
            trim: true,
            default: null,
            maxlength: 7
        },
        themeSurface: {
            type: String,
            trim: true,
            default: null,
            maxlength: 7
        },
        themeHighlight: {
            type: String,
            trim: true,
            default: null,
            maxlength: 7
        },
        url: {
            type: String,
            trim: true,
            default: null,
            maxlength: 2048
        },
        shortDescription: {
            type: String,
            trim: true,
            default: null,
            maxlength: 500
        },
        longDescription: {
            type: String,
            trim: true,
            default: null
        },
        coverImage: {
            type: imageSchema,
            default: null
        },
        logo: {
            type: imageSchema,
            default: null
        },
        regulationDocument: {
            type: documentSchema,
            default: null
        },
        gallery: {
            type: [imageSchema],
            default: []
        },
        /* Sponsor e partner: esposti sul volantino stampabile dell'evento. */
        sponsors: {
            type: [sponsorSchema],
            default: []
        },
        cashPaymentsEnabled: {
            type: Boolean,
            default: true
        },
        unifiedCashierEnabled: {
            type: Boolean,
            default: false
        },
        cashRegisterResetAt: {
            type: Date,
            default: null
        },
        slideshowTitle: {
            type: String,
            trim: true,
            default: null,
            maxlength: 300
        },
        defaultFrameId: {
            type: Schema.Types.ObjectId,
            ref: 'Frame',
            default: null
        },
        cashFloat: {
            type: new Schema(
                {
                    euro: { type: Number, required: true, default: 0, min: 0 },
                    credits: { type: Number, required: true, default: 0, min: 0 },
                    setAt: { type: Date, default: null }
                },
                { _id: false }
            ),
            default: null
        },
        isPublic: {
            type: Boolean,
            default: true
        },
        feeBands: {
            type: [feeBandSchema],
            default: []
        },
        denominations: {
            type: [denominationSchema],
            default: []
        },
        categories: {
            type: [categorySchema],
            default: []
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

eventSchema.index({ 'location.coordinates': '2dsphere' });
eventSchema.index({ name: 1, startDate: 1 });

export type Event = InferSchemaType<typeof eventSchema>;

export const EventModel = model('Event', eventSchema);