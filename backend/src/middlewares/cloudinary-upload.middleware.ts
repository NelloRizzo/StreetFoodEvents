import type { NextFunction, Request, Response } from 'express';
import { multerImageUpload } from '@/middlewares/upload.middleware';
import { uploadImageBuffer } from '@/services/cloudinary-upload.service';

type UploadSingleImageOptions = {
    fieldName: string;
    folder: string;
    required?: boolean;
};

export function uploadSingleImage(options: UploadSingleImageOptions) {
    return [
        multerImageUpload.single(options.fieldName),

        async (req: Request, res: Response, next: NextFunction) => {
            try {
                if (!req.file) {
                    if (options.required) {
                        return res.status(400).json({
                            message: `${options.fieldName} is required`
                        });
                    }

                    return next();
                }

                req.uploadedImage = await uploadImageBuffer(req.file, options.folder);

                return next();
            } catch (error) {
                return next(error);
            }
        }
    ];
}
type UploadImageGalleryOptions = {
    fieldName: string;
    folder: string;
    maxCount?: number;
    required?: boolean;
};

export function uploadImageGallery(options: UploadImageGalleryOptions) {
    return [
        multerImageUpload.array(options.fieldName, options.maxCount ?? 10),

        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const files = req.files as Express.Multer.File[] | undefined;

                if (!files?.length) {
                    if (options.required) {
                        return res.status(400).json({
                            message: `${options.fieldName} is required`
                        });
                    }

                    return next();
                }

                req.uploadedGallery = await Promise.all(
                    files.map((file) => uploadImageBuffer(file, options.folder))
                );

                return next();
            } catch (error) {
                return next(error);
            }
        }
    ];
}
