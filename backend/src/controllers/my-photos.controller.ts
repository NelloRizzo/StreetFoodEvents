import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { env } from '../config/env';
import { EventModel } from '../models/event.model';
import { EventPhotoModel } from '../models/event-photo.model';

const MAX_PHOTOS_PER_EVENT = 30;
const THUMB_TRANSFORMATION = 'w_320,h_320,c_fill,q_auto,f_auto';

type GroupedPhoto = {
    id: Types.ObjectId;
    sequenceNumber: number;
    type: 'image' | 'video';
    image: EventPhotoImage | null;
    video: EventVideoMedia | null;
    takenAt: Date;
};

type EventPhotoImage = {
    url: string;
    publicId: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
} | null;

type EventVideoMedia = {
    url: string;
    publicId: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    duration: number;
} | null;

function buildThumbnail(photo: Pick<GroupedPhoto, 'type' | 'image' | 'video'>): string | null {
    const base = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}`;

    if (photo.type === 'video' && photo.video?.publicId) {
        return `${base}/video/upload/so_1,${THUMB_TRANSFORMATION}/${photo.video.publicId}.jpg`;
    }

    if (photo.image?.publicId) {
        return `${base}/image/upload/${THUMB_TRANSFORMATION}/${photo.image.publicId}.${photo.image.format || 'jpg'}`;
    }

    return photo.image?.url ?? photo.video?.url ?? null;
}

export async function listMyPhotos(req: Request, res: Response) {
    const userId = req.user?.id;

    if (!userId || !Types.ObjectId.isValid(userId)) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const groups = await EventPhotoModel.aggregate<{
        _id: Types.ObjectId;
        totalCount: number;
        latestTakenAt: Date;
        photos: GroupedPhoto[];
    }>([
        { $match: { createdBy: new Types.ObjectId(userId) } },
        { $sort: { sequenceNumber: -1 } },
        {
            $group: {
                _id: '$eventId',
                totalCount: { $sum: 1 },
                latestTakenAt: { $max: '$takenAt' },
                photos: {
                    $push: {
                        id: '$_id',
                        sequenceNumber: '$sequenceNumber',
                        type: '$type',
                        image: '$image',
                        video: '$video',
                        takenAt: '$takenAt'
                    }
                }
            }
        },
        { $sort: { latestTakenAt: -1 } },
        { $project: { totalCount: 1, latestTakenAt: 1, photos: { $slice: ['$photos', MAX_PHOTOS_PER_EVENT] } } }
    ]);

    if (groups.length === 0) {
        return res.status(200).json({ items: [] });
    }

    const events = await EventModel.find({ _id: { $in: groups.map((g) => g._id) } })
        .select('name startDate endDate');
    const eventsById = new Map(events.map((e) => [e._id.toString(), e]));

    const items = groups.map((group) => {
        const event = eventsById.get(group._id.toString());

        return {
            eventId: group._id.toString(),
            eventName: event?.name ?? 'Evento',
            eventStartDate: event?.startDate ?? null,
            eventEndDate: event?.endDate ?? null,
            totalCount: group.totalCount,
            photos: group.photos.map((p) => ({
                id: p.id.toString(),
                sequenceNumber: p.sequenceNumber,
                type: p.type,
                thumbnail: buildThumbnail(p),
                takenAt: p.takenAt
            }))
        };
    });

    return res.status(200).json({ items });
}
