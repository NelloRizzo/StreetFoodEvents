import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { UsageContractModel } from '../models/usage-contract.model';
import { RoleModel } from '../models/role.model';
import { UserRoleModel } from '../models/user-role.model';
import { StandModel } from '../models/stand.model';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toUsageContractResponse(doc: {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    eventId: Types.ObjectId;
    maxStands: number;
    status: string;
    startsAt?: Date | null;
    endsAt?: Date | null;
    notes?: string | null;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        eventId: doc.eventId.toString(),
        maxStands: doc.maxStands,
        status: doc.status,
        startsAt: (doc.startsAt ?? null) as Date | null,
        endsAt: (doc.endsAt ?? null) as Date | null,
        notes: doc.notes ?? null,
        createdBy: doc.createdBy.toString(),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

export async function listUsageContracts(req: Request, res: Response) {
    const { eventId, userId, status } = req.query;

    const filter: Record<string, unknown> = {};
    if (isValidObjectId(eventId as string)) filter.eventId = eventId;
    if (isValidObjectId(userId as string)) filter.userId = userId;
    if (typeof status === 'string' && ['active', 'suspended', 'expired'].includes(status)) {
        filter.status = status;
    }

    const docs = await UsageContractModel.find(filter)
        .populate('userId', 'firstName lastName email')
        .populate('eventId', 'name')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();

    const items = docs.map((doc) => ({
        ...toUsageContractResponse(doc as unknown as {
            _id: Types.ObjectId;
            userId: Types.ObjectId;
            eventId: Types.ObjectId;
            maxStands: number;
            status: string;
            startsAt: Date | null;
            endsAt: Date | null;
            notes: string | null;
            createdBy: Types.ObjectId;
            createdAt: Date;
            updatedAt: Date;
        }),
        user: (doc as Record<string, unknown>).userId as Record<string, unknown> ?? null,
        event: (doc as Record<string, unknown>).eventId as Record<string, unknown> ?? null,
        createdByUser: (doc as Record<string, unknown>).createdBy as Record<string, unknown> ?? null,
    }));

    return res.status(200).json({ items });
}

export async function createUsageContract(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const { userId, eventId, maxStands, status, startsAt, endsAt, notes } = req.body;

    if (!isValidObjectId(userId) || !isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid userId or eventId' });
    }

    if (typeof maxStands !== 'number' || maxStands < 1) {
        return res.status(400).json({ message: 'maxStands must be a number >= 1' });
    }

    const existing = await UsageContractModel.findOne({ userId, eventId });
    if (existing) {
        return res.status(409).json({ message: 'A usage contract already exists for this user and event' });
    }

    const doc = await UsageContractModel.create({
        userId,
        eventId,
        maxStands,
        status: status ?? 'active',
        startsAt: startsAt ?? null,
        endsAt: endsAt ?? null,
        notes: notes ?? null,
        createdBy: req.user.id,
    });

    return res.status(201).json({ item: toUsageContractResponse(doc) });
}

export async function getUsageContract(req: Request, res: Response) {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: 'Invalid contract id' });
    }

    const doc = await UsageContractModel.findById(id)
        .populate('userId', 'firstName lastName email')
        .populate('eventId', 'name')
        .populate('createdBy', 'firstName lastName')
        .lean();

    if (!doc) {
        return res.status(404).json({ message: 'Usage contract not found' });
    }

    return res.status(200).json({
        item: {
            ...toUsageContractResponse(doc as unknown as {
                _id: Types.ObjectId;
                userId: Types.ObjectId;
                eventId: Types.ObjectId;
                maxStands: number;
                status: string;
                startsAt: Date | null;
                endsAt: Date | null;
                notes: string | null;
                createdBy: Types.ObjectId;
                createdAt: Date;
                updatedAt: Date;
            }),
            user: (doc as Record<string, unknown>).userId as Record<string, unknown> ?? null,
            event: (doc as Record<string, unknown>).eventId as Record<string, unknown> ?? null,
            createdByUser: (doc as Record<string, unknown>).createdBy as Record<string, unknown> ?? null,
        }
    });
}

export async function updateUsageContract(req: Request, res: Response) {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: 'Invalid contract id' });
    }

    const doc = await UsageContractModel.findById(id);
    if (!doc) {
        return res.status(404).json({ message: 'Usage contract not found' });
    }

    const { maxStands, status, startsAt, endsAt, notes } = req.body;

    if (maxStands !== undefined) {
        if (typeof maxStands !== 'number' || maxStands < 1) {
            return res.status(400).json({ message: 'maxStands must be a number >= 1' });
        }
        doc.maxStands = maxStands;
    }

    if (status !== undefined) {
        if (!['active', 'suspended', 'expired'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        doc.status = status;
    }

    if (startsAt !== undefined) doc.startsAt = startsAt;
    if (endsAt !== undefined) doc.endsAt = endsAt;
    if (notes !== undefined) doc.notes = notes;

    await doc.save();

    return res.status(200).json({ item: toUsageContractResponse(doc) });
}

export async function deleteUsageContract(req: Request, res: Response) {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: 'Invalid contract id' });
    }

    const doc = await UsageContractModel.findByIdAndDelete(id);
    if (!doc) {
        return res.status(404).json({ message: 'Usage contract not found' });
    }

    return res.status(200).json({ message: 'Usage contract deleted' });
}

/** Check if a user is allowed to add a stand to an event based on their usage contract. */
export async function checkStandLimit(
    userId: string,
    eventId: string,
    standId: string
): Promise<{ allowed: boolean; message?: string }> {
    const contract = await UsageContractModel.findOne({
        userId,
        eventId,
        status: 'active',
    });

    if (!contract) {
        return { allowed: true };
    }

    const standRoleIds = await RoleModel.find({ scope: 'stand' }).select('_id').lean();
    const standRoleObjectIds = standRoleIds.map((r) => r._id);

    const existingStandRoles = await UserRoleModel.find({
        userId,
        roleId: { $in: standRoleObjectIds },
        isActive: true,
    }).select('standId').lean();

    const existingStandIds = new Set(
        existingStandRoles
            .map((r) => r.standId?.toString())
            .filter((id): id is string => id !== undefined && id !== standId)
    );

    /* also count stands directly via standId if this user has a role on the current stand */
    if (existingStandIds.size === 0 && existingStandRoles.some((r) => r.standId?.toString() === standId)) {
        /* user already has role on this stand — it's already counted in the existing roles */
    }

    const standsAtEvent = await StandModel.countDocuments({
        _id: { $in: Array.from(existingStandIds) },
        eventIds: eventId,
    });

    if (standsAtEvent >= contract.maxStands) {
        return {
            allowed: false,
            message: `L'utente ha già raggiunto il limite massimo di ${contract.maxStands} stand per questo evento`,
        };
    }

    return { allowed: true };
}
