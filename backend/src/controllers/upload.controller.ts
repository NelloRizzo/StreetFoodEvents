import type { Request, Response } from 'express';

import { deleteImage, deleteImages } from '../services/cloudinary-upload.service';

export async function uploadImageHandler(req: Request, res: Response) {
    if (!req.uploadedImage) {
        return res.status(400).json({
            message: 'No image uploaded'
        });
    }

    return res.status(200).json({
        item: req.uploadedImage
    });
}

export async function uploadGalleryHandler(req: Request, res: Response) {
    return res.status(200).json({
        items: req.uploadedGallery ?? []
    });
}

export async function deleteImageHandler(req: Request, res: Response) {
    const { publicId } = req.body;

    if (!publicId || typeof publicId !== 'string') {
        return res.status(400).json({
            message: 'publicId is required'
        });
    }

    await deleteImage(publicId);

    return res.status(200).json({
        success: true
    });
}

export async function deleteGalleryHandler(req: Request, res: Response) {
    const { publicIds } = req.body;

    if (!Array.isArray(publicIds) || publicIds.length === 0) {
        return res.status(400).json({
            message: 'publicIds array is required'
        });
    }

    await deleteImages(publicIds);

    return res.status(200).json({
        success: true
    });
}
