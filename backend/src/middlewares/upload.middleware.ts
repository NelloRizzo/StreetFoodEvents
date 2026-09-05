import multer from 'multer';

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

const allowedVideoMimeTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska'
];

export const multerImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid image format'));
        }

        cb(null, true);
    }
});

export const multerMediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
        if (!allowedMimeTypes.includes(file.mimetype) && !allowedVideoMimeTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid media format'));
        }

        cb(null, true);
    }
});

const allowedDocumentMimeTypes = ['application/pdf'];

export const multerDocumentUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
        if (!allowedDocumentMimeTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid document format'));
        }

        cb(null, true);
    }
});
