import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { FavoriteModel } from '../models/favorite.model';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFavoriteResponse(fav: any) {
    return {
        id: fav._id.toString(),
        userId: fav.userId.toString(),
        event: fav.eventId ? { id: fav.eventId._id.toString(), name: fav.eventId.name, shortDescription: fav.eventId.shortDescription ?? null } : null,
        stand: fav.standId ? { id: fav.standId._id.toString(), name: fav.standId.name, slogan: fav.standId.slogan ?? null } : null,
        createdAt: fav.createdAt,
        updatedAt: fav.updatedAt
    };
}

export async function listFavorites(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const items = await FavoriteModel.find({ userId: req.user.id })
        .populate('eventId')
        .populate('standId')
        .sort({ createdAt: -1 });

    return res.status(200).json({
        items: items.map(toFavoriteResponse)
    });
}

export async function createFavorite(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const { eventId, standId } = req.body;

    if (!eventId && !standId) {
        return res.status(400).json({
            message: 'Provide either eventId or standId'
        });
    }

    if (eventId && !isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid eventId' });
    }

    if (standId && !isValidObjectId(standId)) {
        return res.status(400).json({ message: 'Invalid standId' });
    }

    const existing = await FavoriteModel.findOne({
        userId: req.user.id,
        ...(eventId ? { eventId } : {}),
        ...(standId ? { standId } : {})
    });

    if (existing) {
        return res.status(409).json({ message: 'Already in favorites' });
    }

    const fav = await FavoriteModel.create({
        userId: req.user.id,
        eventId: eventId ?? null,
        standId: standId ?? null
    });

    return res.status(201).json({
        item: toFavoriteResponse(fav)
    });
}

export async function deleteFavorite(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const favId = req.params.favId;

    if (!isValidObjectId(favId)) {
        return res.status(400).json({ message: 'Invalid favorite id' });
    }

    const fav = await FavoriteModel.findOneAndDelete({
        _id: favId,
        userId: req.user.id
    });

    if (!fav) {
        return res.status(404).json({ message: 'Favorite not found' });
    }

    return res.status(204).send();
}
