import type { AuthUser } from '@/types/auth-user';
import type { UploadedDocument, UploadedImage } from '@/types/uploaded-image';

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
            uploadedImage?: UploadedImage;
            uploadedGallery?: UploadedImage[];
            uploadedDocument?: UploadedDocument;
        }
    }
}

export { };
