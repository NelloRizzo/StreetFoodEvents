import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import * as qrcode from 'qrcode';

import { EventModel } from '../models/event.model';
import { OrderModel } from '../models/order.model';
import { ReviewModel } from '../models/review.model';
import { StandModel } from '../models/stand.model';
import { sanitizeHtmlContent } from '../utils/html-sanitizer';
import {
    generateReviewerToken,
    hashReviewerToken
} from '../utils/reviewer-token';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPublicReview(r: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    standId?: Types.ObjectId | null;
    rating: number;
    comment?: string | null;
    reviewerName?: string | null;
    userId?: Types.ObjectId | null;
    status: string;
    createdAt: Date;
}) {
    return {
        id: r._id.toString(),
        eventId: r.eventId.toString(),
        standId: r.standId ? r.standId.toString() : null,
        rating: r.rating,
        comment: r.comment ?? null,
        reviewerName: r.reviewerName ?? (r.userId ? 'Cliente verificato' : null),
        isVerified: !!r.userId,
        status: r.status,
        createdAt: r.createdAt
    };
}

function toAdminReview(r: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    standId?: Types.ObjectId | null;
    rating: number;
    comment?: string | null;
    reviewerName?: string | null;
    reviewerEmail?: string | null;
    userId?: Types.ObjectId | null;
    guestTokenHash?: string | null;
    status: string;
    createdAt: Date;
}) {
    return {
        ...toPublicReview(r),
        reviewerEmail: r.reviewerEmail ?? null,
        hasGuest: !!r.guestTokenHash
    };
}

type PublicReviewShape = ReturnType<typeof toPublicReview>;

export async function getEventReviews(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await EventModel.findById(eventId).select('_id');
    if (!event) {
        return res.status(404).json({ message: 'Event not found' });
    }

    const standId = req.query.standId as string | undefined;
    const filter: Record<string, unknown> = {
        eventId,
        status: 'visible'
    };

    if (standId) {
        if (!isValidObjectId(standId)) {
            return res.status(400).json({ message: 'Invalid stand id' });
        }
        filter.standId = standId;
    } else {
        filter.standId = null;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
        ReviewModel.find(filter as never)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        ReviewModel.countDocuments(filter as never)
    ]);

    return res.status(200).json({
        items: items.map(toPublicReview),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
}

export async function getReviewsSummary(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const standId = req.query.standId as string | undefined;
    if (standId && !isValidObjectId(standId)) {
        return res.status(400).json({ message: 'Invalid stand id' });
    }

    const eventAgg = await ReviewModel.aggregate([
        {
            $match: {
                eventId: new Types.ObjectId(eventId),
                status: 'visible',
                standId: null
            }
        },
        { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$rating' } } }
    ]);

    const standMatch: Record<string, unknown> = {
        eventId: new Types.ObjectId(eventId),
        status: 'visible',
        standId: { $ne: null }
    };
    if (standId) {
        standMatch.standId = new Types.ObjectId(standId);
    }

    const standsAgg = await ReviewModel.aggregate([
        { $match: standMatch },
        { $group: { _id: '$standId', count: { $sum: 1 }, avg: { $avg: '$rating' } } }
    ]);

    return res.status(200).json({
        event: eventAgg[0]
            ? { count: eventAgg[0].count, avg: round1(eventAgg[0].avg) }
            : { count: 0, avg: null },
        stands: standsAgg.map((s) => ({
            standId: s._id.toString(),
            count: s.count,
            avg: round1(s.avg)
        }))
    });
}

export async function getMyReviews(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const orFilter: Record<string, unknown>[] = [];

    if (req.user?.id) {
        orFilter.push({ userId: req.user.id });
    }

    const guestToken = req.headers['x-access-token'];
    if (typeof guestToken === 'string' && guestToken) {
        orFilter.push({ guestTokenHash: hashReviewerToken(guestToken) });
    }

    if (orFilter.length === 0) {
        return res.status(200).json({ items: [] as PublicReviewShape[] });
    }

    const items = await ReviewModel.find({
        eventId,
        $or: orFilter
    })
        .sort({ createdAt: -1 });

    return res.status(200).json({ items: items.map(toPublicReview) });
}

export async function createReview(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await EventModel.findById(eventId).select('_id');
    if (!event) {
        return res.status(404).json({ message: 'Event not found' });
    }

    const {
        standId,
        rating,
        comment,
        reviewerName,
        reviewerEmail
    } = req.body ?? {};

    if (standId != null) {
        if (!isValidObjectId(standId as string)) {
            return res.status(400).json({ message: 'Invalid stand id' });
        }
        const stand = await StandModel.findById(standId);
        if (!stand) {
            return res.status(404).json({ message: 'Stand not found' });
        }
    }

    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ message: 'La valutazione deve essere un numero intero da 1 a 5' });
    }

    const parsedComment =
        typeof comment === 'string' && comment.trim()
            ? sanitizeHtmlContent(comment.trim())
            : null;
    if (parsedComment && parsedComment.length > 1000) {
        return res.status(400).json({ message: 'Il commento non può superare i 1000 caratteri' });
    }

    const parsedEmail =
        typeof reviewerEmail === 'string' && reviewerEmail.trim()
            ? reviewerEmail.trim().toLowerCase()
            : null;
    if (parsedEmail && !EMAIL_RE.test(parsedEmail)) {
        return res.status(400).json({ message: 'Email non valida' });
    }

    let identity: {
        userId: string | null;
        reviewerName: string | null;
        reviewerEmail: string | null;
        guestTokenHash: string | null;
    };
    let guestToken: string | undefined;

    if (req.user) {
        const orderFilter: Record<string, unknown> = {
            eventId,
            customerId: req.user.id,
            status: { $ne: 'cancelled' }
        };
        if (standId != null) {
            orderFilter.standId = standId;
        }
        const purchased = await OrderModel.exists(orderFilter);
        if (!purchased) {
            return res.status(403).json({
                message: 'Solo chi ha acquistato da questo stand può lasciare una recensione'
            });
        }

        identity = {
            userId: req.user.id,
            reviewerName:
                typeof reviewerName === 'string' && reviewerName.trim()
                    ? reviewerName.trim().slice(0, 200)
                    : null,
            reviewerEmail: parsedEmail,
            guestTokenHash: null
        };
    } else {
        const rawName = typeof reviewerName === 'string' ? reviewerName.trim() : '';
        if (!rawName) {
            return res.status(400).json({ message: 'Il nome è obbligatorio per recensire' });
        }

        const headerToken = req.headers['x-access-token'];
        let tokenHash: string | null = null;
        if (typeof headerToken === 'string' && headerToken) {
            tokenHash = hashReviewerToken(headerToken);
        } else {
            const { token, tokenHash: generatedHash } = generateReviewerToken();
            tokenHash = generatedHash;
            guestToken = token;
        }

        identity = {
            userId: null,
            reviewerName: rawName.slice(0, 200),
            reviewerEmail: parsedEmail,
            guestTokenHash: tokenHash
        };
    }

    let review;
    try {
        review = await ReviewModel.create({
            eventId,
            standId: standId ?? null,
            rating: parsedRating,
            comment: parsedComment,
            reviewerName: identity.reviewerName,
            reviewerEmail: identity.reviewerEmail,
            userId: identity.userId,
            guestTokenHash: identity.guestTokenHash
        });
    } catch (error) {
        if (
            error instanceof Error &&
            'code' in error &&
            (error as { code?: number }).code === 11000
        ) {
            return res.status(409).json({
                message: 'Hai già recensito questo stand/evento'
            });
        }
        throw error;
    }

    return res.status(201).json({
        item: toPublicReview(review),
        ...(guestToken ? { guestToken } : {})
    });
}

export async function getManageReviews(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const { standId, status } = req.query;
    const filter: Record<string, unknown> = { eventId };

    if (standId && isValidObjectId(standId as string)) {
        filter.standId = standId;
    }
    if (status === 'visible' || status === 'hidden') {
        filter.status = status;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
        ReviewModel.find(filter as never)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        ReviewModel.countDocuments(filter as never)
    ]);

    return res.status(200).json({
        items: items.map(toAdminReview),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
}

export async function updateReviewStatus(req: Request, res: Response) {
    const { eventId, reviewId } = req.params;

    if (!isValidObjectId(eventId) || !isValidObjectId(reviewId)) {
        return res.status(400).json({ message: 'Invalid review id' });
    }

    const { status } = req.body ?? {};
    if (status !== 'visible' && status !== 'hidden') {
        return res.status(400).json({ message: 'Lo stato deve essere visible o hidden' });
    }

    const review = await ReviewModel.findOneAndUpdate(
        { _id: reviewId, eventId },
        { status },
        { new: true }
    );

    if (!review) {
        return res.status(404).json({ message: 'Review not found' });
    }

    return res.status(200).json({ item: toAdminReview(review) });
}

export async function deleteReview(req: Request, res: Response) {
    const { eventId, reviewId } = req.params;

    if (!isValidObjectId(eventId) || !isValidObjectId(reviewId)) {
        return res.status(400).json({ message: 'Invalid review id' });
    }

    const review = await ReviewModel.findOneAndDelete({
        _id: reviewId,
        eventId
    });

    if (!review) {
        return res.status(404).json({ message: 'Review not found' });
    }

    return res.status(204).send();
}

export async function getReviewQrCode(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await EventModel.findById(eventId).select('_id');
    if (!event) {
        return res.status(404).json({ message: 'Event not found' });
    }

    const standId = req.query.standId as string | undefined;
    if (standId && !isValidObjectId(standId)) {
        return res.status(400).json({ message: 'Invalid stand id' });
    }

    const origin = req.headers.origin ?? `${req.protocol}://${req.headers.host}`;
    const url = standId
        ? `${origin}/events/${eventId}/stands/${standId}/review`
        : `${origin}/events/${eventId}/review`;

    const qrCode = await qrcode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: {
            dark: '#264137',
            light: '#ffffff'
        }
    });

    return res.status(200).json({ qrCode, url });
}