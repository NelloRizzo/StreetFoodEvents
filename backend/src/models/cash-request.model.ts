import { Schema, model, type InferSchemaType } from 'mongoose';

export const cashRequestKindValues = ['euro', 'credits', 'both'] as const;

/**
 * pending      -> la postazione ha chiesto, la master non si e' ancora fatta vivo
 * acknowledged -> la master ha preso in carico
 * delivered    -> la master ha consegnato contanti/token (movementi registrati)
 * confirmed    -> la postazione ha confermato la ricezione (chiude il ciclo)
 * cancelled    -> annullata (prima della consegna)
 */
export const cashRequestStatusValues = [
    'pending',
    'acknowledged',
    'delivered',
    'confirmed',
    'cancelled'
] as const;

const cashRequestSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        /* La richiesta parte SEMPRE da una postazione del banco cambio, quindi
         * la cassa e' obbligatoria (le casse stand non hanno un CashRegister). */
        cashRegisterId: {
            type: Schema.Types.ObjectId,
            ref: 'CashRegister',
            required: true,
            index: true
        },
        kind: {
            type: String,
            enum: cashRequestKindValues,
            required: true
        },
        /* Importi richiesti: null = "serve qualcosa" (la cassa master decide
         * quanto consegnare). Valori > 0 = proposta del cassiere. */
        amountEuro: {
            type: Number,
            default: null,
            min: 0
        },
        amountCredits: {
            type: Number,
            default: null,
            min: 0
        },
        note: {
            type: String,
            trim: true,
            default: null,
            maxlength: 300
        },
        /* true quando la richiesta nasce dal superamento della soglia di
         * sicurezza invece che dalla pressione del pulsante. */
        isAutomatic: {
            type: Boolean,
            default: false
        },
        /* Contenuto della cassa al momento della richiesta: contesto per la
         * cassa master per capire l'urgenza senza aprire il dettaglio. */
        contentEuro: {
            type: Number,
            default: null
        },
        contentCredits: {
            type: Number,
            default: null
        },
        status: {
            type: String,
            enum: cashRequestStatusValues,
            required: true,
            default: 'pending',
            index: true
        },
        requestedByUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        requestedAt: {
            type: Date,
            required: true,
            default: Date.now
        },
        acknowledgedAt: {
            type: Date,
            default: null
        },
        acknowledgedByUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        deliveredAt: {
            type: Date,
            default: null
        },
        deliveredByUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        deliveredEuro: {
            type: Number,
            default: null,
            min: 0
        },
        deliveredCredits: {
            type: Number,
            default: null,
            min: 0
        },
        cancelledAt: {
            type: Date,
            default: null
        },
        /* Conferma di ricezione della postazione richiedente: avviene solo dopo
         * che la master ha accettato (acknowledged) o consegnato (delivered). */
        confirmedAt: {
            type: Date,
            default: null
        },
        confirmedByUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

cashRequestSchema.index({ eventId: 1, status: 1, requestedAt: -1 });

export type CashRequest = InferSchemaType<typeof cashRequestSchema>;
export type CashRequestKind = (typeof cashRequestKindValues)[number];
export type CashRequestStatus = (typeof cashRequestStatusValues)[number];

export const CashRequestModel = model('CashRequest', cashRequestSchema);
