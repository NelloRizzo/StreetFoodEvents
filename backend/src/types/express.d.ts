import type { AuthUser } from '@/types/auth-user';
import type { UploadedImage } from '@/types/uploaded-image';

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
            uploadedImage?: UploadedImage;
            uploadedGallery?: UploadedImage[];
        }
    }
}

export { };
