import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { EmailSubscriptionModel } from '../models/email-subscription.model';
import { EventModel } from '../models/event.model';
import { EventPhotoModel } from '../models/event-photo.model';
import { deleteImage, deleteVideo, uploadImageBuffer, uploadVideoBuffer } from '../services/cloudinary-upload.service';
import { isEmailConfigured, sendPhotoEmail } from '../services/email.service';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toPhotoResponse(photo: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    type: 'image' | 'video';
    image?: { url: string; publicId: string; width: number; height: number; format: string; bytes: number } | null;
    video?: { url: string; publicId: string; width: number; height: number; format: string; bytes: number; duration: number } | null;
    sequenceNumber: number;
    takenAt: Date;
    frameId?: Types.ObjectId | null;
    createdBy?: Types.ObjectId | null;
    createdAt: Date;
}) {
    return {
        id: photo._id.toString(),
        eventId: photo.eventId.toString(),
        type: photo.type,
        image: photo.image ?? null,
        video: photo.video ?? null,
        sequenceNumber: photo.sequenceNumber,
        takenAt: photo.takenAt,
        frameId: photo.frameId?.toString() ?? null,
        createdBy: photo.createdBy?.toString() ?? null,
        createdAt: photo.createdAt
    };
}

export async function listEventPhotos(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const items = await EventPhotoModel.find({ eventId }).sort({ sequenceNumber: -1 });

    return res.status(200).json({ items: items.map(toPhotoResponse) });
}

export async function createEventPhoto(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const files = req.files as
        | { [fieldname: string]: Express.Multer.File[] }
        | Express.Multer.File[]
        | undefined;
    const imageFile = Array.isArray(files) ? undefined : files?.image?.[0];
    const videoFile = Array.isArray(files) ? undefined : files?.video?.[0];

    if (!imageFile && !videoFile) {
        return res.status(400).json({ message: 'Image or video file is required' });
    }

    const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const folder = `events/${eventId}/photos/${nowStr}`;

    let type: 'image' | 'video';
    let image = null;
    let video = null;

    if (videoFile) {
        type = 'video';
        video = await uploadVideoBuffer(videoFile, folder);
    } else {
        if (!imageFile) {
            return res.status(400).json({ message: 'Image or video file is required' });
        }
        type = 'image';
        image = await uploadImageBuffer(imageFile, folder);
    }

    const lastPhoto = await EventPhotoModel.findOne({ eventId }).sort({ sequenceNumber: -1 }).select('sequenceNumber');
    const sequenceNumber = (lastPhoto?.sequenceNumber ?? 0) + 1;

    const now = new Date();

    const photo = await EventPhotoModel.create({
        eventId,
        type,
        image,
        video,
        sequenceNumber,
        takenAt: now,
        frameId: req.body.frameId ?? null,
        createdBy: req.user?.id ?? null
    });

    return res.status(201).json({ item: toPhotoResponse(photo) });
}

export async function deleteEventPhoto(req: Request, res: Response) {
    const { eventId, photoId } = req.params;

    if (!isValidObjectId(eventId) || !isValidObjectId(photoId)) {
        return res.status(400).json({ message: 'Invalid id' });
    }

    const photo = await EventPhotoModel.findOneAndDelete({ _id: photoId, eventId });

    if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
    }

    if (photo.type === 'video' && photo.video?.publicId) {
        await deleteVideo(photo.video.publicId).catch(() => {});
    } else if (photo.image?.publicId) {
        await deleteImage(photo.image.publicId).catch(() => {});
    }

    return res.status(204).send();
}

export async function deleteAllEventPhotos(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const photos = await EventPhotoModel.find({ eventId }).select('type image.publicId video.publicId');

    const deletions = photos
        .map((p) => {
            if (p.type === 'video' && p.video?.publicId) return deleteVideo(p.video.publicId).catch(() => {});
            if (p.image?.publicId) return deleteImage(p.image.publicId).catch(() => {});
            return null;
        })
        .filter((d): d is Promise<void> => d !== null);

    await EventPhotoModel.deleteMany({ eventId });

    if (deletions.length > 0) {
        await Promise.all(deletions);
    }

    return res.status(204).send();
}

export async function sendEventPhotoEmail(req: Request, res: Response) {
    const { eventId, photoId } = req.params;

    if (!isValidObjectId(eventId) || !isValidObjectId(photoId)) {
        return res.status(400).json({ message: 'Invalid id' });
    }

    const { email, marketingConsent } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ message: 'Invalid email address' });
    }

    if (!isEmailConfigured()) {
        return res.status(400).json({ message: 'Invio email non configurato. Contatta l\'amministratore.' });
    }

    const photo = await EventPhotoModel.findById(photoId);
    if (!photo || photo.eventId.toString() !== eventId) {
        return res.status(404).json({ message: 'Photo not found' });
    }

    if (photo.type === 'video') {
        return res.status(400).json({ message: 'Invio email disponibile solo per le foto' });
    }

    const event = await EventModel.findById(eventId);
    const eventName = event?.name;
    const eventLocation = (event?.location as { label?: string } | undefined)?.label;

    try {
        await sendPhotoEmail(email, photo.image?.url ?? '', eventName ?? undefined, eventLocation ?? undefined);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore sconosciuto';
        return res.status(500).json({ message });
    }

    await EmailSubscriptionModel.findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        {
            $set: {
                email: email.toLowerCase().trim(),
                eventId,
                source: 'photo-email',
                marketingConsent: !!marketingConsent,
                consentTimestamp: new Date(),
                consentIp: req.ip ?? null,
                isActive: true,
                unsubscribedAt: null
            }
        },
        { upsert: true, new: true }
    ).catch((err) => {
        console.error('[sendEventPhotoEmail] failed to record subscription:', err);
    });

    return res.status(200).json({ message: 'Email sent' });
}
