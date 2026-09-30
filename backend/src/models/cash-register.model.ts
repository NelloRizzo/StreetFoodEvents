import { Schema, model, type InferSchemaType } from 'mongoose';

const cashRegisterSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        name: {
            type: String,
            trim: true,
            required: true,
            maxlength: 80
        },
        status: {
            type: String,
            enum: ['open', 'closed'],
            required: true,
            default: 'open',
            index: true
        },
        openedByUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        openedAt: {
            type: Date,
            required: true,
            default: Date.now
        },
        closedAt: {
            type: Date,
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
        /* Soglia di sicurezza: se il contenuto della cassa scende sotto questi
         * valori la postazione invia in automatico una richiesta alla cassa
         * master. null = soglia non impostata (nessun invio automatico). */
        lowThreshold: {
            type: new Schema(
                {
                    euro: { type: Number, default: null, min: 0 },
                    credits: { type: Number, default: null, min: 0 }
                },
                { _id: false }
            ),
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

cashRegisterSchema.index({ eventId: 1, status: 1, openedAt: -1 });

export type CashRegister = InferSchemaType<typeof cashRegisterSchema>;

export const CashRegisterModel = model('CashRegister', cashRegisterSchema);