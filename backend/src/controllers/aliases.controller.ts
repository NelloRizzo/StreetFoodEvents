import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { AliasModel } from '../models/alias.model';
import { EventModel } from '../models/event.model';
import { StandModel } from '../models/stand.model';
import { standAliasFromName } from '../utils/alias-slug';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

/** Lo stand e' collegato all'evento? Il collegamento si legge da `eventIds`
 *  oppure da `locations` (la numerazione per evento): non basta una delle due.
 *  Senza questo controllo un link breve porterebbe alla pagina di uno stand
 *  estraneo al contesto per cui e' stato scritto. */
function isStandLinkedToEvent(
    stand: {
        eventIds?: { toString(): string }[] | null;
        locations?: { eventId?: { toString(): string } | null }[] | null;
    },
    eventId: string
): boolean {
    return stand.eventIds?.some((id) => id.toString() === eventId) === true
        || stand.locations?.some((loc) => loc.eventId?.toString() === eventId) === true;
}

function toAliasResponse(alias: {
    _id: Types.ObjectId;
    text: string;
    entityType: string;
    entityRef: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: alias._id.toString(),
        text: alias.text,
        entityType: alias.entityType,
        entityRef: alias.entityRef.toString(),
        createdAt: alias.createdAt,
        updatedAt: alias.updatedAt
    };
}

export async function listAliases(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};

    if (req.query.entityType) {
        filter.entityType = req.query.entityType;
    }

    if (req.query.entityRef) {
        filter.entityRef = req.query.entityRef;
    }

    const items = await AliasModel.find(filter).sort({ text: 1 });

    return res.status(200).json({
        items: items.map(toAliasResponse)
    });
}

export async function getAliasById(req: Request, res: Response) {
    const aliasId = req.params.aliasId;

    if (!isValidObjectId(aliasId)) {
        return res.status(400).json({
            message: 'Invalid alias id'
        });
    }

    const alias = await AliasModel.findById(aliasId);

    if (!alias) {
        return res.status(404).json({
            message: 'Alias not found'
        });
    }

    return res.status(200).json({
        item: toAliasResponse(alias)
    });
}

export async function createAlias(req: Request, res: Response) {
    const { text, entityType, entityRef } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ message: 'Text is required' });
    }

    if (!entityType || !['event', 'stand'].includes(entityType)) {
        return res.status(400).json({ message: 'entityType must be "event" or "stand"' });
    }

    if (!entityRef || !isValidObjectId(entityRef)) {
        return res.status(400).json({ message: 'Valid entityRef is required' });
    }

    const exists = await AliasModel.findOne({ text: text.trim().toLowerCase() });
    if (exists) {
        return res.status(409).json({ message: 'Alias already in use' });
    }

    const alias = await AliasModel.create({
        text: text.trim().toLowerCase(),
        entityType,
        entityRef
    });

    return res.status(201).json({
        item: toAliasResponse(alias)
    });
}

export async function updateAlias(req: Request, res: Response) {
    const aliasId = req.params.aliasId;

    if (!isValidObjectId(aliasId)) {
        return res.status(400).json({
            message: 'Invalid alias id'
        });
    }

    const alias = await AliasModel.findById(aliasId);

    if (!alias) {
        return res.status(404).json({
            message: 'Alias not found'
        });
    }

    const { text } = req.body;

    if (text !== undefined) {
        if (typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ message: 'Text cannot be empty' });
        }

        const normalized = text.trim().toLowerCase();

        const conflict = await AliasModel.findOne({ text: normalized, _id: { $ne: aliasId } });
        if (conflict) {
            return res.status(409).json({ message: 'Alias already in use' });
        }

        alias.text = normalized;
    }

    await alias.save();

    return res.status(200).json({
        item: toAliasResponse(alias)
    });
}

export async function deleteAlias(req: Request, res: Response) {
    const aliasId = req.params.aliasId;

    if (!isValidObjectId(aliasId)) {
        return res.status(400).json({
            message: 'Invalid alias id'
        });
    }

    const alias = await AliasModel.findByIdAndDelete(aliasId);

    if (!alias) {
        return res.status(404).json({
            message: 'Alias not found'
        });
    }

    return res.status(204).send();
}

export async function resolveAlias(req: Request, res: Response) {
    const { entityType, alias } = req.params;

    if (!entityType || !['event', 'stand'].includes(entityType)) {
        return res.status(400).json({ message: 'entityType must be "event" or "stand"' });
    }

    if (!alias || typeof alias !== 'string' || !alias.trim()) {
        return res.status(400).json({ message: 'Alias is required' });
    }

    const doc = await AliasModel.findOne({ text: alias.trim().toLowerCase(), entityType });

    if (!doc) {
        return res.status(404).json({ message: `${entityType} alias not found` });
    }

    let entity: { id: string; name: string } | null = null;

    if (entityType === 'event') {
        const event = await EventModel.findById(doc.entityRef).select('name');
        if (event) {
            entity = { id: event._id.toString(), name: event.name };
        }
    } else {
        const stand = await StandModel.findById(doc.entityRef).select('name');
        if (stand) {
            entity = { id: stand._id.toString(), name: stand.name };
        }
    }

    if (!entity) {
        return res.status(404).json({ message: `Referenced ${entityType} not found` });
    }

    return res.status(200).json({
        entityType,
        entityId: entity.id,
        entityName: entity.name
    });
}

/**
 * Link breve di uno stand **annidato nell'evento**: `/show/stand/<alias evento>/<segmento stand>`.
 *
 *  Il segmento dello stand e' l'alias **esplicito** se ne esiste uno (quelli
 *  creati in passato), altrimenti il **nome dello stand ripulito**: lo
 *  shortlink dello stand non si crea piu' a mano, si ricava da quello
 *  dell'evento. Il percorso non viene mai salvato da nessuna parte: si compone
 *  qui, al momento della richiesta, quindi rinominare l'alias dell'evento non
 *  lascia sporgenti i link gia' stampati.
 *
 *  Il controllo che conta e' l'ultimo: lo stand deve essere **di quell'evento**.
 *  Senza, `/show/stand/evento-a/stand-b` porterebbe alla pagina di uno stand
 *  estraneo all'evento, cioe' un link breve che porta fuori dal contesto per
 *  cui e' stato scritto. Vale sia per l'alias esplicito sia per il nome.
 */
export async function resolveStandAliasInEvent(req: Request, res: Response) {
    const eventAlias = (req.params.eventAlias as string | undefined)?.trim().toLowerCase();
    const standAlias = (req.params.standAlias as string | undefined)?.trim().toLowerCase();

    if (!eventAlias || !standAlias) {
        return res.status(400).json({ message: 'Event alias and stand alias are required' });
    }

    const eventDoc = await AliasModel.findOne({ text: eventAlias, entityType: 'event' });

    if (!eventDoc) {
        return res.status(404).json({ message: 'event alias not found' });
    }

    const eventId = eventDoc.entityRef.toString();

    /* Prima l'alias esplicito, che ha la precedenza; se non c'e', o punta a
       uno stand di un altro evento, si cerca per nome fra gli stand collegati
       a questo evento. Gli stand sono pochi per evento, quindi il confronto in
       memoria costa meno di una slugify in query (che MongoDB non sa fare). */
    const explicit = await AliasModel.findOne({ text: standAlias, entityType: 'stand' });

    let stand = explicit
        ? await StandModel.findById(explicit.entityRef).select('name eventIds locations').lean()
        : null;

    if (!stand || !isStandLinkedToEvent(stand, eventId)) {
        const candidates = await StandModel.find({
            $or: [
                { eventIds: eventDoc.entityRef },
                { 'locations.eventId': eventDoc.entityRef }
            ]
        })
            .select('name eventIds locations')
            .lean();

        stand = candidates.find((s) => standAliasFromName(s.name) === standAlias) ?? null;
    }

    if (!stand) {
        return res.status(404).json({ message: 'Stand is not linked to that event' });
    }

    return res.status(200).json({
        entityType: 'stand',
        eventId,
        standId: stand._id.toString(),
        entityId: stand._id.toString(),
        entityName: stand.name
    });
}
