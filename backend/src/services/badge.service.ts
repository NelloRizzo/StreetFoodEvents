import { Types } from 'mongoose';

import { BadgeModel } from '../models/badge.model';
import { EventPhotoModel } from '../models/event-photo.model';
import { FavoriteModel } from '../models/favorite.model';
import { OrderModel } from '../models/order.model';
import { BADGE_CATALOG, BADGE_LIST, type BadgeType } from './badge-catalog';

/** Ora (0-23) oltre la quale si considera "notte fonda". */
const NIGHT_OWL_FROM_HOUR = 22;

/** Fuso di ripiego quando l'evento non ne ha uno valido. */
const DEFAULT_TIMEZONE = 'Europe/Rome';

type BadgeProgress = {
    type: BadgeType;
    /** Dove il badge è stato ottenuto, quando è stato ottenuto. */
    eventId: Types.ObjectId | null;
    /** 0..target, per i badge con soglia. */
    progress: number;
    target: number | null;
    /** true se il badge può essere ottenuto con i dati attuali. */
    earned: boolean;
};

/**
 * Contatore ordini per utente.
 *
 * GOTCHA `Order.userId` NON e' il visitatore: e' chi ha emesso l'ordine (il
 * cassiere). Il cliente e' `customerId`, che e' nullable perche' gli ospiti
 * anonimi non hanno account. I badge quindi si basano su `customerId`, e di
 * conseguenza spettano solo a chi e' loggato.
 *
 * Omaggi e cancellati sono esclusi: un omaggio non e' un acquisto.
 */
function countOrders(userId: Types.ObjectId) {
    return OrderModel.countDocuments({
        customerId: userId,
        status: { $ne: 'cancelled' },
        isGift: { $ne: true }
    });
}

async function firstOrderEvent(userId: Types.ObjectId): Promise<Types.ObjectId | null> {
    const order = await OrderModel.findOne({ customerId: userId, status: { $ne: 'cancelled' }, isGift: { $ne: true } })
        .sort({ createdAt: 1 })
        .select('eventId')
        .lean();
    return order?.eventId ?? null;
}

/** Stand distinti in cui l'utente ha ordinato. */
async function distinctStands(userId: Types.ObjectId): Promise<number> {
    const rows = await OrderModel.aggregate([
        { $match: { customerId: userId, status: { $ne: 'cancelled' }, isGift: { $ne: true } } },
        { $group: { _id: '$standId' } },
        { $count: 'total' }
    ]);
    return rows[0]?.total ?? 0;
}

/**
 * Ordine dopo le 22 dell'ORA DELL'EVENTO.
 *
 * `createdAt` e' in UTC, quindi raggruppare per `$hour` darebbe l'ora sbagliata
 * di due ore su un evento italiano. Si fa un `$lookup` sull'evento per usare il
 * suo fuso in `$dateToString`: e' il motivo per cui `Event.timezone` esiste.
 */
async function nightOwl(userId: Types.ObjectId): Promise<{ hit: boolean; eventId: Types.ObjectId | null }> {
    const rows = await OrderModel.aggregate([
        { $match: { customerId: userId, status: { $ne: 'cancelled' }, isGift: { $ne: true } } },
        { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
        { $unwind: '$event' },
        {
            $match: {
                $expr: {
                    $gte: [
                        {
                            $toInt: {
                                $dateToString: {
                                    date: '$createdAt',
                                    format: '%H',
                                    timezone: { $ifNull: ['$event.timezone', DEFAULT_TIMEZONE] }
                                }
                            }
                        },
                        NIGHT_OWL_FROM_HOUR
                    ]
                }
            }
        },
        { $limit: 1 },
        { $project: { eventId: 1 } }
    ]);
    return { hit: (rows.length ?? 0) > 0, eventId: rows[0]?.eventId ?? null };
}

async function photoCount(userId: Types.ObjectId): Promise<{ count: number; eventId: Types.ObjectId | null }> {
    const rows = await EventPhotoModel.aggregate([
        { $match: { createdBy: userId } },
        { $group: { _id: null, count: { $sum: 1 }, eventId: { $first: '$eventId' } } }
    ]);
    return { count: rows[0]?.count ?? 0, eventId: rows[0]?.eventId ?? null };
}

/** Eventi distinti tra i preferiti dell'utente (solo eventi, non stand). */
async function followedEvents(userId: Types.ObjectId): Promise<number> {
    const rows = await FavoriteModel.aggregate([
        { $match: { userId, eventId: { $ne: null } } },
        { $group: { _id: '$eventId' } },
        { $count: 'total' }
    ]);
    return rows[0]?.total ?? 0;
}

/**
 * Valuta tutte le condizioni e registra i badge mancanti.
 *
 * E' l'unico punto di attacco: non viene agganciato alla creazione di ordini,
 * foto o preferiti. Motivo: con un punto solo il meccanismo si auto-guarisce e
 * chi ha ordinato PRIMA di questa feature riceve i badge retroattivamente al
 * primo accesso al profilo, senza uno script di backfill.
 *
 * Idempotente: l'upsert usa il filtro (userId, type) e l'indice unico, quindi
 * girarlo due volte non crea doppioni.
 */
export async function syncBadges(userId: Types.ObjectId): Promise<BadgeProgress[]> {
    const [
        orders,
        firstEventId,
        stands,
        owl,
        photos,
        favorites
    ] = await Promise.all([
        countOrders(userId),
        firstOrderEvent(userId),
        distinctStands(userId),
        nightOwl(userId),
        photoCount(userId),
        followedEvents(userId)
    ]);

    const evaluations: { type: BadgeType; earned: boolean; eventId: Types.ObjectId | null; progress: number }[] = [
        {
            type: 'first-order',
            earned: orders > 0,
            eventId: firstEventId,
            progress: orders > 0 ? 1 : 0
        },
        {
            type: 'explorer',
            earned: stands >= (BADGE_CATALOG.explorer.target ?? 3),
            eventId: firstEventId,
            progress: stands
        },
        {
            type: 'night-owl',
            earned: owl.hit,
            eventId: owl.eventId,
            progress: owl.hit ? 1 : 0
        },
        {
            type: 'photographer',
            earned: photos.count >= (BADGE_CATALOG.photographer.target ?? 3),
            eventId: photos.eventId,
            progress: photos.count
        },
        {
            type: 'follower',
            earned: favorites >= (BADGE_CATALOG.follower.target ?? 2),
            eventId: null,
            progress: favorites
        }
    ];

    const earnedTypes = evaluations.filter((e) => e.earned).map((e) => e.type);

    if (earnedTypes.length > 0) {
        await Promise.all(
            evaluations
                .filter((e) => e.earned)
                .map((e) =>
                    BadgeModel.updateOne(
                        { userId, type: e.type },
                        { $setOnInsert: { userId, type: e.type, earnedAt: new Date(), eventId: e.eventId } },
                        { upsert: true }
                    ).exec()
                )
        );
    }

    /* Rileggere dal db: earnedAt è il dato mostrato, e per un badge già
       presente non va riscritto con la data di oggi. */
    const stored = earnedTypes.length > 0
        ? await BadgeModel.find({ userId, type: { $in: earnedTypes } }).select('type eventId').lean()
        : [];
    const storedByType = new Map(stored.map((b) => [b.type, b.eventId ?? null]));

    return BADGE_LIST.map((definition) => {
        const evaluation = evaluations.find((e) => e.type === definition.type)!;
        return {
            type: definition.type,
            eventId: storedByType.get(definition.type) ?? null,
            progress: evaluation.progress,
            target: definition.target,
            earned: earnedTypes.includes(definition.type)
        };
    });
}

/** Storico dei badge, con la data in cui sono stati ottenuti. */
export async function listEarnedBadges(userId: Types.ObjectId) {
    return BadgeModel.find({ userId })
        .sort({ earnedAt: 1 })
        .select('type eventId earnedAt')
        .lean();
}

/**
 * Quando un evento viene cancellato i badge NON si cancellano: sono un
 * risultato dell'utente, non dell'evento. Perde solo il contesto, cosi' non
 * resta un riferimento a un documento sparito.
 */
export async function detachEventFromBadges(eventId: Types.ObjectId): Promise<void> {
    await BadgeModel.updateMany({ eventId }, { $set: { eventId: null } }).exec();
}
