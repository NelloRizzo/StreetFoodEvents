import { Router } from 'express';
import { Types } from 'mongoose';

import { listEarnedBadges, syncBadges } from '../services/badge.service';
import { BADGE_LIST } from '../services/badge-catalog';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const badgesRouter = Router();

/**
 * GET /api/badges/me
 *
 * SOLO `authMiddleware`, nessun `hasRole`: qui restituiamo i dati del
 * chiamante, quindi non c'e' nulla da autorizzare e non serve inventare un
 * ruolo. Il confine di privacy e' strutturale: l'endpoint restituisce solo i
 * badge dell'utente autenticato, quindi non esiste un modo di leggere i badge
 * di un altro (niente `userId` in query, niente rotta per id).
 *
 * `syncBadges` valuta le condizioni e registra quello che manca: e' un
 * assegnamento automatico, non c'e' nessun endpoint per assegnare a mano.
 */
badgesRouter.get(
    '/me',
    asyncHandler(authMiddleware),
    asyncHandler(async (req, res) => {
        const userId = new Types.ObjectId(req.user!.id);

        /* IN SEQUENZA, non in Promise.all: `earnedAt` arriva dalla lettura, e
           leggere mentre l'upsert sta ancora committando restituirebbe i badge
           appena vinti con `earnedAt: null`. */
        const progress = await syncBadges(userId);
        const earned = await listEarnedBadges(userId);

        const earnedAtByType = new Map(earned.map((b) => [b.type, b.earnedAt]));

        return res.status(200).json({
            /* Il catalogo viaggia con la risposta: etichette e icone hanno una
               sola fonte di verita' (il backend), niente copia da allineare. */
            catalog: BADGE_LIST.map((definition) => ({
                type: definition.type,
                label: definition.label,
                icon: definition.icon,
                description: definition.description,
                lockedHint: definition.lockedHint,
                target: definition.target
            })),
            badges: progress.map((p) => {
                const definition = BADGE_LIST.find((d) => d.type === p.type)!;
                return {
                    type: p.type,
                    label: definition.label,
                    icon: definition.icon,
                    description: definition.description,
                    lockedHint: definition.lockedHint,
                    earned: p.earned,
                    earnedAt: earnedAtByType.get(p.type) ?? null,
                    eventId: p.eventId,
                    progress: p.progress,
                    target: p.target
                };
            })
        });
    })
);
