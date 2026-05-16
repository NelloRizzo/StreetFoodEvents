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
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: station._id.toString(),
        standId: station.standId.toString(),
        name: station.name,
        createdAt: station.createdAt,
        updatedAt: station.updatedAt
    };
}

export async function listStations(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};

    if (req.query.standId) {
        filter.standId = req.query.standId;
    }

    const items = await StationModel.find(filter).sort({ name: 1 });

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

    const station = await StationModel.create({
        standId,
        name: name.trim()
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

    const { name } = req.body;

    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({
                message: 'Station name cannot be empty'
            });
        }

        station.name = name.trim();
    }

    await station.save();

    return res.status(200).json({
        item: toStationResponse(station)
    });
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
