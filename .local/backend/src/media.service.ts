import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { config } from './config';
import type { Image } from './models/schemas/image.schema';

const FORMAT_EXT: Record<string, string> = {
    jpg: 'jpg',
    jpeg: 'jpg',
    png: 'png',
    gif: 'gif',
    webp: 'webp',
    svg: 'svg'
};

function ensureMediaDir(): void {
    fs.mkdirSync(config.mediaDir, { recursive: true });
}

function extFromFormat(format?: string): string {
    if (!format) return 'img';
    return FORMAT_EXT[format.toLowerCase()] ?? 'img';
}

function urlIsLocal(url: string): boolean {
    return url.startsWith(config.assetsUrlPrefix);
}

async function resolveRemote(image: Image): Promise<Image> {
    const res = await fetch(image.url);
    if (!res.ok) {
        throw new Error(`download failed (${res.status}) for ${image.url}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    const hash = crypto.createHash('sha1').update(buf).digest('hex');
    const ext = extFromFormat(image.format);
    const fileName = `${hash}.${ext}`;
    const filePath = path.join(config.mediaDir, fileName);

    if (!fs.existsSync(filePath)) {
        ensureMediaDir();
        await fsp.writeFile(filePath, buf);
    }

    return {
        ...image,
        url: `${config.assetsUrlPrefix}/${fileName}`,
        publicId: fileName,
        bytes: buf.length
    };
}

/**
 * Downloads a single remote image and rewrites it to point at the local
 * static asset. If the image is already local (or missing), it is returned
 * unchanged. On download failure the remote URL is kept (data stays usable
 * when the laptop is online).
 */
export async function localizeImage(image: Image | null | undefined): Promise<Image | null> {
    if (!image || !image.url) return image ?? null;
    if (urlIsLocal(image.url)) return image;
    try {
        return await resolveRemote(image);
    } catch (error) {
        console.warn(`[media] keep remote url for ${image.url}: ${error instanceof Error ? error.message : String(error)}`);
        return image;
    }
}

export async function localizeImages(images: Image[] | null | undefined): Promise<Image[]> {
    if (!images || images.length === 0) return images ?? [];
    const out: Image[] = [];
    for (const image of images) {
        const localized = await localizeImage(image);
        if (localized) out.push(localized);
    }
    return out;
}

function readImage(value: unknown): Image | null {
    if (!value || typeof value !== 'object') return null;
    return value as Image;
}

function readImages(value: unknown): Image[] | null {
    if (!Array.isArray(value)) return null;
    return value as Image[];
}

export async function localizeEventImages(event: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
        ...event,
        coverImage: await localizeImage(readImage(event.coverImage)),
        logo: await localizeImage(readImage(event.logo)),
        currencySymbol: await localizeImage(readImage(event.currencySymbol)),
        gallery: await localizeImages(readImages(event.gallery))
    };
}

export async function localizeStandImages(stand: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
        ...stand,
        coverImage: await localizeImage(readImage(stand.coverImage)),
        logo: await localizeImage(readImage(stand.logo)),
        gallery: await localizeImages(readImages(stand.gallery))
    };
}

export async function localizeProductImages(product: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
        ...product,
        coverImage: await localizeImage(readImage(product.coverImage)),
        gallery: await localizeImages(readImages(product.gallery))
    };
}