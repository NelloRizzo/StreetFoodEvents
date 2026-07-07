import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { EventFrameModel } from '../models/event-frame.model';
import { deleteImage, uploadImageBuffer } from '../services/cloudinary-upload.service';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toFrameResponse(frame: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    name: string;
    image: { url: string; publicId: string; width: number; height: number; format: string; bytes: number };
    createdAt: Date;
}) {
    return {
        id: frame._id.toString(),
        eventId: frame.eventId.toString(),
        name: frame.name,
        image: frame.image,
        createdAt: frame.createdAt
    };
}

export async function listEventFrames(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const items = await EventFrameModel.find({ eventId }).sort({ name: 1 });

    return res.status(200).json({ items: items.map(toFrameResponse) });
}

export async function createEventFrame(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Name is required' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'Image file is required' });
    }

    const folder = `events/${eventId}/frames`;
    const image = await uploadImageBuffer(req.file, folder);

    const frame = await EventFrameModel.create({
        eventId,
        name: name.trim(),
        image
    });

    return res.status(201).json({ item: toFrameResponse(frame) });
}

export async function deleteEventFrame(req: Request, res: Response) {
    const { eventId, frameId } = req.params;

    if (!isValidObjectId(eventId) || !isValidObjectId(frameId)) {
        return res.status(400).json({ message: 'Invalid id' });
    }

    const frame = await EventFrameModel.findOneAndDelete({ _id: frameId, eventId });

    if (!frame) {
        return res.status(404).json({ message: 'Frame not found' });
    }

    await deleteImage(frame.image.publicId).catch(() => {});

    return res.status(204).send();
}
