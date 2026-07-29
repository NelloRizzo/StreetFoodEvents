import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { EmailSubscriptionModel } from '../models/email-subscription.model';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toSubscriptionResponse(s: {
    _id: Types.ObjectId;
    email: string;
    eventId?: Types.ObjectId | null;
    displayName?: string | null;
    source: string;
    marketingConsent: boolean;
    consentTimestamp: Date;
    isActive: boolean;
    unsubscribedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: s._id.toString(),
        email: s.email,
        eventId: s.eventId?.toString() ?? null,
        displayName: s.displayName ?? null,
        source: s.source,
        marketingConsent: s.marketingConsent,
        consentTimestamp: s.consentTimestamp,
        isActive: s.isActive,
        unsubscribedAt: s.unsubscribedAt ?? null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
    };
}

export async function subscribe(req: Request, res: Response) {
    const { email, eventId, displayName, marketingConsent } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ message: 'Valid email is required' });
    }

    if (eventId && !isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid eventId' });
    }

    const now = new Date();
    const consentIp = req.ip ?? null;

    const update: Record<string, unknown> = {
        email: email.toLowerCase().trim(),
        marketingConsent: !!marketingConsent,
        consentTimestamp: now,
        consentIp,
        isActive: true,
        unsubscribedAt: null
    };

    if (eventId) update.eventId = eventId;
    if (displayName && typeof displayName === 'string') update.displayName = displayName.trim();

    const subscription = await EmailSubscriptionModel.findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        { $set: update },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ item: toSubscriptionResponse(subscription) });
}

export async function unsubscribe(req: Request, res: Response) {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: 'Invalid id' });
    }

    const subscription = await EmailSubscriptionModel.findByIdAndUpdate(
        id,
        { $set: { isActive: false, unsubscribedAt: new Date(), marketingConsent: false } },
        { new: true }
    );

    if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
    }

    return res.status(200).json({ item: toSubscriptionResponse(subscription) });
}

export async function unsubscribeByEmail(req: Request, res: Response) {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ message: 'Valid email is required' });
    }

    const result = await EmailSubscriptionModel.updateMany(
        { email: email.toLowerCase().trim(), isActive: true },
        { $set: { isActive: false, unsubscribedAt: new Date(), marketingConsent: false } }
    );

    return res.status(200).json({ modifiedCount: result.modifiedCount });
}

export async function listSubscriptions(req: Request, res: Response) {
    const { eventId, isActive, search } = req.query;

    const filter: Record<string, unknown> = {};

    if (eventId && isValidObjectId(eventId as string)) {
        filter.eventId = eventId;
    }

    if (isActive === 'true') filter.isActive = true;
    else if (isActive === 'false') filter.isActive = false;

    if (search && typeof search === 'string') {
        filter.email = { $regex: search, $options: 'i' };
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
        EmailSubscriptionModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        EmailSubscriptionModel.countDocuments(filter)
    ]);

    return res.status(200).json({
        items: subscriptions.map(toSubscriptionResponse),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
}
