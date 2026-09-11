import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { env } from '../config/env';
import { EventModel } from '../models/event.model';
import { RoleModel } from '../models/role.model';
import { StandModel } from '../models/stand.model';
import { StandAdhesionModel, type StandAdhesion } from '../models/stand-adhesion.model';
import { UserModel } from '../models/user.model';
import { UserRoleModel } from '../models/user-role.model';
import { hashAdhesionToken, generateAdhesionAccessToken } from '../utils/adhesion-access-token';
import { generateActivationToken } from '../utils/activation-token';
import { sendActivationEmail } from '../services/email.service';
import { nextStandNumber } from '../utils/stand-number';

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

function accessTokenFromRequest(req: Request): string | null {
    const header = req.headers['x-access-token'];
    return typeof header === 'string' && header.trim() ? header.trim() : null;
}

async function canManageAdhesion(
    req: Request,
    adhesion: {
        eventId: Types.ObjectId;
        standId?: Types.ObjectId | null;
        userId?: Types.ObjectId | null;
        accessTokenHash?: string | null;
    }
): Promise<boolean> {
    if (req.user) {
        if (adhesion.userId && adhesion.userId.toString() === req.user.id) return true;
        if (await isAdminForEvent(req.user.id, adhesion.eventId.toString())) return true;
        if (await isStandMember(req.user.id, adhesion.standId ? adhesion.standId.toString() : null)) return true;
    }
    const token = accessTokenFromRequest(req);
    if (token && adhesion.accessTokenHash && hashAdhesionToken(token) === adhesion.accessTokenHash) {
        return true;
    }
    return false;
}

function toAdhesionResponse(adhesion: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    standId?: unknown;
    userId?: unknown;
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
        userId: adhesion.userId ? (adhesion.userId as { toString(): string }).toString() : null,
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
    if (!a.standId) {
        if (!a.contactName?.trim()) missing.push('nome del referente');
        if (!a.contactEmail?.trim()) missing.push('email del referente');
    }
    return missing;
}

async function ensureOwnerUser(adhesion: StandAdhesion): Promise<{ error?: string; activationUrl?: string | null; emailSent?: boolean }> {
    if (adhesion.userId) {
        return { activationUrl: null, emailSent: true };
    }

    const email = (adhesion.contactEmail ?? '').trim().toLowerCase();
    const name = (adhesion.contactName ?? '').trim();
    if (!email) {
        return { error: 'Email del referente obbligatoria per la creazione dell\'account.' };
    }

    const existing = await UserModel.findOne({ email });
    if (existing) {
        adhesion.userId = existing._id as never;
        return { activationUrl: null, emailSent: true };
    }

    const nameParts = name.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? email.split('@')[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const { token, tokenHash, expiresAt } = generateActivationToken();
    const user = await UserModel.create({
        firstName,
        lastName,
        email,
        phone: adhesion.contactPhone ?? null,
        passwordHash: null,
        isActive: false,
        activationTokenHash: tokenHash,
        activationTokenExpiresAt: expiresAt,
        activatedAt: null
    });
    adhesion.userId = user._id as never;

    const activationUrl = `${env.CLIENT_URL}/attiva/${token}`;
    try {
        await sendActivationEmail(user.email, user.firstName, activationUrl);
        return { activationUrl: null, emailSent: true };
    } catch {
        return { activationUrl, emailSent: false };
    }
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

    if (!event.regulationDocument) {
        return res.status(400).json({
            message: 'Il modulo di adesione è disponibile solo se l\'organizzazione ha pubblicato il regolamento della manifestazione.'
        });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const standId = typeof body.standId === 'string' ? body.standId : null;

    if (standId) {
        if (!req.user) {
            return res.status(403).json({ message: 'Insufficient role' });
        }
        const admin = await isAdminForEvent(req.user.id, eventId);
        const owner = await isStandMember(req.user.id, standId);
        if (!admin && !owner) {
            return res.status(403).json({ message: 'Insufficient role' });
        }
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
    if (req.user) {
        data.userId = new Types.ObjectId(req.user.id);
    }

    const { token, tokenHash } = generateAdhesionAccessToken();
    data.accessTokenHash = tokenHash;

    const adhesion = await StandAdhesionModel.create(data);
    return res.status(201).json({
        item: toAdhesionResponse(adhesion),
        accessToken: token
    });
}

export async function listAdhesions(req: Request, res: Response) {
    const eventId = req.params.eventId;
    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const admin = await isAdminForEvent(req.user.id, eventId);
    const filter: Record<string, unknown> = { eventId: new Types.ObjectId(eventId) };
    if (!admin) {
        const standIds = await myStandIds(req.user.id);
        const userId = new Types.ObjectId(req.user.id);
        filter.$or = [
            { standId: { $in: standIds.map((id) => new Types.ObjectId(id)) } },
            { userId }
        ];
    }

    const items = await StandAdhesionModel.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ items: items.map(toAdhesionResponse) });
}

export async function getMyAdhesion(req: Request, res: Response) {
    const eventId = req.params.eventId;
    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    let adhesion: StandAdhesion | null = null;

    const token = accessTokenFromRequest(req);
    if (token) {
        adhesion = await StandAdhesionModel.findOne({
            eventId: new Types.ObjectId(eventId),
            accessTokenHash: hashAdhesionToken(token)
        }).sort({ createdAt: -1 });
    }

    if (!adhesion && req.user) {
        const standIds = await myStandIds(req.user.id);
        const userId = new Types.ObjectId(req.user.id);
        adhesion = await StandAdhesionModel.findOne({
            eventId: new Types.ObjectId(eventId),
            $or: [
                { standId: { $in: standIds.map((id) => new Types.ObjectId(id)) } },
                { userId }
            ]
        }).sort({ createdAt: -1 });
    }

    return res.status(200).json({
        item: adhesion
            ? toAdhesionResponse(adhesion as unknown as Parameters<typeof toAdhesionResponse>[0])
            : null
    });
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

    if (!(await canManageAdhesion(req, adhesion))) {
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

    if (!(await canManageAdhesion(req, adhesion))) {
        return res.status(404).json({ message: 'Adhesion not found' });
    }

    if (adhesion.status === 'approved') {
        return res.status(409).json({ message: 'Adesione già approvata: non modificabile.' });
    }

    const body = pick((req.body ?? {}) as Record<string, unknown>, EDITABLE_FIELDS);

    const standId = typeof body.standId === 'string' ? body.standId : null;
    if (standId) {
        const member = await isStandMember(req.user?.id ?? '', standId);
        const admin = req.user ? await isAdminForEvent(req.user.id, adhesion.eventId.toString()) : false;
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

    if (!(await canManageAdhesion(req, adhesion))) {
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

    let ownerResult: { error?: string; activationUrl?: string | null; emailSent?: boolean } = {};
    if (!adhesion.standId) {
        ownerResult = await ensureOwnerUser(adhesion);
        if (ownerResult.error) {
            return res.status(400).json({ message: ownerResult.error });
        }
    }

    adhesion.status = 'submitted';
    adhesion.submittedAt = new Date();
    adhesion.reviewedAt = null;
    adhesion.reviewNote = null;
    await adhesion.save();

    return res.status(200).json({
        item: toAdhesionResponse(adhesion),
        activationUrl: ownerResult.activationUrl ?? null,
        emailSent: ownerResult.emailSent ?? true
    });
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

    if (!(await canManageAdhesion(req, adhesion))) {
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

    if (adhesion.status === 'approved') {
        return res.status(409).json({ message: 'Adesione già approvata.' });
    }

    if (!adhesion.standId) {
        const eventId = adhesion.eventId.toString();
        const number = await nextStandNumber(eventId);
        const stand = await StandModel.create({
            type: adhesion.standType ?? 'food',
            name: adhesion.standName,
            slogan: adhesion.slogan ?? null,
            description: adhesion.description ?? null,
            eventIds: [adhesion.eventId],
            numbers: [{ eventId: adhesion.eventId, number }],
            locations: [],
            coverImage: adhesion.banner ?? null,
            logo: adhesion.logo ?? null,
            gallery: []
        });
        adhesion.standId = stand._id;

        if (adhesion.userId) {
            const ownerRole = await RoleModel.findOne({ scope: 'stand', slug: 'stand-admin' });
            if (ownerRole) {
                await UserRoleModel.findOneAndUpdate(
                    {
                        userId: adhesion.userId,
                        roleId: ownerRole._id,
                        eventId: null,
                        standId: stand._id
                    },
                    { $set: { isActive: true, assignedBy: req.user?.id ? new Types.ObjectId(req.user.id) : null } },
                    { upsert: true, new: true }
                );
            }
        }
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