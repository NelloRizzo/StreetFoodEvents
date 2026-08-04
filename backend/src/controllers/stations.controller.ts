import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { StationModel } from '../models/station.model';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toStationResponse(station: {
    _id: Types.ObjectId;
    standId: Types.ObjectId;
    name: string;
    sequenceOrder?: number;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: station._id.toString(),
        standId: station.standId.toString(),
        name: station.name,
        sequenceOrder: station.sequenceOrder ?? 0,
        createdAt: station.createdAt,
        updatedAt: station.updatedAt
    };
}

export async function listStations(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};

    if (req.query.standId) {
        filter.standId = req.query.standId;
    }

    const items = await StationModel.find(filter).sort({ sequenceOrder: 1, name: 1 });

    return res.status(200).json({
        items: items.map(toStationResponse)
    });
}

export async function getStationById(req: Request, res: Response) {
    const stationId = req.params.stationId;

    if (!isValidObjectId(stationId)) {
        return res.status(400).json({
            message: 'Invalid station id'
        });
    }

    const station = await StationModel.findById(stationId);

    if (!station) {
        return res.status(404).json({
            message: 'Station not found'
        });
    }

    return res.status(200).json({
        item: toStationResponse(station)
    });
}

export async function createStation(req: Request, res: Response) {
    const { standId, name } = req.body;

    if (!standId || !isValidObjectId(standId)) {
        return res.status(400).json({
            message: 'Invalid or missing standId'
        });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
            message: 'Station name is required'
        });
    }

    const last = await StationModel.findOne({ standId })
        .sort({ sequenceOrder: -1 })
        .select('sequenceOrder');

    const station = await StationModel.create({
        standId,
        name: name.trim(),
        sequenceOrder: (last?.sequenceOrder ?? 0) + 1
    });

    return res.status(201).json({
        item: toStationResponse(station)
    });
}

export async function updateStation(req: Request, res: Response) {
    const stationId = req.params.stationId;

    if (!isValidObjectId(stationId)) {
        return res.status(400).json({
            message: 'Invalid station id'
        });
    }

    const station = await StationModel.findById(stationId);

    if (!station) {
        return res.status(404).json({
            message: 'Station not found'
        });
    }

    const { name, sequenceOrder } = req.body;

    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({
                message: 'Station name cannot be empty'
            });
        }

        station.name = name.trim();
    }

    if (sequenceOrder !== undefined) {
        if (typeof sequenceOrder !== 'number' || !Number.isFinite(sequenceOrder)) {
            return res.status(400).json({
                message: 'Invalid sequenceOrder'
            });
        }

        station.sequenceOrder = sequenceOrder;
    }

    await station.save();

    return res.status(200).json({
        item: toStationResponse(station)
    });
}

export async function reorderStations(req: Request, res: Response) {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            message: 'A non-empty items array is required'
        });
    }

    const entries: { stationId: string; sequenceOrder: number }[] = [];

    for (const item of items) {
        if (typeof item !== 'object' || item === null) {
            return res.status(400).json({
                message: 'Invalid items payload'
            });
        }

        const { stationId, sequenceOrder } = item as { stationId?: string; sequenceOrder?: unknown };

        if (!isValidObjectId(stationId) || typeof sequenceOrder !== 'number' || !Number.isFinite(sequenceOrder)) {
            return res.status(400).json({
                message: 'Invalid items payload'
            });
        }

        entries.push({ stationId, sequenceOrder });
    }

    const stationIds = entries.map((e) => e.stationId);

    const found = await StationModel.find({ _id: { $in: stationIds } });
    if (found.length !== stationIds.length) {
        return res.status(404).json({
            message: 'One or more stations not found'
        });
    }

    const standIds = new Set(found.map((s) => s.standId.toString()));
    if (standIds.size !== 1) {
        return res.status(400).json({
            message: 'All items must belong to the same stand'
        });
    }

    await Promise.all(
        entries.map((e) =>
            StationModel.updateOne({ _id: e.stationId }, { $set: { sequenceOrder: e.sequenceOrder } })
        )
    );

    return res.status(204).send();
}

export async function deleteStation(req: Request, res: Response) {
    const stationId = req.params.stationId;

    if (!isValidObjectId(stationId)) {
        return res.status(400).json({
            message: 'Invalid station id'
        });
    }

    const station = await StationModel.findByIdAndDelete(stationId);

    if (!station) {
        return res.status(404).json({
            message: 'Station not found'
        });
    }

    return res.status(204).send();
}
