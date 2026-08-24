import { type HydratedDocument } from 'mongoose';
import { env } from '../config/env';
import { EventPhotoModel } from '../models/event-photo.model';
import { SocialPostModel, type SocialPost } from '../models/social-post.model';

const GRAPH_VERSION = 'v23.0';
const GRAPH_HOST = 'https://graph.facebook.com';

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 60_000;
const BATCH_SIZE = 10;
const IG_CONTAINER_TIMEOUT_MS = 45_000;
const IG_CONTAINER_POLL_MS = 2_000;

export type SocialPublishConfig = {
    facebook: boolean;
    instagram: boolean;
};

export function getSocialPublishConfig(): SocialPublishConfig {
    return {
        facebook: Boolean(env.META_PAGE_ACCESS_TOKEN && env.META_PAGE_ID),
        instagram: Boolean(env.META_PAGE_ACCESS_TOKEN && env.META_IG_USER_ID)
    };
}

type GraphErrorResponse = {
    error?: { message?: string; type?: string; code?: number };
};

async function graphPost(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const body = new URLSearchParams(params);

    const res = await fetch(`${GRAPH_HOST}/${GRAPH_VERSION}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });

    const json = (await res.json().catch(() => ({}))) as GraphErrorResponse & Record<string, unknown>;

    if (!res.ok) {
        throw new Error(json.error?.message ?? `Graph API error ${res.status}`);
    }

    return json;
}

async function graphGet(path: string, accessToken: string): Promise<Record<string, unknown>> {
    const separator = path.includes('?') ? '&' : '?';
    const res = await fetch(
        `${GRAPH_HOST}/${GRAPH_VERSION}/${path}${separator}access_token=${encodeURIComponent(accessToken)}`
    );

    const json = (await res.json().catch(() => ({}))) as GraphErrorResponse & Record<string, unknown>;

    if (!res.ok) {
        throw new Error(json.error?.message ?? `Graph API error ${res.status}`);
    }

    return json;
}

async function publishToFacebook(imageUrl: string, caption: string): Promise<{ remotePostId: string; permalink: string | null }> {
    const result = await graphPost(`${env.META_PAGE_ID}/photos`, {
        url: imageUrl,
        caption,
        access_token: env.META_PAGE_ACCESS_TOKEN!
    });

    const remotePostId = typeof result.post_id === 'string' ? result.post_id : typeof result.id === 'string' ? result.id : '';

    if (!remotePostId) {
        throw new Error('Risposta Facebook priva di id post');
    }

    let permalink: string | null = null;
    try {
        const details = await graphGet(remotePostId, env.META_PAGE_ACCESS_TOKEN!);
        permalink = typeof details.permalink_url === 'string' ? details.permalink_url : null;
    } catch {
        permalink = null;
    }

    return { remotePostId, permalink };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForInstagramContainer(containerId: string): Promise<void> {
    const deadline = Date.now() + IG_CONTAINER_TIMEOUT_MS;

    while (Date.now() < deadline) {
        const container = await graphGet(
            `${containerId}?fields=status_code`,
            env.META_PAGE_ACCESS_TOKEN!
        );

        const statusCode = container.status_code;

        if (statusCode === 'FINISHED') return;
        if (statusCode === 'EXPIRED' || statusCode === 'ERROR') {
            throw new Error(`Container Instagram in stato ${String(statusCode)}`);
        }

        await sleep(IG_CONTAINER_POLL_MS);
    }

    throw new Error('Timeout attesa elaborazione container Instagram');
}

async function publishToInstagram(imageUrl: string, caption: string): Promise<{ remotePostId: string; permalink: string | null }> {
    const container = await graphPost(`${env.META_IG_USER_ID}/media`, {
        image_url: imageUrl,
        caption,
        access_token: env.META_PAGE_ACCESS_TOKEN!
    });

    const containerId = typeof container.id === 'string' ? container.id : '';
    if (!containerId) {
        throw new Error('Risposta Instagram priva di id container');
    }

    await waitForInstagramContainer(containerId);

    const published = await graphPost(`${env.META_IG_USER_ID}/media_publish`, {
        creation_id: containerId,
        access_token: env.META_PAGE_ACCESS_TOKEN!
    });

    const remotePostId = typeof published.id === 'string' ? published.id : '';
    if (!remotePostId) {
        throw new Error('Risposta Instagram priva di id post');
    }

    let permalink: string | null = null;
    try {
        const details = await graphGet(remotePostId, env.META_PAGE_ACCESS_TOKEN!);
        permalink = typeof details.permalink === 'string' ? details.permalink : null;
    } catch {
        permalink = null;
    }

    return { remotePostId, permalink };
}

export async function processSocialPost(post: HydratedDocument<SocialPost>): Promise<void> {
    post.status = 'processing';
    post.attempts += 1;
    await post.save();

    try {
        const photo = await EventPhotoModel.findById(post.photoId);

        if (!photo || photo.eventId.toString() !== post.eventId.toString()) {
            post.status = 'failed';
            post.lastError = 'Foto non trovata';
            await post.save();
            return;
        }

        const imageUrl = photo.image?.url;
        if (!imageUrl) {
            post.status = 'failed';
            post.lastError = 'La foto non ha un indirizzo immagine valido';
            await post.save();
            return;
        }

        const result =
            post.platform === 'facebook'
                ? await publishToFacebook(imageUrl, post.caption)
                : await publishToInstagram(imageUrl, post.caption);

        post.status = 'published';
        post.remotePostId = result.remotePostId;
        post.permalink = result.permalink;
        post.publishedAt = new Date();
        post.lastError = null;
        post.nextAttemptAt = null;
        await post.save();
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore sconosciuto';
        post.lastError = message;

        if (post.attempts >= MAX_ATTEMPTS) {
            post.status = 'failed';
            post.nextAttemptAt = null;
        } else {
            post.status = 'pending';
            post.nextAttemptAt = new Date(Date.now() + post.attempts * RETRY_BASE_DELAY_MS);
        }

        await post.save();
    }
}

export async function runSocialPublishQueueOnce(): Promise<number> {
    const due = await SocialPostModel.find({
        status: 'pending',
        $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: new Date() } }]
    })
        .sort({ createdAt: 1 })
        .limit(BATCH_SIZE);

    for (const post of due) {
        await processSocialPost(post);
    }

    return due.length;
}

let workerTimer: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

export function startSocialPublishWorker(intervalMs = 15_000): void {
    if (workerTimer) return;

    workerTimer = setInterval(() => {
        if (isProcessing) return;
        isProcessing = true;
        void runSocialPublishQueueOnce()
            .catch((err) => {
                console.error('[social-publish-worker] failed:', err);
            })
            .finally(() => {
                isProcessing = false;
            });
    }, intervalMs);
}
