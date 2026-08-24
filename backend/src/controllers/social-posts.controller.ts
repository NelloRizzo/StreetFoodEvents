import type { Request, Response } from 'express';
import { type HydratedDocument, Types } from 'mongoose';

import { EventPhotoModel } from '../models/event-photo.model';
import { SocialPostModel, type SocialPlatform, type SocialPost } from '../models/social-post.model';
import { getSocialPublishConfig } from '../services/social-publish.service';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toPostResponse(post: HydratedDocument<SocialPost>) {
    return {
        id: post._id.toString(),
        eventId: post.eventId.toString(),
        photoId: post.photoId.toString(),
        platform: post.platform,
        caption: post.caption,
        status: post.status,
        attempts: post.attempts,
        lastError: post.lastError ?? null,
        remotePostId: post.remotePostId ?? null,
        permalink: post.permalink ?? null,
        publishedAt: post.publishedAt ?? null,
        createdAt: post.createdAt
    };
}

export async function getSocialPublishConfigView(_req: Request, res: Response) {
    return res.status(200).json(getSocialPublishConfig());
}

export async function createSocialPosts(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const { photoIds, platforms, caption } = req.body as {
        photoIds?: unknown;
        platforms?: unknown;
        caption?: unknown;
    };

    if (
        !Array.isArray(photoIds) ||
        photoIds.length === 0 ||
        photoIds.some((id) => !isValidObjectId(id))
    ) {
        return res.status(400).json({ message: 'Invalid photo ids' });
    }

    const validPlatforms: SocialPlatform[] = ['facebook', 'instagram'];
    if (
        !Array.isArray(platforms) ||
        platforms.length === 0 ||
        platforms.some((p) => typeof p !== 'string' || !validPlatforms.includes(p as SocialPlatform))
    ) {
        return res.status(400).json({ message: 'Invalid platforms' });
    }

    const photos = await EventPhotoModel.find({ _id: { $in: photoIds }, eventId });

    if (photos.length !== photoIds.length) {
        return res.status(404).json({ message: 'One or more photos not found' });
    }

    const videos = photos.filter((p) => p.type === 'video');
    if (videos.length > 0) {
        return res.status(400).json({ message: 'Pubblicazione social disponibile solo per le foto' });
    }

    const config = getSocialPublishConfig();
    const normalizedCaption = typeof caption === 'string' ? caption.trim() : '';
    const userId = req.user?.id ?? null;

    const docs = photoIds.flatMap((photoId) =>
        (platforms as SocialPlatform[]).map((platform) => ({
            eventId,
            photoId,
            platform,
            caption: normalizedCaption,
            requestedByUserId: userId
        }))
    );

    const inserted = await SocialPostModel.insertMany(docs);
    const posts = await SocialPostModel.find({ _id: { $in: inserted.map((d) => d._id) } }).sort({
        createdAt: 1,
        _id: 1
    });

    for (const post of posts) {
        if (!config[post.platform]) {
            post.status = 'failed';
            post.lastError = `Piattaforma ${post.platform} non configurata`;
            await post.save();
        }
    }

    return res.status(201).json({ items: posts.map(toPostResponse) });
}

export async function listSocialPosts(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const { ids } = req.query;
    let idFilter: string[] = [];

    if (typeof ids === 'string' && ids.trim().length > 0) {
        idFilter = ids.split(',').map((id) => id.trim()).filter((id) => isValidObjectId(id));
        if (idFilter.length === 0) {
            return res.status(200).json({ items: [] });
        }
    }

    const posts = await SocialPostModel.find({
        eventId,
        ...(idFilter.length > 0 ? { _id: { $in: idFilter } } : {})
    })
        .sort({ createdAt: -1 })
        .limit(100);

    return res.status(200).json({ items: posts.map(toPostResponse) });
}
