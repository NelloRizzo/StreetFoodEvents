import { Readable } from 'node:stream';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { cloudinary } from '@/config/cloudinary';
import type { UploadedImage } from '@/types/uploaded-image';

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

export async function deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
}

export async function deleteImages(publicIds: string[]): Promise<void> {
    await Promise.all(publicIds.map((id) => deleteImage(id)));
}
