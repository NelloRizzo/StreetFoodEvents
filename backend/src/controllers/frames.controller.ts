import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { FrameModel } from '../models/frame.model';
import { deleteImage, uploadImageBuffer } from '../services/cloudinary-upload.service';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toResponse(frame: InstanceType<typeof FrameModel>) {
    return {
        id: frame._id.toString(),
        name: frame.name,
        image: frame.image,
        textColor: frame.textColor,
        textPosition: frame.textPosition,
        createdAt: frame.createdAt
    };
}

export async function listFrames(_req: Request, res: Response) {
    const items = await FrameModel.find().sort({ name: 1 });
    return res.status(200).json({ items: items.map(toResponse) });
}

export async function createFrame(req: Request, res: Response) {
    const { name, image: imageBody, textPosition } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Name is required' });
    }
    let image;
    if (req.file) {
        const folder = 'frames';
        image = await uploadImageBuffer(req.file, folder);
    } else if (imageBody && typeof imageBody === 'object' && imageBody.url) {
        image = imageBody;
    } else {
        return res.status(400).json({ message: 'Image file or image data is required' });
    }
    const frame = await FrameModel.create({
        name: name.trim(),
        image,
        textColor: req.body.textColor || '#ffffff',
        textPosition: {
            vertical: textPosition?.vertical ?? 'bottom',
            horizontal: textPosition?.horizontal ?? 'center'
        }
    });
    return res.status(201).json({ item: toResponse(frame) });
}

export async function getFrameImage(req: Request, res: Response) {
    const { frameId } = req.params;
    if (!isValidObjectId(frameId)) {
        return res.status(400).json({ message: 'Invalid frame id' });
    }
    const frame = await FrameModel.findById(frameId).select('image.url image.format');
    if (!frame) {
        return res.status(404).json({ message: 'Frame not found' });
    }
    const cloudinaryResp = await fetch(frame.image.url);
    if (!cloudinaryResp.ok) {
        return res.status(502).json({ message: 'Failed to fetch frame image' });
    }
    res.set('Content-Type', cloudinaryResp.headers.get('content-type') ?? 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    const webStream = cloudinaryResp.body;
    if (!webStream) {
        return res.status(502).json({ message: 'No response body' });
    }
    return void await pipeline(Readable.fromWeb(webStream), res);
}

export async function deleteFrame(req: Request, res: Response) {
    const { frameId } = req.params;
    if (!isValidObjectId(frameId)) {
        return res.status(400).json({ message: 'Invalid frame id' });
    }
    const frame = await FrameModel.findByIdAndDelete(frameId);
    if (!frame) {
        return res.status(404).json({ message: 'Frame not found' });
    }
    await deleteImage(frame.image.publicId).catch(() => {});
    return res.status(204).send();
}
