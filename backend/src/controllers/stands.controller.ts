import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import * as qrcode from 'qrcode';

import { StandModel } from '../models/stand.model';
import { sanitizeHtmlContent } from '../utils/html-sanitizer';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toStandResponse(stand: {
    _id: Types.ObjectId;
    name: string;
    slogan?: string | null;
    description?: string | null;
    eventIds: Types.ObjectId[];
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
        coverImage,
        gallery
    } = req.body;

    const stand = await StandModel.create({
        name,
        slogan: slogan ?? null,
        description: sanitizeHtmlContent(description),
        eventIds: Array.isArray(eventIds) ? eventIds : [],
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
        stand.eventIds = eventIds;
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
  const url = `${origin}/stands/${standId}`;

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
