import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { POIModel } from '../models/poi.model';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toPoiResponse(poi: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    name: string;
    description?: string | null;
    location: { type: string; coordinates: number[] };
    iconType?: string | null;
    iconImage?: unknown | null;
    coverImage?: unknown | null;
    gallery?: unknown[];
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: poi._id.toString(),
        eventId: poi.eventId.toString(),
        name: poi.name,
        description: poi.description ?? null,
        location: poi.location,
        iconType: poi.iconType ?? null,
        iconImage: poi.iconImage ?? null,
        coverImage: poi.coverImage ?? null,
        gallery: poi.gallery ?? [],
        createdAt: poi.createdAt,
        updatedAt: poi.updatedAt
    };
}

export async function listPois(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};

    if (req.query.eventId) {
        filter.eventId = req.query.eventId;
    }

    const items = await POIModel.find(filter).sort({ name: 1, createdAt: -1 });

    return res.status(200).json({
        items: items.map(toPoiResponse)
    });
}

export async function getPoiById(req: Request, res: Response) {
    const poiId = req.params.poiId;

    if (!isValidObjectId(poiId)) {
        return res.status(400).json({
            message: 'Invalid poi id'
        });
    }

    const poi = await POIModel.findById(poiId);

    if (!poi) {
        return res.status(404).json({
            message: 'POI not found'
        });
    }

    return res.status(200).json({
        item: toPoiResponse(poi)
    });
}

export async function createPoi(req: Request, res: Response) {
    const {
        eventId,
        name,
        description,
        location,
        iconType,
        iconImage,
        coverImage,
        gallery
    } = req.body;

    if (!eventId || !isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Valid eventId is required' });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Name is required' });
    }

    if (!location || !location.coordinates || !Array.isArray(location.coordinates)) {
        return res.status(400).json({ message: 'Valid location with coordinates is required' });
    }

    const poi = await POIModel.create({
        eventId,
        name: name.trim(),
        description: description ?? null,
        location,
        iconType: iconType ?? null,
        iconImage: iconImage ?? null,
        coverImage: coverImage ?? null,
        gallery: gallery ?? []
    });

    return res.status(201).json({
        item: toPoiResponse(poi)
    });
}

export async function updatePoi(req: Request, res: Response) {
    const poiId = req.params.poiId;

    if (!isValidObjectId(poiId)) {
        return res.status(400).json({
            message: 'Invalid poi id'
        });
    }

    const poi = await POIModel.findById(poiId);

    if (!poi) {
        return res.status(404).json({
            message: 'POI not found'
        });
    }

    const {
        name,
        description,
        location,
        iconType,
        iconImage,
        coverImage,
        gallery
    } = req.body;

    if (name !== undefined) {
        poi.name = name.trim();
    }

    if (description !== undefined) {
        poi.description = description;
    }

    if (location !== undefined) {
        poi.location = location;
    }

    if (iconType !== undefined) {
        poi.iconType = iconType;
    }

    if (iconImage !== undefined) {
        poi.iconImage = iconImage;
    }

    if (coverImage !== undefined) {
        poi.coverImage = coverImage;
    }

    if (gallery !== undefined) {
        poi.gallery = gallery;
    }

    await poi.save();

    return res.status(200).json({
        item: toPoiResponse(poi)
    });
}

export async function deletePoi(req: Request, res: Response) {
    const poiId = req.params.poiId;

    if (!isValidObjectId(poiId)) {
        return res.status(400).json({
            message: 'Invalid poi id'
        });
    }

    const poi = await POIModel.findByIdAndDelete(poiId);

    if (!poi) {
        return res.status(404).json({
            message: 'POI not found'
        });
    }

    return res.status(204).send();
}
