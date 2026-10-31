import { Schema, model, type InferSchemaType } from 'mongoose';

/* «Mi piace» di una foto della galleria.
 *
 * Chiave dell'unicita' = (foto, dispositivo), non (contest, dispositivo): lo
 * stesso telefono puo' mettere «mi piace» a piu' foto, e solo una volta alla
 * stessa foto. Stesso meccanismo di identita' dei voti del contest fotografico
 * (`deviceId` in localStorage + hash SHA-256), quindi nessun nuovo modo di
 * riconoscere un visitatore anonimo.
 *
 * `userId` e' facoltativo e vale solo per gli utenti autenticati: serve a un
 * eventuale conteggio per i badge, che `syncBadges` non puo' fare per gli
 * anonimi. Nessun badge lo legge ancora: il catalogo dei badge non si allarga
 * senza una decisione esplicita.
 *
 * Il record esiste = like presente: il toggle lo cancella, non lo marca. */
const eventPhotoLikeSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        photoId: {
            type: Schema.Types.ObjectId,
            ref: 'EventPhoto',
            required: true,
            index: true
        },
        deviceIdHash: {
            type: String,
            required: true,
            trim: true
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        likedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: false,
        versionKey: false
    }
);

eventPhotoLikeSchema.index({ photoId: 1, deviceIdHash: 1 }, { unique: true });
eventPhotoLikeSchema.index({ eventId: 1, photoId: 1 });

export type EventPhotoLike = InferSchemaType<typeof eventPhotoLikeSchema>;

export const EventPhotoLikeModel = model('EventPhotoLike', eventPhotoLikeSchema);
