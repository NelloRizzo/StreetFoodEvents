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

function toStandResponse(stand: {
    _id: Types.ObjectId;
    name: string;
    slogan?: string | null;
    description?: string | null;
    eventIds: Types.ObjectId[];
    locations?: Array<{ eventId: Types.ObjectId; location?: Record<string, unknown> | null }> | null;
    coverImage?: unknown | null;
    gallery?: unknown[];
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: stand._id.toString(),
        name: stand.name,
        slogan: stand.slogan ?? null,
        description: stand.description ?? null,
        eventIds: stand.eventIds.map((id) => id.toString()),
        locations: (stand.locations ?? []).map((el) => ({
            eventId: el.eventId.toString(),
            location: el.location ?? null,
        } as { eventId: string; location: Record<string, unknown> | null })),
        coverImage: stand.coverImage ?? null,
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
        name,
        slogan,
        description,
        eventIds,
        locations,
        coverImage,
        gallery
    } = req.body;

    const stand = await StandModel.create({
        name,
        slogan: slogan ?? null,
        description: sanitizeHtmlContent(description),
        eventIds: Array.isArray(eventIds) ? eventIds : [],
        locations: Array.isArray(locations) ? locations : [],
        coverImage: coverImage ?? null,
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
        name,
        slogan,
        description,
        eventIds,
        locations,
        coverImage,
        gallery
    } = req.body;

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
    }

    if (locations !== undefined) {
        stand.locations = locations;
    }

    if (coverImage !== undefined) {
        stand.coverImage = coverImage;
    }

    if (gallery !== undefined) {
        stand.gallery = gallery;
    }

    await stand.save();

    return res.status(200).json({
        item: toStandResponse(stand)
    });
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
