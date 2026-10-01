import { Schema, model, type InferSchemaType } from 'mongoose';

import { BADGE_TYPES } from '../services/badge-catalog';

/**
 * Badge ottenuto da un utente.
 *
 * Un documento per (utente, tipo): l'indice unico `{ userId, type }` rende
 * l'assegnazione idempotente per costruzione, quindi il sync puo' girare a ogni
 * lettura del profilo senza temere doppioni e senza dover prima controllare se
 * il badge esiste gia'.
 *
 * `eventId` e' solo contesto (dove e' stato ottenuto), non un ambito: i badge
 * sono globali sull'account, perche' "Seguace" significa aver frequentato piu'
 * eventi e quindi non avrebbe senso se valesse solo dentro uno.
 */
const badgeSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        type: {
            type: String,
            enum: BADGE_TYPES,
            required: true
        },
        earnedAt: {
            type: Date,
            default: Date.now
        },
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

badgeSchema.index({ userId: 1, type: 1 }, { unique: true });

export const BadgeModel = model('Badge', badgeSchema);

export type Badge = InferSchemaType<typeof badgeSchema>;
