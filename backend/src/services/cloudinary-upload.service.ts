import { Readable } from 'node:stream';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { cloudinary } from '@/config/cloudinary';
import type { UploadedDocument, UploadedImage, UploadedVideo } from '@/types/uploaded-image';

function uploadBufferToCloudinary(
    buffer: Buffer,
    options: UploadApiOptions
): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            options,
            (error, result) => {
                if (error || !result) {
                    return reject(error ?? new Error('Cloudinary upload failed'));
                }

                resolve(result);
            }
        );

        Readable.from(buffer).pipe(uploadStream);
    });
}

export async function uploadImageBuffer(
    file: Express.Multer.File,
    folder: string
): Promise<UploadedImage> {
    const result = await uploadBufferToCloudinary(file.buffer, {
        folder,
        resource_type: 'image',
        transformation: [
            {
                quality: 'auto',
                fetch_format: 'auto'
            }
        ]
    });

    return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
    };
}

export async function uploadVideoBuffer(
    file: Express.Multer.File,
    folder: string
): Promise<UploadedVideo> {
    const result = await uploadBufferToCloudinary(file.buffer, {
        folder,
        resource_type: 'video'
    });

    return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width ?? 0,
        height: result.height ?? 0,
        format: result.format ?? '',
        bytes: result.bytes ?? 0,
        duration: result.duration ?? 0
    };
}

export async function uploadDocumentBuffer(
    file: Express.Multer.File,
    folder: string
): Promise<UploadedDocument> {
    const result = await uploadBufferToCloudinary(file.buffer, {
        folder,
        resource_type: 'raw'
    });

    return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format ?? 'pdf',
        bytes: result.bytes ?? 0,
        originalName: file.originalname || 'documento.pdf'
    };
}

export async function deleteMedia(publicId: string, resourceType: 'image' | 'video' | 'raw'): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export async function deleteImage(publicId: string): Promise<void> {
    await deleteMedia(publicId, 'image');
}

export async function deleteRaw(publicId: string): Promise<void> {
    await deleteMedia(publicId, 'raw');
}

export async function deleteVideo(publicId: string): Promise<void> {
    await deleteMedia(publicId, 'video');
}

export async function deleteImages(publicIds: string[]): Promise<void> {
    await Promise.all(publicIds.map((id) => deleteImage(id)));
}
