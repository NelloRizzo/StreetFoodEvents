import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { EventModel } from '../models/event.model';
import { RoleModel } from '../models/role.model';
import { StandModel } from '../models/stand.model';
import { StandAdhesionModel, type StandAdhesion } from '../models/stand-adhesion.model';
import { UserRoleModel } from '../models/user-role.model';

const EDITABLE_FIELDS = [
    'standId',
    'standName',
    'standType',
    'slogan',
    'description',
    'banner',
    'logo',
    'contactName',
    'contactEmail',
    'contactPhone',
    'products',
    'haccpConfirmed',
    'haccpNote',
    'acceptsPointLight',
    'energyNeeds',
    'participationFeeAccepted',
    'depositAccepted',
    'regulationAccepted',
    'exclusionAccepted',
    'signature'
] as const;

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && /^[0-9a-fA-F]{24}$/.test(value);
}

function pick(body: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of fields) {
        if (body[field] !== undefined) {
            out[field] = body[field];
        }
    }
    return out;
}

async function isAdminForEvent(userId: string, eventId: string) {
    const platformRoleIds = await RoleModel.find({ scope: 'platform' }).distinct('_id');
    if (platformRoleIds.length) {
        const found = await UserRoleModel.findOne({ userId, roleId: { $in: platformRoleIds }, isActive: true });
        if (found) return true;
    }

    const eventRoleIds = await RoleModel.find({ scope: 'event' }).distinct('_id');
    if (!eventRoleIds.length) return false;
    const found = await UserRoleModel.findOne({
        userId,
        roleId: { $in: eventRoleIds },
        isActive: true,
        $or: [{ eventId: new Types.ObjectId(eventId) }, { eventId: { $exists: false } }, { eventId: null }]
    });
    return Boolean(found);
}

async function isStandMember(userId: string, standId: string | null) {
    if (!standId || !Types.ObjectId.isValid(standId)) return false;
    const standRoleIds = await RoleModel.find({ scope: 'stand' }).distinct('_id');
    if (!standRoleIds.length) return false;
    const found = await UserRoleModel.findOne({
        userId,
        roleId: { $in: standRoleIds },
        standId: new Types.ObjectId(standId),
        isActive: true
    });
    return Boolean(found);
}

async function myStandIds(userId: string): Promise<string[]> {
    const standRoleIds = await RoleModel.find({ scope: 'stand' }).distinct('_id');
    if (!standRoleIds.length) return [];
    const rows = await UserRoleModel.find({
        userId,
        roleId: { $in: standRoleIds },
        standId: { $ne: null },
        isActive: true
    }).lean();
    return rows.map((r) => r.standId!.toString());
}

function toAdhesionResponse(adhesion: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    standId?: unknown;
    status: string;
    reviewedAt?: unknown;
    reviewNote?: unknown;
    standName: string;
    standType?: string;
    slogan?: unknown;
    description?: unknown;
    banner?: unknown;
    logo?: unknown;
    contactName?: unknown;
    contactEmail?: unknown;
    contactPhone?: unknown;
    products?: unknown;
    haccpConfirmed?: unknown;
    haccpNote?: unknown;
    acceptsPointLight?: unknown;
    energyNeeds?: unknown;
    participationFeeAccepted?: unknown;
    depositAccepted?: unknown;
    regulationAccepted?: unknown;
    exclusionAccepted?: unknown;
    signature?: unknown;
    signedAt?: unknown;
    submittedAt?: unknown;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: adhesion._id.toString(),
        eventId: adhesion.eventId.toString(),
        standId: adhesion.standId ? (adhesion.standId as { toString(): string }).toString() : null,
        status: adhesion.status,
        reviewedAt: adhesion.reviewedAt ?? null,
        reviewNote: adhesion.reviewNote ?? null,
        standName: adhesion.standName,
        standType: adhesion.standType ?? 'food',
        slogan: adhesion.slogan ?? null,
        description: adhesion.description ?? null,
        banner: adhesion.banner ?? null,
        logo: adhesion.logo ?? null,
        contactName: adhesion.contactName ?? null,
        contactEmail: adhesion.contactEmail ?? null,
        contactPhone: adhesion.contactPhone ?? null,
        products: adhesion.products ?? [],
        haccpConfirmed: adhesion.haccpConfirmed ?? false,
        haccpNote: adhesion.haccpNote ?? null,
        acceptsPointLight: adhesion.acceptsPointLight ?? false,
        energyNeeds: adhesion.energyNeeds ?? [],
        participationFeeAccepted: adhesion.participationFeeAccepted ?? false,
        depositAccepted: adhesion.depositAccepted ?? false,
        regulationAccepted: adhesion.regulationAccepted ?? false,
        exclusionAccepted: adhesion.exclusionAccepted ?? false,
        signature: adhesion.signature ?? null,
        signedAt: adhesion.signedAt ?? null,
        submittedAt: adhesion.submittedAt ?? null,
        createdAt: adhesion.createdAt,
        updatedAt: adhesion.updatedAt
    };
}

function completenessErrors(a: StandAdhesion): string[] {
    const missing: string[] = [];
    if (!a.standName?.trim()) missing.push('nome dello stand');
    if (!a.haccpConfirmed) missing.push('conferma requisiti HACCP');
    if (!a.acceptsPointLight) missing.push('accettazione del punto luce (energia elettrica)');
    if (!a.participationFeeAccepted) missing.push('accettazione del prezzo di partecipazione');
    if (!a.depositAccepted) missing.push('accettazione della caparra');
    if (!a.regulationAccepted) missing.push('accettazione del regolamento');
    if (!a.exclusionAccepted) missing.push('accettazione della clausola di esclusione');
    if (!a.signature?.trim()) missing.push('firma del richiedente');
    return missing;
}

export async function createAdhesion(req: Request, res: Response) {
    const eventId = req.params.eventId;
    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await EventModel.findById(eventId);
    if (!event) {
        return res.status(404).json({ message: 'Event not found' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const standId = typeof body.standId === 'string' ? body.standId : null;

    const admin = await isAdminForEvent(req.user!.id, eventId);
    const owner = standId ? await isStandMember(req.user!.id, standId) : false;
    if (!admin && !owner) {
        return res.status(403).json({ message: 'Insufficient role' });
    }

    const data = pick(body, EDITABLE_FIELDS);
    data.eventId = new Types.ObjectId(eventId);
    if (!data.standName) {
        const stand = standId ? await StandModel.findById(standId).lean() : null;
        if (stand?.name) data.standName = stand.name;
    }
    if (typeof data.signature === 'string' && data.signature.trim()) {
        data.signedAt = new Date();
    }

    const adhesion = await StandAdhesionModel.create(data);
    return res.status(201).json({ item: toAdhesionResponse(adhesion) });
}

export async function listAdhesions(req: Request, res: Response) {
    const eventId = req.params.eventId;
    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const admin = await isAdminForEvent(req.user!.id, eventId);
    const filter: Record<string, unknown> = { eventId: new Types.ObjectId(eventId) };
    if (!admin) {
        const standIds = await myStandIds(req.user!.id);
        if (!standIds.length) {
            return res.status(200).json({ items: [] });
        }
        filter.standId = { $in: standIds.map((id) => new Types.ObjectId(id)) };
    }

    const items = await StandAdhesionModel.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ items: items.map(toAdhesionResponse) });
}

export async function getMyAdhesion(req: Request, res: Response) {
    const eventId = req.params.eventId;
    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const standIds = await myStandIds(req.user!.id);
    if (!standIds.length) {
        return res.status(200).json({ item: null });
    }

    const adhesion = await StandAdhesionModel.findOne({
        eventId: new Types.ObjectId(eventId),
        standId: { $in: standIds.map((id) => new Types.ObjectId(id)) }
    }).sort({ createdAt: -1 });

    return res.status(200).json({ item: adhesion ? toAdhesionResponse(adhesion) : null });
}

export async function getAdhesion(req: Request, res: Response) {
    const { eventId, adhesionId } = req.params;
    if (!isValidObjectId(eventId) || !isValidObjectId(adhesionId)) {
        return res.status(400).json({ message: 'Invalid id' });
    }

    const adhesion = await StandAdhesionModel.findOne({ _id: adhesionId, eventId });
    if (!adhesion) {
        return res.status(404).json({ message: 'Adhesion not found' });
    }

    const admin = await isAdminForEvent(req.user!.id, adhesion.eventId.toString());
    const owner = await isStandMember(req.user!.id, adhesion.standId ? adhesion.standId.toString() : null);
    if (!admin && !owner) {
        return res.status(404).json({ message: 'Adhesion not found' });
    }

    return res.status(200).json({ item: toAdhesionResponse(adhesion) });
}

export async function updateAdhesion(req: Request, res: Response) {
    const { adhesionId } = req.params;
    if (!isValidObjectId(adhesionId)) {
        return res.status(400).json({ message: 'Invalid adhesion id' });
    }

    const adhesion = await StandAdhesionModel.findById(adhesionId);
    if (!adhesion) {
        return res.status(404).json({ message: 'Adhesion not found' });
    }

    const admin = await isAdminForEvent(req.user!.id, adhesion.eventId.toString());
    const owner = await isStandMember(req.user!.id, adhesion.standId ? adhesion.standId.toString() : null);
    if (!admin && !owner) {
        return res.status(404).json({ message: 'Adhesion not found' });
    }

    if (adhesion.status === 'approved') {
        return res.status(409).json({ message: 'Adesione già approvata: non modificabile.' });
    }

    const body = pick((req.body ?? {}) as Record<string, unknown>, EDITABLE_FIELDS);

    const standId = typeof body.standId === 'string' ? body.standId : null;
    if (standId) {
        const member = await isStandMember(req.user!.id, standId);
        if (!admin && !member) {
            return res.status(403).json({ message: 'Non puoi collegare un adesione a uno stand che non gestisci.' });
        }
    }

    adhesion.set(body);
    if (typeof body.signature === 'string' && body.signature.trim() && !adhesion.signedAt) {
        adhesion.signedAt = new Date();
    }
    if (adhesion.status === 'submitted') {
        adhesion.status = 'draft';
        adhesion.submittedAt = null;
    }
    await adhesion.save();

    return res.status(200).json({ item: toAdhesionResponse(adhesion) });
}

export async function submitAdhesion(req: Request, res: Response) {
    const { adhesionId } = req.params;
    if (!isValidObjectId(adhesionId)) {
        return res.status(400).json({ message: 'Invalid adhesion id' });
    }

    const adhesion = await StandAdhesionModel.findById(adhesionId);
    if (!adhesion) {
        return res.status(404).json({ message: 'Adhesion not found' });
    }

    const admin = await isAdminForEvent(req.user!.id, adhesion.eventId.toString());
    const owner = await isStandMember(req.user!.id, adhesion.standId ? adhesion.standId.toString() : null);
    if (!admin && !owner) {
        return res.status(404).json({ message: 'Adhesion not found' });
    }

    if (adhesion.status === 'approved' || adhesion.status === 'submitted') {
        return res.status(409).json({ message: 'Adesione non più in stato di bozza.' });
    }

    const missing = completenessErrors(adhesion);
    if (missing.length > 0) {
        return res.status(400).json({
            message: `Compilazione incompleta: ${missing.join(', ')}.`
        });
    }

    adhesion.status = 'submitted';
    adhesion.submittedAt = new Date();
    adhesion.reviewedAt = null;
    adhesion.reviewNote = null;
    await adhesion.save();

    return res.status(200).json({ item: toAdhesionResponse(adhesion) });
}

export async function withdrawAdhesion(req: Request, res: Response) {
    const { adhesionId } = req.params;
    if (!isValidObjectId(adhesionId)) {
        return res.status(400).json({ message: 'Invalid adhesion id' });
    }

    const adhesion = await StandAdhesionModel.findById(adhesionId);
    if (!adhesion) {
        return res.status(404).json({ message: 'Adhesion not found' });
    }

    const admin = await isAdminForEvent(req.user!.id, adhesion.eventId.toString());
    const owner = await isStandMember(req.user!.id, adhesion.standId ? adhesion.standId.toString() : null);
    if (!admin && !owner) {
        return res.status(404).json({ message: 'Adhesion not found' });
    }

    if (adhesion.status !== 'submitted') {
        return res.status(409).json({ message: 'Solo un adesione in attesa può essere ritirata.' });
    }

    adhesion.status = 'draft';
    adhesion.submittedAt = null;
    adhesion.reviewedAt = null;
    adhesion.reviewNote = null;
    await adhesion.save();

    return res.status(200).json({ item: toAdhesionResponse(adhesion) });
}

export async function approveAdhesion(req: Request, res: Response) {
    const { adhesionId } = req.params;
    if (!isValidObjectId(adhesionId)) {
        return res.status(400).json({ message: 'Invalid adhesion id' });
    }

    const adhesion = await StandAdhesionModel.findById(adhesionId);
    if (!adhesion) {
        return res.status(404).json({ message: 'Adhesion not found' });
    }

    adhesion.status = 'approved';
    adhesion.reviewedAt = new Date();
    adhesion.reviewNote =
        typeof req.body?.reviewNote === 'string' && req.body.reviewNote.trim() ? req.body.reviewNote.trim() : null;
    await adhesion.save();

    return res.status(200).json({ item: toAdhesionResponse(adhesion) });
}

export async function rejectAdhesion(req: Request, res: Response) {
    const { adhesionId } = req.params;
    if (!isValidObjectId(adhesionId)) {
        return res.status(400).json({ message: 'Invalid adhesion id' });
    }

    const adhesion = await StandAdhesionModel.findById(adhesionId);
    if (!adhesion) {
        return res.status(404).json({ message: 'Adhesion not found' });
    }

    if (adhesion.status === 'approved') {
        return res.status(409).json({ message: 'Adesione già approvata.' });
    }

    adhesion.status = 'rejected';
    adhesion.reviewedAt = new Date();
    adhesion.reviewNote =
        typeof req.body?.reviewNote === 'string' && req.body.reviewNote.trim() ? req.body.reviewNote.trim() : null;
    await adhesion.save();

    return res.status(200).json({ item: toAdhesionResponse(adhesion) });
}