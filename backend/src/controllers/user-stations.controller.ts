import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { UserStationModel } from '../models/user-station.model';

interface PopulatedStation {
    _id: Types.ObjectId;
    name: string;
    standId: Types.ObjectId;
}

function isPopulatedStation(val: unknown): val is PopulatedStation {
    return (
        val !== null &&
        typeof val === 'object' &&
        '_id' in val &&
        'name' in val &&
        'standId' in val
    );
}

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

interface RawUserStation {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    stationId: Types.ObjectId | PopulatedStation;
    assignedBy: Types.ObjectId | null | undefined;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

function toUserStationResponse(us: RawUserStation) {
    const station = isPopulatedStation(us.stationId)
        ? {
              id: us.stationId._id.toString(),
              name: us.stationId.name,
              standId: us.stationId.standId.toString()
          }
        : null;

    return {
        id: us._id.toString(),
        userId: us.userId.toString(),
        stationId: isPopulatedStation(us.stationId) ? us.stationId._id.toString() : us.stationId.toString(),
        assignedBy: us.assignedBy?.toString() ?? null,
        isActive: us.isActive,
        station,
        createdAt: us.createdAt,
        updatedAt: us.updatedAt
    };
}

export async function listUserStations(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const filter: Record<string, unknown> = {};

    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.stationId) filter.stationId = req.query.stationId;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const items = await UserStationModel.find(filter)
        .populate('stationId', 'name standId')
        .sort({ createdAt: -1 });

    return res.status(200).json({
        items: items.map((item) => toUserStationResponse(item.toObject() as unknown as RawUserStation))
    });
}

export async function getUserStationById(req: Request, res: Response) {
    const id = req.params.userStationId;

    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: 'Invalid user station id' });
    }

    const item = await UserStationModel.findById(id).populate('stationId', 'name standId');

    if (!item) {
        return res.status(404).json({ message: 'User station not found' });
    }

    return res.status(200).json({
        item: toUserStationResponse(item.toObject() as unknown as RawUserStation)
    });
}

export async function createUserStation(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const { userId, stationId } = req.body;

    if (!userId || !isValidObjectId(userId)) {
        return res.status(400).json({ message: 'Invalid or missing userId' });
    }

    if (!stationId || !isValidObjectId(stationId)) {
        return res.status(400).json({ message: 'Invalid or missing stationId' });
    }

    const existing = await UserStationModel.findOne({ userId, stationId });

    if (existing) {
        return res.status(409).json({ message: 'User is already assigned to this station' });
    }

    const item = await UserStationModel.create({
        userId,
        stationId,
        assignedBy: req.user.id
    });

    return res.status(201).json({
        item: toUserStationResponse(item.toObject() as unknown as RawUserStation)
    });
}

export async function deleteUserStation(req: Request, res: Response) {
    const id = req.params.userStationId;

    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: 'Invalid user station id' });
    }

    const item = await UserStationModel.findByIdAndDelete(id);

    if (!item) {
        return res.status(404).json({ message: 'User station not found' });
    }

    return res.status(204).send();
}
