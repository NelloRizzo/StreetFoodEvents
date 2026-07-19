import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import * as qrcode from 'qrcode';

import { ContestModel } from '../models/contest.model';
import { ContestPOIModel } from '../models/contest-poi.model';
import { ContestParticipationModel } from '../models/contest-participation.model';

const QR_OPTIONS = {
    width: 400,
    margin: 2,
    color: { dark: '#264137', light: '#ffffff' }
};

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

// ── ContestPOI CRUD ──

async function listContestPois(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};
    if (req.query.eventId) {
        if (!isValidObjectId(req.query.eventId as string)) {
            return res.status(400).json({ message: 'Invalid eventId' });
        }
        filter.eventId = req.query.eventId;
    }
    const items = await ContestPOIModel.find(filter).sort({ sequenceOrder: 1, name: 1 });
    return res.status(200).json({ items: items.map(toCpoiResponse) });
}

function toCpoiResponse(cpoi: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    name: string;
    hint?: string | null;
    groups?: string[];
    sequenceOrder?: number;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: cpoi._id.toString(),
        eventId: cpoi.eventId.toString(),
        name: cpoi.name,
        hint: cpoi.hint ?? null,
        groups: cpoi.groups ?? [],
        sequenceOrder: cpoi.sequenceOrder ?? 0,
        createdAt: cpoi.createdAt,
        updatedAt: cpoi.updatedAt
    };
}

async function getContestPoi(req: Request, res: Response) {
    const poiId = req.params.poiId;
    if (!isValidObjectId(poiId)) {
        return res.status(400).json({ message: 'Invalid poi id' });
    }
    const poi = await ContestPOIModel.findById(poiId);
    if (!poi) {
        return res.status(404).json({ message: 'Contest POI not found' });
    }
    return res.status(200).json({ item: toCpoiResponse(poi) });
}

async function createContestPoi(req: Request, res: Response) {
    const { eventId, name, hint, groups } = req.body;
    if (!eventId || !isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Valid eventId is required' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Name is required' });
    }

    const maxOrder = await ContestPOIModel.findOne({ eventId }).sort({ sequenceOrder: -1 }).select('sequenceOrder');
    const poi = await ContestPOIModel.create({
        eventId,
        name: name.trim(),
        hint: hint ?? null,
        groups: Array.isArray(groups) ? groups.filter((g: string) => typeof g === 'string' && g.trim()) : [],
        sequenceOrder: (maxOrder?.sequenceOrder ?? 0) + 1
    });

    return res.status(201).json({ item: toCpoiResponse(poi) });
}

async function updateContestPoi(req: Request, res: Response) {
    const poiId = req.params.poiId;
    if (!isValidObjectId(poiId)) {
        return res.status(400).json({ message: 'Invalid poi id' });
    }
    const poi = await ContestPOIModel.findById(poiId);
    if (!poi) {
        return res.status(404).json({ message: 'Contest POI not found' });
    }
    const { name, hint, groups, sequenceOrder } = req.body;
    if (name !== undefined) poi.name = name.trim();
    if (hint !== undefined) poi.hint = hint;
    if (groups !== undefined) poi.groups = Array.isArray(groups) ? groups.filter((g: string) => typeof g === 'string' && g.trim()) : [];
    if (sequenceOrder !== undefined) poi.sequenceOrder = sequenceOrder;
    await poi.save();
    return res.status(200).json({ item: toCpoiResponse(poi) });
}

async function deleteContestPoi(req: Request, res: Response) {
    const poiId = req.params.poiId;
    if (!isValidObjectId(poiId)) {
        return res.status(400).json({ message: 'Invalid poi id' });
    }
    const poi = await ContestPOIModel.findByIdAndDelete(poiId);
    if (!poi) {
        return res.status(404).json({ message: 'Contest POI not found' });
    }
    return res.status(204).send();
}

// ── Contest CRUD ──

function toContestResponse(contest: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    name: string;
    description?: string | null;
    startsAt: Date;
    endsAt: Date;
    durationMinutes: number;
    requireSequence?: boolean;
    prizes?: Array<{ label: string; awarded: boolean }>;
    isActive?: boolean;
    orderedPOIIds?: Types.ObjectId[];
    pickConfig?: { groupPicks: Array<{ group: string; count: number }> } | null;
    autoPickedPOIIds?: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}) {
    const prizes = contest.prizes ?? [];
    return {
        id: contest._id.toString(),
        eventId: contest.eventId.toString(),
        name: contest.name,
        description: contest.description ?? null,
        startsAt: contest.startsAt,
        endsAt: contest.endsAt,
        durationMinutes: contest.durationMinutes,
        requireSequence: contest.requireSequence ?? false,
        prizes: prizes.map((p) => ({ label: p.label, awarded: p.awarded })),
        awardedPrizesCount: prizes.filter((p) => p.awarded).length,
        isActive: contest.isActive ?? true,
        orderedPOIIds: (contest.orderedPOIIds ?? []).map((id) => id.toString()),
        pickConfig: contest.pickConfig ?? null,
        autoPickedPOIIds: (contest.autoPickedPOIIds ?? []).map((id) => id.toString()),
        createdAt: contest.createdAt,
        updatedAt: contest.updatedAt
    };
}

async function listContests(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};
    if (req.query.eventId) {
        if (!isValidObjectId(req.query.eventId as string)) {
            return res.status(400).json({ message: 'Invalid eventId' });
        }
        filter.eventId = req.query.eventId;
    }
    const items = await ContestModel.find(filter).sort({ startsAt: -1 });
    return res.status(200).json({ items: items.map(toContestResponse) });
}

async function getContest(req: Request, res: Response) {
    const contestId = req.params.contestId;
    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }
    const contest = await ContestModel.findById(contestId);
    if (!contest) {
        return res.status(404).json({ message: 'Contest not found' });
    }
    const contestData = toContestResponse(contest);

    const pois = await ContestPOIModel.find({ _id: { $in: contest.orderedPOIIds } }).sort({ sequenceOrder: 1 });
    const poisResponse = pois.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        hint: p.hint ?? null
    }));

    return res.status(200).json({ item: contestData, pois: poisResponse });
}

async function createContest(req: Request, res: Response) {
    const {
        eventId, name, description,
        startsAt, endsAt, durationMinutes,
        requireSequence, prizes, isActive, orderedPOIIds, pickConfig
    } = req.body;

    if (!eventId || !isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Valid eventId is required' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Name is required' });
    }
    if (!startsAt) {
        return res.status(400).json({ message: 'startsAt is required' });
    }
    if (!durationMinutes || durationMinutes < 1) {
        return res.status(400).json({ message: 'durationMinutes must be >= 1' });
    }

    const startDate = new Date(startsAt);
    const endDate = endsAt ? new Date(endsAt) : new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    if (prizes && !Array.isArray(prizes)) {
        return res.status(400).json({ message: 'prizes must be an array' });
    }

    let poIds: string[] = orderedPOIIds ?? [];
    let autoPicked: string[] = [];

    if (pickConfig?.groupPicks?.length > 0) {
        const pool = new Set(poIds);
        for (const gp of pickConfig.groupPicks) {
            const available = await ContestPOIModel.find({
                eventId,
                groups: { $in: [gp.group] },
                _id: { $nin: [...pool].map((id) => new Types.ObjectId(id)) }
            });
            const shuffled = [...available].sort(() => Math.random() - 0.5);
            const picked = shuffled.slice(0, gp.count);
            for (const p of picked) {
                const id = p._id.toString();
                pool.add(id);
                autoPicked.push(id);
            }
        }
        poIds = [...pool];
    }

    const contest = await ContestModel.create({
        eventId,
        name: name.trim(),
        description: description ?? null,
        startsAt: startDate,
        endsAt: endDate,
        durationMinutes,
        requireSequence: requireSequence ?? false,
        prizes: (prizes ?? []).map((p: { label: string }) => ({ label: p.label, awarded: false })),
        isActive: isActive ?? true,
        orderedPOIIds: poIds.map((id) => new Types.ObjectId(id)),
        pickConfig: pickConfig ?? null,
        autoPickedPOIIds: autoPicked.map((id) => new Types.ObjectId(id))
    });

    return res.status(201).json({ item: toContestResponse(contest) });
}

async function updateContest(req: Request, res: Response) {
    const contestId = req.params.contestId;
    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }
    const contest = await ContestModel.findById(contestId);
    if (!contest) {
        return res.status(404).json({ message: 'Contest not found' });
    }
    const {
        name, description, startsAt, endsAt, durationMinutes,
        requireSequence, prizes, isActive, orderedPOIIds, pickConfig
    } = req.body;

    if (name !== undefined) contest.name = name.trim();
    if (description !== undefined) contest.description = description;
    if (startsAt !== undefined) contest.startsAt = new Date(startsAt);
    if (durationMinutes !== undefined) contest.durationMinutes = durationMinutes;

    if (endsAt !== undefined) {
        contest.endsAt = new Date(endsAt);
    } else if (startsAt !== undefined || durationMinutes !== undefined) {
        contest.endsAt = new Date(contest.startsAt.getTime() + contest.durationMinutes * 60 * 1000);
    }
    if (requireSequence !== undefined) contest.requireSequence = requireSequence;
    if (prizes !== undefined) {
        contest.prizes = prizes.map((p: { label: string; awarded?: boolean }) => ({ label: p.label, awarded: p.awarded ?? false }));
    }
    if (isActive !== undefined) contest.isActive = isActive;

    if (pickConfig !== undefined) {
        const oldAutoSet = new Set(
            (contest.autoPickedPOIIds ?? []).map((id) => id.toString())
        );
        const bodyIds = (orderedPOIIds ?? []).filter((id: string) => isValidObjectId(id));

        const manualSet = new Set<string>();
        for (const id of bodyIds) {
            if (!oldAutoSet.has(id)) manualSet.add(id);
        }
        for (const id of (contest.orderedPOIIds ?? []).map((id) => id.toString())) {
            if (!oldAutoSet.has(id)) manualSet.add(id);
        }

        const newAuto: string[] = [];
        if (pickConfig?.groupPicks?.length > 0) {
            const pool = new Set(manualSet);
            for (const gp of pickConfig.groupPicks) {
                const available = await ContestPOIModel.find({
                    eventId: contest.eventId,
                    groups: { $in: [gp.group] },
                    _id: { $nin: [...pool].map((id) => new Types.ObjectId(id)) }
                });
                const shuffled = [...available].sort(() => Math.random() - 0.5);
                const picked = shuffled.slice(0, gp.count);
                for (const p of picked) {
                    const id = p._id.toString();
                    pool.add(id);
                    newAuto.push(id);
                }
            }
            contest.orderedPOIIds = [...pool].map((id) => new Types.ObjectId(id));
        } else {
            contest.orderedPOIIds = [...manualSet].map((id) => new Types.ObjectId(id));
        }
        contest.autoPickedPOIIds = newAuto.map((id) => new Types.ObjectId(id));
        contest.pickConfig = pickConfig;
    } else if (orderedPOIIds !== undefined) {
        contest.orderedPOIIds = orderedPOIIds.filter((id: string) => isValidObjectId(id)).map((id: string) => new Types.ObjectId(id));
    }

    await contest.save();
    return res.status(200).json({ item: toContestResponse(contest) });
}

async function deleteContest(req: Request, res: Response) {
    const contestId = req.params.contestId;
    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }
    const contest = await ContestModel.findByIdAndDelete(contestId);
    if (!contest) {
        return res.status(404).json({ message: 'Contest not found' });
    }
    await ContestParticipationModel.deleteMany({ contestId });
    return res.status(204).send();
}

// ── Participation & Scan ──

async function registerScan(req: Request, res: Response) {
    const contestId = req.params.contestId;
    const { participantId, poiId } = req.body;

    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }
    if (!participantId || typeof participantId !== 'string') {
        return res.status(400).json({ message: 'participantId is required' });
    }
    if (!poiId || !isValidObjectId(poiId)) {
        return res.status(400).json({ message: 'Valid poiId is required' });
    }

    const contest = await ContestModel.findById(contestId);
    if (!contest) {
        return res.status(404).json({ message: 'Contest not found' });
    }
    if (!contest.isActive) {
        return res.status(400).json({ message: 'Contest is not active' });
    }

    const now = new Date();
    if (now < contest.startsAt) {
        return res.status(400).json({ message: 'Contest has not started yet' });
    }
    if (now > contest.endsAt) {
        return res.status(400).json({ message: 'Contest has ended' });
    }

    const poiObjectId = new Types.ObjectId(poiId);
    if (!contest.orderedPOIIds.some((id) => id.toString() === poiId)) {
        return res.status(400).json({ message: 'POI is not part of this contest' });
    }

    let participation = await ContestParticipationModel.findOne({ contestId, participantId });

    if (!participation) {
        participation = await ContestParticipationModel.create({
            contestId,
            participantId,
            scannedPOIIds: [],
            startedAt: now,
            completedAt: null,
            isWinner: null
        });
    }

    if (participation.completedAt || participation.isWinner !== null) {
        return res.status(400).json({ message: 'Participation already completed' });
    }

    const elapsed = (now.getTime() - participation.startedAt.getTime()) / 60000;
    if (elapsed > contest.durationMinutes) {
        participation.completedAt = now;
        participation.isWinner = false;
        await participation.save();
        return res.status(400).json({ message: 'Time expired', state: getParticipationState(participation) });
    }

    if (participation.scannedPOIIds.some((id) => id.toString() === poiId)) {
        return res.status(400).json({ message: 'POI already scanned' });
    }

    if (contest.requireSequence) {
        const nextIndex = participation.scannedPOIIds.length;
        const expectedPoiId = contest.orderedPOIIds[nextIndex];
        if (!expectedPoiId || expectedPoiId.toString() !== poiId) {
            return res.status(400).json({ message: 'Wrong POI order. Scan the correct POI first.' });
        }
    }

    participation.scannedPOIIds.push(poiObjectId);

    const allScanned = participation.scannedPOIIds.length === contest.orderedPOIIds.length;

    if (allScanned) {
        participation.completedAt = now;
        const prize = (contest.prizes ?? []).find((p) => !p.awarded);
        if (prize) {
            participation.isWinner = true;
            participation.awardedPrizeLabel = prize.label;
            prize.awarded = true;

            const allAwarded = (contest.prizes ?? []).every((p) => p.awarded);
            if (allAwarded) {
                contest.isActive = false;
            }
            await contest.save();
        } else {
            participation.isWinner = false;
        }
    }

    await participation.save();
    return res.status(200).json(getParticipationState(participation));
}

async function getParticipation(req: Request, res: Response) {
    const contestId = req.params.contestId;
    const participantId = req.params.participantId;

    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }
    if (!participantId) {
        return res.status(400).json({ message: 'participantId is required' });
    }

    const participation = await ContestParticipationModel.findOne({ contestId, participantId });
    if (!participation) {
        return res.status(404).json({ message: 'Participation not found' });
    }

    return res.status(200).json(getParticipationState(participation));
}

function getParticipationState(participation: {
    _id: Types.ObjectId;
    contestId: Types.ObjectId;
    participantId: string;
    scannedPOIIds: Types.ObjectId[];
    startedAt: Date;
    completedAt?: Date | null;
    isWinner?: boolean | null;
    prizeAwarded?: boolean;
    deviceName?: string | null;
    awardedPrizeLabel?: string | null;
}) {
    return {
        id: participation._id.toString(),
        contestId: participation.contestId.toString(),
        participantId: participation.participantId,
        scannedPOIIds: participation.scannedPOIIds.map((id) => id.toString()),
        startedAt: participation.startedAt,
        completedAt: participation.completedAt,
        isWinner: participation.isWinner,
        prizeAwarded: participation.prizeAwarded ?? false,
        awardedPrizeLabel: participation.awardedPrizeLabel ?? null,
        deviceName: participation.deviceName ?? null
    };
}

async function awardPrize(req: Request, res: Response) {
    const contestId = req.params.contestId;
    const participantId = req.params.participantId;

    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }
    if (!participantId) {
        return res.status(400).json({ message: 'participantId is required' });
    }

    const participation = await ContestParticipationModel.findOne({ contestId, participantId });
    if (!participation) {
        return res.status(404).json({ message: 'Participation not found' });
    }
    if (participation.isWinner !== true) {
        return res.status(400).json({ message: 'Cannot award prize: participant did not win' });
    }
    if (participation.prizeAwarded) {
        return res.status(400).json({ message: 'Prize already awarded' });
    }

    participation.prizeAwarded = true;
    await participation.save();
    return res.status(200).json(getParticipationState(participation));
}

async function getContestStatus(req: Request, res: Response) {
    const contestId = req.params.contestId;
    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }
    const contest = await ContestModel.findById(contestId);
    if (!contest) {
        return res.status(404).json({ message: 'Contest not found' });
    }

    const prizes = contest.prizes ?? [];
    return res.status(200).json({
        prizes: prizes.map((p) => ({ label: p.label, awarded: p.awarded })),
        awardedPrizesCount: prizes.filter((p) => p.awarded).length,
        totalPrizes: prizes.length,
        isActive: contest.isActive,
        endsAt: contest.endsAt
    });
}

// ── POI QR Codes ──

async function getContestPoiQrCodes(req: Request, res: Response) {
    const contestId = req.params.contestId;
    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }
    const contest = await ContestModel.findById(contestId);
    if (!contest) {
        return res.status(404).json({ message: 'Contest not found' });
    }

    const pois = await ContestPOIModel.find({ _id: { $in: contest.orderedPOIIds } }).sort({ sequenceOrder: 1 });
    const origin = `${req.protocol}://${req.get('host')}`;

    const items = await Promise.all(pois.map(async (poi) => {
        const scanUrl = `${origin}/contest/${contestId}/play?poi=${poi._id}`;
        const qrCode = await qrcode.toDataURL(scanUrl, QR_OPTIONS);
        return {
            poiId: poi._id.toString(),
            poiName: poi.name,
            qrCode
        };
    }));

    return res.status(200).json({ items });
}

export const contestsController = {
    // ContestPOI
    listContestPois,
    getContestPoi,
    createContestPoi,
    updateContestPoi,
    deleteContestPoi,
    // Contest
    listContests,
    getContest,
    createContest,
    updateContest,
    deleteContest,
    // Scan
    registerScan,
    getParticipation,
    awardPrize,
    getContestStatus,
    // QR
    getContestPoiQrCodes
};
