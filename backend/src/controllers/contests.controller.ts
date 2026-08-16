import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import * as qrcode from 'qrcode';

import { ContestModel } from '../models/contest.model';
import { ContestPOIModel } from '../models/contest-poi.model';
import { ContestParticipationModel } from '../models/contest-participation.model';
import { POIModel } from '../models/poi.model';
import { StandModel } from '../models/stand.model';

const QR_OPTIONS = {
    width: 400,
    margin: 2,
    color: { dark: '#264137', light: '#ffffff' }
};

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function generateClaimCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function generateUniqueClaimCode(contestId: string): Promise<string> {
    let code: string;
    let exists: boolean;
    do {
        code = generateClaimCode();
        const found = await ContestParticipationModel.exists({ contestId, claimCode: code });
        exists = found !== null;
    } while (exists);
    return code;
}

// ── ContestPOI CRUD ──

// Sincronizza il pool dei POI del contest con tutti gli stand e tutti i POI dell'evento:
// garantisce che nel set di POI disponibili ci siano sempre TUTTI gli stand e i POI dell'evento.
// Non elimina mai nulla: aggiunge (o collega) i ContestPOI mancanti.
async function syncContestPoisForEvent(eventId: string) {
    const [stands, eventPois] = await Promise.all([
        StandModel.find({ eventIds: eventId }).select('name'),
        POIModel.find({ eventId }).select('name')
    ]);

    const existing = await ContestPOIModel.find({ eventId });
    const byStandId = new Map<string, (typeof existing)[number]>();
    const byPoiId = new Map<string, (typeof existing)[number]>();
    const byName = new Map<string, (typeof existing)[number]>();
    let maxOrder = 0;
    for (const cp of existing) {
        if (cp.standId) byStandId.set(cp.standId.toString(), cp);
        if (cp.poiId) byPoiId.set(cp.poiId.toString(), cp);
        byName.set(cp.name.toLowerCase(), cp);
        maxOrder = Math.max(maxOrder, cp.sequenceOrder ?? 0);
    }

    const linkFree = (cp: (typeof existing)[number], patch: { standId?: Types.ObjectId | null; poiId?: Types.ObjectId | null }) => {
        if (cp.standId || cp.poiId) return Promise.resolve();
        Object.assign(cp, patch);
        return cp.save();
    };

    const safeCreate = (data: Record<string, unknown>) =>
        ContestPOIModel.create(data).catch((err: unknown) => {
            if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) return null;
            throw err;
        });

    const operations: Promise<unknown>[] = [];

    for (const stand of stands) {
        if (byStandId.has(stand._id.toString())) continue;
        const nameConflict = byName.get(stand.name.toLowerCase());
        if (nameConflict) {
            operations.push(linkFree(nameConflict, { standId: stand._id }));
            continue;
        }
        maxOrder += 1;
        operations.push(safeCreate({
            eventId,
            standId: stand._id,
            poiId: null,
            name: stand.name,
            hints: [],
            groups: [],
            sequenceOrder: maxOrder
        }));
    }

    for (const poi of eventPois) {
        if (byPoiId.has(poi._id.toString())) continue;
        const nameConflict = byName.get(poi.name.toLowerCase());
        if (nameConflict) {
            operations.push(linkFree(nameConflict, { poiId: poi._id }));
            continue;
        }
        maxOrder += 1;
        operations.push(safeCreate({
            eventId,
            standId: null,
            poiId: poi._id,
            name: poi.name,
            hints: [],
            groups: [],
            sequenceOrder: maxOrder
        }));
    }

    await Promise.all(operations);
}

async function listContestPois(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};
    if (req.query.eventId) {
        if (!isValidObjectId(req.query.eventId as string)) {
            return res.status(400).json({ message: 'Invalid eventId' });
        }
        filter.eventId = req.query.eventId;
        // Il pool dei POI disponibili deve contenere TUTTI gli stand e i POI dell'evento.
        try {
            await syncContestPoisForEvent(req.query.eventId as string);
        } catch { /* un errore di sync non deve rompere la lista */ }
    }
    const items = await ContestPOIModel.find(filter).sort({ sequenceOrder: 1, name: 1 });
    return res.status(200).json({ items: items.map(toCpoiResponse) });
}

function toCpoiResponse(cpoi: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    standId?: Types.ObjectId | null;
    poiId?: Types.ObjectId | null;
    name: string;
    hints?: string[];
    groups?: string[];
    sequenceOrder?: number;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: cpoi._id.toString(),
        eventId: cpoi.eventId.toString(),
        standId: cpoi.standId ? cpoi.standId.toString() : null,
        poiId: cpoi.poiId ? cpoi.poiId.toString() : null,
        name: cpoi.name,
        hints: cpoi.hints ?? [],
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
    const { eventId, standId, poiId, name, hints, groups } = req.body;
    if (!eventId || !isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Valid eventId is required' });
    }
    if (standId !== undefined && standId !== null && poiId !== undefined && poiId !== null) {
        return res.status(400).json({ message: 'Cannot link a contest POI to both a stand and a POI' });
    }

    let standObjectId: Types.ObjectId | null = null;
    let poiObjectId: Types.ObjectId | null = null;
    let autoName: string | null = null;
    if (standId !== undefined && standId !== null) {
        if (!isValidObjectId(standId)) {
            return res.status(400).json({ message: 'Valid standId is required' });
        }
        const stand = await StandModel.findOne({ _id: standId, eventIds: eventId });
        if (!stand) {
            return res.status(400).json({ message: 'Stand not found for this event' });
        }
        standObjectId = new Types.ObjectId(standId);
        autoName = stand.name;
    } else if (poiId !== undefined && poiId !== null) {
        if (!isValidObjectId(poiId)) {
            return res.status(400).json({ message: 'Valid poiId is required' });
        }
        const eventPoi = await POIModel.findOne({ _id: poiId, eventId });
        if (!eventPoi) {
            return res.status(400).json({ message: 'POI not found for this event' });
        }
        poiObjectId = new Types.ObjectId(poiId);
        autoName = eventPoi.name;
    }

    const finalName = name && typeof name === 'string' && name.trim() ? name.trim() : autoName;
    if (!finalName) {
        return res.status(400).json({ message: 'Name is required' });
    }

    const maxOrder = await ContestPOIModel.findOne({ eventId }).sort({ sequenceOrder: -1 }).select('sequenceOrder');
    const poi = await ContestPOIModel.create({
        eventId,
        standId: standObjectId,
        poiId: poiObjectId,
        name: finalName,
        hints: Array.isArray(hints) ? hints.filter((h: string) => typeof h === 'string' && h.trim()).map((h: string) => h.trim()) : [],
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
    const { name, hints, groups, sequenceOrder, standId, poiId: eventPoiId } = req.body;
    if (name !== undefined) poi.name = name.trim();
    if (hints !== undefined) poi.hints = Array.isArray(hints) ? hints.filter((h: string) => typeof h === 'string' && h.trim()).map((h: string) => h.trim()) : [];
    if (groups !== undefined) poi.groups = Array.isArray(groups) ? groups.filter((g: string) => typeof g === 'string' && g.trim()) : [];
    if (sequenceOrder !== undefined) poi.sequenceOrder = sequenceOrder;

    const linkStand = async (value: string) => {
        if (!isValidObjectId(value)) {
            return { error: 'Valid standId is required' };
        }
        const stand = await StandModel.findOne({ _id: value, eventIds: poi.eventId });
        if (!stand) {
            return { error: 'Stand not found for this event' };
        }
        poi.standId = new Types.ObjectId(value);
        if (name === undefined) poi.name = stand.name;
        return {};
    };

    const linkPoi = async (value: string) => {
        if (!isValidObjectId(value)) {
            return { error: 'Valid poiId is required' };
        }
        const eventPoi = await POIModel.findOne({ _id: value, eventId: poi.eventId });
        if (!eventPoi) {
            return { error: 'POI not found for this event' };
        }
        poi.poiId = new Types.ObjectId(value);
        if (name === undefined) poi.name = eventPoi.name;
        return {};
    };

    if (standId !== undefined) {
        if (standId === null) {
            poi.standId = null;
        } else {
            const resLink = await linkStand(standId);
            if (resLink.error) return res.status(400).json({ message: resLink.error });
        }
    }
    if (eventPoiId !== undefined) {
        if (eventPoiId === null) {
            poi.poiId = null;
        } else {
            if (poi.standId && !(standId === null)) {
                return res.status(400).json({ message: 'Cannot link a contest POI to both a stand and a POI' });
            }
            const resLink = await linkPoi(eventPoiId);
            if (resLink.error) return res.status(400).json({ message: resLink.error });
        }
    }
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
    startsAt?: Date | null;
    endsAt?: Date | null;
    durationMinutes: number;
    requireSequence?: boolean;
    prizes?: Array<{ label: string; awarded: boolean }>;
    isActive?: boolean;
    orderedPOIIds?: Types.ObjectId[];
    pickConfig?: { groupPicks: Array<{ group: string; count: number }> } | null;
    autoPickedPOIIds?: Types.ObjectId[];
    poiHintSelections?: Array<{ poiId: Types.ObjectId; hintIndex: number }>;
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
        poiHintSelections: (contest.poiHintSelections ?? []).map((s) => ({
            poiId: s.poiId.toString(),
            hintIndex: s.hintIndex
        })),
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

    const pois = await ContestPOIModel.find({ _id: { $in: contest.orderedPOIIds } });
    const poiMap = new Map(pois.map((p) => [p._id.toString(), p]));
    const standIds = [...new Set(pois.filter((p) => p.standId).map((p) => (p.standId as Types.ObjectId).toString()))];
    const stands = standIds.length > 0 ? await StandModel.find({ _id: { $in: standIds } }).select('name') : [];
    const standNameMap = new Map(stands.map((s) => [s._id.toString(), s.name]));
    const eventPoiIds = [...new Set(pois.filter((p) => p.poiId).map((p) => (p.poiId as Types.ObjectId).toString()))];
    const eventPois = eventPoiIds.length > 0 ? await POIModel.find({ _id: { $in: eventPoiIds } }).select('name') : [];
    const eventPoiNameMap = new Map(eventPois.map((s) => [s._id.toString(), s.name]));
    const hintSelectionMap = new Map(
        (contest.poiHintSelections ?? []).map((s) => [s.poiId.toString(), s.hintIndex])
    );
    const poisResponse = contest.orderedPOIIds.map((id) => {
        const p = poiMap.get(id.toString());
        if (!p) return null;
        const idx = hintSelectionMap.get(p._id.toString()) ?? 0;
        const standId = p.standId ? p.standId.toString() : null;
        const poiRef = p.poiId ? (eventPoiNameMap.get(p.poiId.toString()) ?? p.name) : p.name;
        return {
            id: p._id.toString(),
            name: standId ? (standNameMap.get(standId) ?? p.name) : poiRef,
            hint: (p.hints && p.hints.length > 0 && idx < p.hints.length) ? p.hints[idx] : null,
            standId,
            poiId: p.poiId ? p.poiId.toString() : null
        };
    }).filter(Boolean);

    return res.status(200).json({ item: contestData, pois: poisResponse });
}

async function createContest(req: Request, res: Response) {
    const {
        eventId, name, description,
        startsAt, endsAt, durationMinutes,
        requireSequence, prizes, isActive, orderedPOIIds, pickConfig, poiHintSelections
    } = req.body;

    if (!eventId || !isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Valid eventId is required' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Name is required' });
    }
    if (!durationMinutes || durationMinutes < 1) {
        return res.status(400).json({ message: 'durationMinutes must be >= 1' });
    }

    const startDate = startsAt ? new Date(startsAt) : null;
    const endDate = startDate ? (endsAt ? new Date(endsAt) : new Date(startDate.getTime() + durationMinutes * 60 * 1000)) : null;

    if (prizes && !Array.isArray(prizes)) {
        return res.status(400).json({ message: 'prizes must be an array' });
    }

    let poIds: string[] = orderedPOIIds ?? [];
    const autoPicked: string[] = [];

    if (pickConfig?.groupPicks?.length > 0) {
        const excludedIds = new Set(poIds);
        const resultIds = [...poIds];
        for (const gp of pickConfig.groupPicks) {
            const available = await ContestPOIModel.find({
                eventId,
                groups: { $in: [gp.group] },
                _id: { $nin: [...excludedIds].map((id) => new Types.ObjectId(id)) }
            });
            const shuffled = [...available].sort(() => Math.random() - 0.5);
            for (let i = 0; i < gp.count; i++) {
                const p = shuffled[i % shuffled.length];
                if (!p) break;
                const id = p._id.toString();
                resultIds.push(id);
                autoPicked.push(id);
                excludedIds.add(id);
            }
        }
        poIds = resultIds;
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
        autoPickedPOIIds: autoPicked.map((id) => new Types.ObjectId(id)),
        poiHintSelections: Array.isArray(poiHintSelections) ? poiHintSelections.filter((s: { poiId: string; hintIndex: number }) => isValidObjectId(s.poiId)).map((s: { poiId: string; hintIndex: number }) => ({ poiId: new Types.ObjectId(s.poiId), hintIndex: s.hintIndex })) : []
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
        requireSequence, prizes, isActive, orderedPOIIds, pickConfig, poiHintSelections
    } = req.body;

    if (name !== undefined) contest.name = name.trim();
    if (description !== undefined) contest.description = description;
    if (startsAt !== undefined) contest.startsAt = startsAt === null ? null : new Date(startsAt);
    if (durationMinutes !== undefined) contest.durationMinutes = durationMinutes;

    if (endsAt !== undefined) {
        contest.endsAt = endsAt === null ? null : new Date(endsAt);
    } else if (contest.startsAt && (startsAt !== undefined || durationMinutes !== undefined)) {
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
            const excludedIds = new Set(manualSet);
            const resultIds = [...manualSet];
            for (const gp of pickConfig.groupPicks) {
                const available = await ContestPOIModel.find({
                    eventId: contest.eventId,
                    groups: { $in: [gp.group] },
                    _id: { $nin: [...excludedIds].map((id) => new Types.ObjectId(id)) }
                });
                const shuffled = [...available].sort(() => Math.random() - 0.5);
                for (let i = 0; i < gp.count; i++) {
                    const p = shuffled[i % shuffled.length];
                    if (!p) break;
                    const id = p._id.toString();
                    resultIds.push(id);
                    newAuto.push(id);
                    excludedIds.add(id);
                }
            }
            contest.orderedPOIIds = resultIds.map((id) => new Types.ObjectId(id));
        } else {
            contest.orderedPOIIds = [...manualSet].map((id) => new Types.ObjectId(id));
        }
        contest.autoPickedPOIIds = newAuto.map((id) => new Types.ObjectId(id));
        contest.pickConfig = pickConfig;
    } else if (orderedPOIIds !== undefined) {
        contest.orderedPOIIds = orderedPOIIds.filter((id: string) => isValidObjectId(id)).map((id: string) => new Types.ObjectId(id));
    }

    if (poiHintSelections !== undefined) {
        const selections = Array.isArray(poiHintSelections)
            ? poiHintSelections.filter((s: { poiId: string; hintIndex: number }) => isValidObjectId(s.poiId))
                .map((s: { poiId: string; hintIndex: number }) => ({ poiId: new Types.ObjectId(s.poiId), hintIndex: s.hintIndex }))
            : [];
        contest.set('poiHintSelections', selections);
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

async function startContest(req: Request, res: Response) {
    const contestId = req.params.contestId;
    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }
    const contest = await ContestModel.findById(contestId);
    if (!contest) {
        return res.status(404).json({ message: 'Contest not found' });
    }

    const now = new Date();
    contest.startsAt = now;
    contest.endsAt = new Date(now.getTime() + contest.durationMinutes * 60 * 1000);
    contest.isActive = true;
    for (const prize of contest.prizes) {
        prize.awarded = false;
    }

    const uniquePoiIds = [...new Set(contest.orderedPOIIds.map((id) => id.toString()))];
    const pois = await ContestPOIModel.find({ _id: { $in: uniquePoiIds } });
    const poiHintSelections = pois.map((p) => {
        const hintCount = (p.hints ?? []).length;
        return { poiId: p._id, hintIndex: hintCount > 0 ? Math.floor(Math.random() * hintCount) : 0 };
    });
    contest.set('poiHintSelections', poiHintSelections);

    await ContestParticipationModel.deleteMany({ contestId });
    await contest.save();

    return res.status(200).json({ item: toContestResponse(contest) });
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
    if (!contest.startsAt || now < contest.startsAt) {
        return res.status(400).json({ message: 'Contest has not started yet' });
    }
    if (contest.endsAt && now > contest.endsAt) {
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
            isWinner: null,
            claimCode: await generateUniqueClaimCode(contestId)
        });
    }

    if (participation.completedAt || participation.isWinner !== null) {
        return res.status(400).json({ message: 'Participation already completed' });
    }

    const orderedCount = contest.orderedPOIIds.filter((id) => id.toString() === poiId).length;
    const scannedCount = participation.scannedPOIIds.filter((id) => id.toString() === poiId).length;
    if (scannedCount >= orderedCount) {
        return res.status(400).json({ message: 'All occurrences of this POI have already been scanned' });
    }

    if (contest.requireSequence) {
        const expectedPoiId = contest.orderedPOIIds[participation.scannedPOIIds.length]?.toString();
        if (expectedPoiId !== poiId) {
            return res.status(400).json({ message: 'Wrong POI order. Scan the correct POI first.' });
        }
    }

    participation.scannedPOIIds.push(poiObjectId);

    await participation.save();
    return res.status(200).json(getParticipationState(participation));
}

async function completeParticipation(req: Request, res: Response) {
    const contestId = req.params.contestId;
    const { participantId } = req.body;

    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }
    if (!participantId || typeof participantId !== 'string') {
        return res.status(400).json({ message: 'participantId is required' });
    }

    const contest = await ContestModel.findById(contestId);
    if (!contest) {
        return res.status(404).json({ message: 'Contest not found' });
    }
    if (!contest.isActive) {
        return res.status(400).json({ message: 'Contest is not active' });
    }

    const now = new Date();
    if (!contest.startsAt || now < contest.startsAt) {
        return res.status(400).json({ message: 'Contest has not started yet' });
    }
    if (contest.endsAt && now > contest.endsAt) {
        return res.status(400).json({ message: 'Contest has ended' });
    }

    const participation = await ContestParticipationModel.findOne({ contestId, participantId });
    if (!participation) {
        return res.status(404).json({ message: 'Participation not found' });
    }
    if (participation.completedAt || participation.isWinner !== null) {
        return res.status(400).json({ message: 'Participation already completed' });
    }

    const allScanned = participation.scannedPOIIds.length === contest.orderedPOIIds.length;
    if (!allScanned) {
        return res.status(400).json({ message: 'Not all POIs have been scanned yet' });
    }

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
        participation.isWinner = true;
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

// ── Claim Code ──

async function getParticipationByClaimCode(req: Request, res: Response) {
    const contestId = req.params.contestId;
    const claimCode = req.params.claimCode;

    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }
    if (!claimCode || typeof claimCode !== 'string') {
        return res.status(400).json({ message: 'claimCode is required' });
    }

    const participation = await ContestParticipationModel.findOne({ contestId, claimCode: claimCode.toUpperCase() });
    if (!participation) {
        return res.status(404).json({ message: 'Claim code not found' });
    }

    return res.status(200).json(getParticipationState(participation));
}

async function getClaimQrCode(req: Request, res: Response) {
    const contestId = req.params.contestId;
    const claimCode = req.params.claimCode;

    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }
    if (!claimCode || typeof claimCode !== 'string') {
        return res.status(400).json({ message: 'claimCode is required' });
    }

    const participation = await ContestParticipationModel.findOne({ contestId, claimCode: claimCode.toUpperCase() });
    if (!participation) {
        return res.status(404).json({ message: 'Claim code not found' });
    }

    const origin = req.headers.origin ?? `${req.protocol}://${req.headers.host}`;
    const url = `${origin}/contest/${contestId}/consegna?claimCode=${claimCode.toUpperCase()}`;

    const qrDataUrl = await qrcode.toDataURL(url, QR_OPTIONS);

    return res.status(200).json({ qrCode: qrDataUrl });
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
    claimCode?: string | null;
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
        deviceName: participation.deviceName ?? null,
        claimCode: participation.claimCode ?? null
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

    const uniquePoiIds = [...new Set(contest.orderedPOIIds.map((id) => id.toString()))];
    const pois = await ContestPOIModel.find({ _id: { $in: uniquePoiIds } });
    const poiMap = new Map(pois.map((p) => [p._id.toString(), p]));
    const standIds = [...new Set(pois.filter((p) => p.standId).map((p) => (p.standId as Types.ObjectId).toString()))];
    const stands = standIds.length > 0 ? await StandModel.find({ _id: { $in: standIds } }).select('name') : [];
    const standNameMap = new Map(stands.map((s) => [s._id.toString(), s.name]));
    const eventPoiIds = [...new Set(pois.filter((p) => p.poiId).map((p) => (p.poiId as Types.ObjectId).toString()))];
    const eventPois = eventPoiIds.length > 0 ? await POIModel.find({ _id: { $in: eventPoiIds } }).select('name') : [];
    const eventPoiNameMap = new Map(eventPois.map((s) => [s._id.toString(), s.name]));
    const origin = req.headers.origin ?? `${req.protocol}://${req.get('host')}`;

    const items = await Promise.all(uniquePoiIds.map(async (id) => {
        const poi = poiMap.get(id);
        if (!poi) return null;
        const standId = poi.standId ? poi.standId.toString() : null;
        // POI collegato a uno stand: il QR resta quello dello stand nell'evento
        const scanUrl = standId
            ? `${origin}/events/${contest.eventId}/stands/${standId}`
            : `${origin}/contest/${contestId}/play?poi=${poi._id}`;
        const qrCode = await qrcode.toDataURL(scanUrl, QR_OPTIONS);
        return {
            poiId: poi._id.toString(),
            poiName: standId
                ? (standNameMap.get(standId) ?? poi.name)
                : (poi.poiId ? (eventPoiNameMap.get(poi.poiId.toString()) ?? poi.name) : poi.name),
            standId,
            eventPoiId: poi.poiId ? poi.poiId.toString() : null,
            qrCode
        };
    }));

    return res.status(200).json({ items: items.filter(Boolean) });
}

// ── Leaderboard ──

async function getContestLeaderboard(req: Request, res: Response) {
    const contestId = req.params.contestId;
    if (!isValidObjectId(contestId)) {
        return res.status(400).json({ message: 'Invalid contest id' });
    }

    const contest = await ContestModel.findById(contestId);
    if (!contest) {
        return res.status(404).json({ message: 'Contest not found' });
    }

    const totalPOIs = contest.orderedPOIIds.length;

    const participations = await ContestParticipationModel.find({
        contestId,
        completedAt: { $ne: null }
    }).sort({ completedAt: 1 });

    const items = participations.map((p, i) => ({
        position: i + 1,
        participantId: p.participantId,
        scannedCount: p.scannedPOIIds.length,
        totalPOIs,
        completedAt: p.completedAt,
        isWinner: p.isWinner,
        prizeAwarded: p.prizeAwarded,
        awardedPrizeLabel: p.awardedPrizeLabel ?? null,
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
    startContest,
    // Scan
    registerScan,
    completeParticipation,
    getParticipation,
    getParticipationByClaimCode,
    getClaimQrCode,
    awardPrize,
    getContestStatus,
    // QR
    getContestPoiQrCodes,
    // Leaderboard
    getContestLeaderboard
};
