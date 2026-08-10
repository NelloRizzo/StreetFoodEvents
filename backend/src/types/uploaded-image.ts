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
