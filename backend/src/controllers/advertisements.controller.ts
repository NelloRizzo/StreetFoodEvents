import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AdvertisementModel } from '../models/advertisement.model';
import { deleteImage, uploadImageBuffer } from '../services/cloudinary-upload.service';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function parseWeight(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n < 1) return null;
    return Math.round(n);
}

function toResponse(advertisement: InstanceType<typeof AdvertisementModel>) {
    return {
        id: advertisement._id.toString(),
        name: advertisement.name,
        image: advertisement.image,
        enabled: advertisement.enabled,
        weight: advertisement.weight,
        appearances: advertisement.appearances ?? 0,
        createdAt: advertisement.createdAt
    };
}

export async function listEnabledAdvertisements(_req: Request, res: Response) {
    const items = await AdvertisementModel.find({ enabled: true }).sort({ createdAt: 1 });
    return res.status(200).json({ items: items.map(toResponse) });
}

export async function listAllAdvertisements(_req: Request, res: Response) {
    const items = await AdvertisementModel.find().sort({ createdAt: 1 });
    return res.status(200).json({ items: items.map(toResponse) });
}

export async function resetAllAppearances(_req: Request, res: Response) {
    await AdvertisementModel.updateMany({}, { appearances: 0 });
    return res.status(200).json({ message: 'Appearance counters reset' });
}

export async function createAdvertisement(req: Request, res: Response) {
    const { image: imageBody, name } = req.body;
    let image;
    if (req.file) {
        image = await uploadImageBuffer(req.file, 'advertisements');
    } else if (imageBody && typeof imageBody === 'object' && imageBody.url) {
        image = imageBody;
    } else {
        return res.status(400).json({ message: 'Image file or image data is required' });
    }
    const item = await AdvertisementModel.create({
        name: typeof name === 'string' && name.trim() ? name.trim() : null,
        image,
        enabled: true,
        weight: parseWeight(req.body.weight) ?? 1
    });
    return res.status(201).json({ item: toResponse(item) });
}

export async function registerAdvertisementAppearance(req: Request, res: Response) {
    const { advertisementId } = req.params;
    if (!isValidObjectId(advertisementId)) {
        return res.status(400).json({ message: 'Invalid advertisement id' });
    }
    const item = await AdvertisementModel.findByIdAndUpdate(
        advertisementId,
        { $inc: { appearances: 1 } },
        { new: false }
    );
    if (!item) {
        return res.status(404).json({ message: 'Advertisement not found' });
    }
    return res.status(204).send();
}

export async function updateAdvertisement(req: Request, res: Response) {
    const { advertisementId } = req.params;
    if (!isValidObjectId(advertisementId)) {
        return res.status(400).json({ message: 'Invalid advertisement id' });
    }
    const item = await AdvertisementModel.findById(advertisementId);
    if (!item) {
        return res.status(404).json({ message: 'Advertisement not found' });
    }
    if (typeof req.body.enabled === 'boolean') {
        item.enabled = req.body.enabled;
    }
    if (typeof req.body.name === 'string' || req.body.name === null) {
        item.name = typeof req.body.name === 'string' && req.body.name.trim() ? req.body.name.trim() : null;
    }
    const parsedWeight = parseWeight(req.body.weight);
    if (parsedWeight !== null) {
        item.weight = parsedWeight;
    }
    await item.save();
    return res.status(200).json({ item: toResponse(item) });
}

export async function deleteAdvertisement(req: Request, res: Response) {
    const { advertisementId } = req.params;
    if (!isValidObjectId(advertisementId)) {
        return res.status(400).json({ message: 'Invalid advertisement id' });
    }
    const item = await AdvertisementModel.findByIdAndDelete(advertisementId);
    if (!item) {
        return res.status(404).json({ message: 'Advertisement not found' });
    }
    await deleteImage(item.image.publicId).catch(() => {});
    return res.status(204).send();
}