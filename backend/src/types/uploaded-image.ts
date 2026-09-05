export type UploadedImage = {
    url: string;
    publicId: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
};

export type UploadedVideo = {
    url: string;
    publicId: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    duration: number;
};

export type UploadedDocument = {
    url: string;
    publicId: string;
    format: string;
    bytes: number;
    originalName: string;
};
