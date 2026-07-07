import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { EventPhotoModel } from '../models/event-photo.model';
import { deleteImage } from '../services/cloudinary-upload.service';
import { uploadImageBuffer } from '../services/cloudinary-upload.service';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toPhotoResponse(photo: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    image: { url: string; publicId: string; width: number; height: number; format: string; bytes: number };
    sequenceNumber: number;
    takenAt: Date;
    frameId?: Types.ObjectId | null;
    createdBy?: Types.ObjectId | null;
    createdAt: Date;
}) {
    return {
        id: photo._id.toString(),
        eventId: photo.eventId.toString(),
        image: photo.image,
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

    if (!req.file) {
        return res.status(400).json({ message: 'Image file is required' });
    }

    const folder = `events/${eventId}/photos`;
    const image = await uploadImageBuffer(req.file, folder);

    const lastPhoto = await EventPhotoModel.findOne({ eventId }).sort({ sequenceNumber: -1 }).select('sequenceNumber');
    const sequenceNumber = (lastPhoto?.sequenceNumber ?? 0) + 1;

    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const publicId = image.publicId.replace(/\/[^/]+$/, `/${sequenceNumber}_${datePart}_${timePart}`);

    const photo = await EventPhotoModel.create({
        eventId,
        image: { ...image, publicId },
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

    await deleteImage(photo.image.publicId).catch(() => {});

    return res.status(204).send();
}

export async function deleteAllEventPhotos(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const photos = await EventPhotoModel.find({ eventId }).select('image.publicId');

    const publicIds = photos.map((p) => p.image.publicId).filter(Boolean);

    await EventPhotoModel.deleteMany({ eventId });

    if (publicIds.length > 0) {
        await Promise.all(publicIds.map((id) => deleteImage(id).catch(() => {})));
    }

    return res.status(204).send();
}
