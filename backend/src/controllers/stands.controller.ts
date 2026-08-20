import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import * as qrcode from 'qrcode';

import { StandModel } from '../models/stand.model';
import { sanitizeHtmlContent } from '../utils/html-sanitizer';
import { RoleModel } from '../models/role.model';
import { UserRoleModel } from '../models/user-role.model';
import { UsageContractModel } from '../models/usage-contract.model';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

async function nextStandNumber(eventId: string): Promise<number> {
    const eventIdObj = new Types.ObjectId(eventId);
    const result = await StandModel.aggregate([
        { $match: { 'numbers.eventId': eventIdObj } },
        { $unwind: '$numbers' },
        { $match: { 'numbers.eventId': eventIdObj } },
        { $group: { _id: null, max: { $max: '$numbers.number' } } }
    ]) as Array<{ max?: number }>;
    return (result[0]?.max ?? 0) + 1;
}

function toStandResponse(stand: {
    _id: Types.ObjectId;
    type?: string;
    name: string;
    slogan?: string | null;
    description?: string | null;
    eventIds: Types.ObjectId[];
    locations?: Array<{ eventId: Types.ObjectId; location?: Record<string, unknown> | null }> | null;
    numbers?: Array<{ eventId: Types.ObjectId; number: number; showOnMap?: boolean; feePercent?: number | null; feeFlat?: number | null }> | null;
    coverImage?: unknown | null;
    logo?: unknown | null;
    gallery?: unknown[];
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: stand._id.toString(),
        type: stand.type ?? 'food',
        name: stand.name,
        slogan: stand.slogan ?? null,
        description: stand.description ?? null,
        eventIds: stand.eventIds.map((id) => id.toString()),
        locations: (stand.locations ?? []).map((el) => ({
            eventId: el.eventId.toString(),
            location: el.location ?? null,
        } as { eventId: string; location: Record<string, unknown> | null })),
        numbers: (stand.numbers ?? []).map((el) => ({
            eventId: el.eventId.toString(),
            number: el.number,
            showOnMap: el.showOnMap ?? true,
            feePercent: el.feePercent ?? null,
            feeFlat: el.feeFlat ?? null,
        } as { eventId: string; number: number; showOnMap: boolean; feePercent: number | null; feeFlat: number | null })),
        coverImage: stand.coverImage ?? null,
        logo: stand.logo ?? null,
        gallery: stand.gallery ?? [],
        createdAt: stand.createdAt,
        updatedAt: stand.updatedAt
    };
}

export async function listStands(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};

    if (req.query.eventId) {
        filter.eventIds = { $in: [req.query.eventId] };
    }

    const items = await StandModel.find(filter).sort({ name: 1, createdAt: -1 });

    return res.status(200).json({
        items: items.map(toStandResponse)
    });
}

export async function getStandById(req: Request, res: Response) {
    const standId = req.params.standId;

    if (!isValidObjectId(standId)) {
        return res.status(400).json({
            message: 'Invalid stand id'
        });
    }

    const stand = await StandModel.findById(standId);

    if (!stand) {
        return res.status(404).json({
            message: 'Stand not found'
        });
    }

    return res.status(200).json({
        item: toStandResponse(stand)
    });
}

export async function createStand(req: Request, res: Response) {
    const {
        type,
        name,
        slogan,
        description,
        eventIds,
        locations,
        eventFees,
        coverImage,
        logo,
        gallery
    } = req.body;

    const eventIdList: string[] = Array.isArray(eventIds) ? eventIds : [];
    const feesMap: Record<string, { feePercent?: number | null; feeFlat?: number | null }> = eventFees && typeof eventFees === 'object' ? eventFees : {};
    const numbers = (await Promise.all(
        eventIdList.map(async (eid) => {
            if (!isValidObjectId(eid)) return null;
            const fee = feesMap[eid];
            return {
                eventId: eid,
                number: await nextStandNumber(eid),
                ...(fee ? { feePercent: fee.feePercent ?? null, feeFlat: fee.feeFlat ?? null } : {})
            };
        })
    )).filter((n): n is { eventId: string; number: number; feePercent?: number | null; feeFlat?: number | null } => n !== null);

    const stand = await StandModel.create({
        type: type ?? 'food',
        name,
        slogan: slogan ?? null,
        description: sanitizeHtmlContent(description),
        eventIds: eventIdList,
        locations: Array.isArray(locations) ? locations : [],
        numbers,
        coverImage: coverImage ?? null,
        logo: logo ?? null,
        gallery: gallery ?? []
    });

    return res.status(201).json({
        item: toStandResponse(stand)
    });
}

export async function updateStand(req: Request, res: Response) {
    const standId = req.params.standId;

    if (!isValidObjectId(standId)) {
        return res.status(400).json({
            message: 'Invalid stand id'
        });
    }

    const stand = await StandModel.findById(standId);

    if (!stand) {
        return res.status(404).json({
            message: 'Stand not found'
        });
    }

    const {
        type,
        name,
        slogan,
        description,
        eventIds,
        locations,
        eventFees,
        coverImage,
        logo,
        gallery
    } = req.body;

    if (type !== undefined) {
        stand.type = type;
    }

    if (name !== undefined) {
        stand.name = name;
    }

    if (slogan !== undefined) {
        stand.slogan = slogan;
    }

    if (description !== undefined) {
        stand.description = sanitizeHtmlContent(description);
    }

    if (eventIds !== undefined) {
        /* Check usage contract limits for all users with stand-level roles on this stand */
        const standRoleIds = await RoleModel.find({ scope: 'stand' }).select('_id').lean();
        const standRoleObjectIds = standRoleIds.map((r) => r._id);

        const usersOnStand = await UserRoleModel.find({
            standId,
            roleId: { $in: standRoleObjectIds },
            isActive: true,
        }).select('userId').lean();

        const newEventIds = Array.isArray(eventIds) ? eventIds : [];

        /* Find which events are being added (in new but not in old) */
        const oldEventIdStrings = (stand.eventIds || []).map((id) => id.toString());
        const addedEventIds = newEventIds.filter((id: string) => !oldEventIdStrings.includes(id));
        const removedEventIdStrings = oldEventIdStrings.filter((id: string) => !newEventIds.includes(id));

        if (addedEventIds.length > 0) {
            for (const userOnStand of usersOnStand) {
                for (const addedEventId of addedEventIds) {
                    const contract = await UsageContractModel.findOne({
                        userId: userOnStand.userId,
                        eventId: addedEventId,
                        status: 'active',
                    });

                    if (!contract) continue;

                    /* Count stands this user already has at this event (excluding current stand) */
                    const existingUserRoles = await UserRoleModel.find({
                        userId: userOnStand.userId,
                        roleId: { $in: standRoleObjectIds },
                        isActive: true,
                        standId: { $ne: standId },
                    }).select('standId').lean();

                    const otherStandIds = existingUserRoles
                        .map((r) => r.standId?.toString())
                        .filter((id): id is string => id !== undefined);

                    const standsAtEvent = await StandModel.countDocuments({
                        _id: { $in: otherStandIds.length > 0 ? otherStandIds : ['000000000000000000000000'] },
                        eventIds: addedEventId,
                    });

                    if (standsAtEvent >= contract.maxStands) {
                        return res.status(422).json({
                            message: `Limite superato: l'utente ha già ${standsAtEvent} stand su ${contract.maxStands} consentiti per questo evento`,
                        });
                    }
                }
            }
        }

        stand.eventIds = newEventIds;

        /* Assign progressive numbers for newly linked events and drop numbers for removed ones */
        if (addedEventIds.length > 0 || removedEventIdStrings.length > 0) {
            const removedSet = new Set(removedEventIdStrings);
            const feesMap: Record<string, { feePercent?: number | null; feeFlat?: number | null }> = eventFees && typeof eventFees === 'object' ? eventFees : {};
            const kept: Array<{ eventId: string; number: number; feePercent?: number | null; feeFlat?: number | null }> = (stand.numbers ?? [])
                .filter((n) => !removedSet.has(n.eventId.toString()))
                .map((n) => {
                    const eid = n.eventId.toString();
                    const fee = feesMap[eid];
                    return {
                        eventId: eid,
                        number: n.number,
                        feePercent: fee?.feePercent ?? n.feePercent ?? null,
                        feeFlat: fee?.feeFlat ?? n.feeFlat ?? null,
                    };
                });
            for (const addedEventId of addedEventIds) {
                if (!isValidObjectId(addedEventId)) continue;
                const fee = feesMap[addedEventId];
                kept.push({
                    eventId: addedEventId,
                    number: await nextStandNumber(addedEventId),
                    ...(fee ? { feePercent: fee.feePercent ?? null, feeFlat: fee.feeFlat ?? null } : {})
                });
            }
            stand.set('numbers', kept);
        }
    }

    /* Update fee overrides for existing events without changing eventIds */
    if (eventIds === undefined && eventFees && typeof eventFees === 'object') {
        const feesMap: Record<string, { feePercent?: number | null; feeFlat?: number | null }> = eventFees;
        const updatedNumbers = (stand.numbers ?? []).map((n) => {
            const eid = n.eventId.toString();
            const fee = feesMap[eid];
            if (!fee) return { eventId: eid, number: n.number, showOnMap: n.showOnMap ?? true, feePercent: n.feePercent ?? null, feeFlat: n.feeFlat ?? null };
            return {
                eventId: eid,
                number: n.number,
                showOnMap: n.showOnMap ?? true,
                feePercent: fee.feePercent !== undefined ? fee.feePercent : n.feePercent ?? null,
                feeFlat: fee.feeFlat !== undefined ? fee.feeFlat : n.feeFlat ?? null,
            };
        });
        stand.set('numbers', updatedNumbers);
    }

    if (locations !== undefined) {
        stand.locations = locations;
    }

    if (coverImage !== undefined) {
        stand.coverImage = coverImage;
    }

    if (logo !== undefined) {
        stand.logo = logo;
    }

    if (gallery !== undefined) {
        stand.gallery = gallery;
    }

    await stand.save();

    return res.status(200).json({
        item: toStandResponse(stand)
    });
}

export async function reorderStands(req: Request, res: Response) {
    const { eventId, items } = req.body;

    if (!eventId || !isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Valid eventId is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'A non-empty items array is required' });
    }

    const eventIdObj = new Types.ObjectId(eventId);
    const entries: { standId: string; number: number; showOnMap?: boolean }[] = [];

    for (const item of items) {
        if (typeof item !== 'object' || item === null) {
            return res.status(400).json({ message: 'Invalid items payload' });
        }
        const { standId, number, showOnMap } = item as { standId?: string; number?: unknown; showOnMap?: unknown };
        if (!isValidObjectId(standId) || typeof number !== 'number' || !Number.isFinite(number) || number < 1) {
            return res.status(400).json({ message: 'Invalid items payload' });
        }
        if (showOnMap !== undefined && typeof showOnMap !== 'boolean') {
            return res.status(400).json({ message: 'Invalid items payload' });
        }
        entries.push(showOnMap !== undefined ? { standId, number, showOnMap } : { standId, number });
    }

    const standIds = entries.map((e) => e.standId);
    const found = await StandModel.find({ _id: { $in: standIds }, eventIds: eventIdObj });
    if (found.length !== standIds.length) {
        return res.status(404).json({ message: 'One or more stands not found or not part of this event' });
    }

    const eventIdString = eventIdObj.toString();
    for (const entry of entries) {
        const stand = found.find((s) => s._id.toString() === entry.standId);
        if (!stand) continue;
        const existing = (stand.numbers ?? []).find((n) => n.eventId.toString() === eventIdString);
        if (existing) {
            existing.number = entry.number;
            if (entry.showOnMap !== undefined) {
                existing.showOnMap = entry.showOnMap;
            }
        } else {
            stand.numbers.push({ eventId: eventIdObj, number: entry.number, showOnMap: entry.showOnMap ?? true });
        }
    }

    await Promise.all(found.map((s) => s.save()));

    return res.status(204).send();
}

export async function standQrCode(req: Request, res: Response) {
  const standId = req.params.standId;

  if (!isValidObjectId(standId)) {
    return res.status(400).json({ message: 'Invalid stand id' });
  }

  const stand = await StandModel.findById(standId);

  if (!stand) {
    return res.status(404).json({ message: 'Stand not found' });
  }

  const origin = req.headers.origin ?? `${req.protocol}://${req.headers.host}`;
  const eventId = req.query.eventId as string | undefined;
  const url = eventId
    ? `${origin}/events/${eventId}/stands/${standId}`
    : `${origin}/stands/${standId}`;

  const qrDataUrl = await qrcode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#264137',
      light: '#ffffff'
    }
  });

  return res.status(200).json({ qrCode: qrDataUrl });
}

export async function deleteStand(req: Request, res: Response) {
    const standId = req.params.standId;

    if (!isValidObjectId(standId)) {
        return res.status(400).json({
            message: 'Invalid stand id'
        });
    }

    const stand = await StandModel.findByIdAndDelete(standId);

    if (!stand) {
        return res.status(404).json({
            message: 'Stand not found'
        });
    }

    return res.status(204).send();
}
