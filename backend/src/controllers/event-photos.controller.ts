import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { EmailSubscriptionModel } from '../models/email-subscription.model';
import { EventModel } from '../models/event.model';
import { EventPhotoLikeModel } from '../models/event-photo-like.model';
import { EventPhotoModel } from '../models/event-photo.model';
import { deleteImage, deleteVideo, uploadImageBuffer, uploadVideoBuffer } from '../services/cloudinary-upload.service';
import { isEmailConfigured, sendPhotoEmail, sendPhotosEmail } from '../services/email.service';
import { hashDeviceId } from '../utils/device-hash';
import { ensureEventStarted } from '../utils/event-schedule';
import { rankByCount } from '../utils/photo-ranking';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toPhotoResponse(photo: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    type: 'image' | 'video';
    image?: { url: string; publicId: string; width: number; height: number; format: string; bytes: number } | null;
    video?: { url: string; publicId: string; width: number; height: number; format: string; bytes: number; duration: number } | null;
    sequenceNumber: number;
    takenAt: Date;
    frameId?: Types.ObjectId | null;
    createdBy?: Types.ObjectId | null;
    createdAt: Date;
}) {
    return {
        id: photo._id.toString(),
        eventId: photo.eventId.toString(),
        type: photo.type,
        image: photo.image ?? null,
        video: photo.video ?? null,
        sequenceNumber: photo.sequenceNumber,
        takenAt: photo.takenAt,
        frameId: photo.frameId?.toString() ?? null,
        createdBy: photo.createdBy?.toString() ?? null,
        createdAt: photo.createdAt
    };
}

/** Numero di «mi piace» per foto dell'evento, con il gradino (medaglia) e se
 *  il dispositivo che sta guardando ha gia' messo il like. Il conteggio e'
 *  pubblico (le medaglie si vedono nella galleria), il "mio like" no: dipende
 *  dal deviceId passato dal client. */
async function getLikeInfoByPhoto(eventId: string, deviceId: string) {
    const likes = await EventPhotoLikeModel.find({ eventId }).select('photoId deviceIdHash').lean();
    const deviceHash = deviceId ? hashDeviceId(deviceId) : '';

    const countByPhoto = new Map<string, number>();
    const likedByPhoto = new Set<string>();

    for (const like of likes) {
        /* `photoId` e' ObjectId ma la chiave della mappa e' la stringa: senza
           String() il confronto con gli id della risposta non trova nulla. */
        const photoId = String(like.photoId);
        countByPhoto.set(photoId, (countByPhoto.get(photoId) ?? 0) + 1);
        if (deviceHash && like.deviceIdHash === deviceHash) likedByPhoto.add(photoId);
    }

    // solo le prime tre posizioni: la medaglia e' l'unico uso del gradino
    const rankByPhoto = new Map(
        rankByCount(countByPhoto, { maxRank: 3 }).map((row) => [row.photoId, row.rank])
    );

    return { countByPhoto, likedByPhoto, rankByPhoto };
}

export async function listEventPhotos(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const items = await EventPhotoModel.find({ eventId }).sort({ sequenceNumber: -1 });
    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : '';
    const { countByPhoto, likedByPhoto, rankByPhoto } = await getLikeInfoByPhoto(eventId, deviceId);

    return res.status(200).json({
        items: items.map((photo) => {
            const id = photo._id.toString();
            return {
                ...toPhotoResponse(photo),
                likeCount: countByPhoto.get(id) ?? 0,
                liked: likedByPhoto.has(id),
                rank: rankByPhoto.get(id) ?? null
            };
        })
    });
}

/* Toggle del «mi piace»: lo stesso dispositivo puo' togliere quello che ha
   messo (ripressione = rimozione del record), altrimenti un tocco sbagliato
   resterebbe per sempre. Un like per foto e per dispositivo, non uno per
   galleria: lo stesso telefono puo' votare piu' foto. */
export async function toggleEventPhotoLike(req: Request, res: Response) {
    const { eventId, photoId } = req.params;

    if (!isValidObjectId(eventId) || !isValidObjectId(photoId)) {
        return res.status(400).json({ message: 'Invalid id' });
    }

    const { deviceId } = req.body ?? {};
    if (typeof deviceId !== 'string' || !deviceId.trim()) {
        return res.status(400).json({ message: 'deviceId richiesto' });
    }

    const photo = await EventPhotoModel.findOne({ _id: photoId, eventId }).select('type').lean();
    if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
    }

    if (photo.type !== 'image') {
        return res.status(400).json({ message: 'I «mi piace» sono disponibili solo per le foto' });
    }

    const deviceIdHash = hashDeviceId(deviceId.trim());
    const existing = await EventPhotoLikeModel.findOne({ photoId, deviceIdHash });

    let liked: boolean;
    if (existing) {
        await EventPhotoLikeModel.deleteOne({ _id: existing._id });
        liked = false;
    } else {
        try {
            await EventPhotoLikeModel.create({
                eventId,
                photoId,
                deviceIdHash,
                userId: req.user?.id ?? null
            });
            liked = true;
        } catch (error) {
            /* Due richieste in parallelo dallo stesso dispositivo (doppio
               tocco, due tab): l'indice unico fa fallire la seconda. Il like
               esiste gia', quindi il risultato e' lo stesso e non e' un 500. */
            const isDuplicateKey =
                typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
            if (!isDuplicateKey) throw error;
            liked = true;
        }
    }

    const likeCount = await EventPhotoLikeModel.countDocuments({ photoId });

    return res.status(200).json({ liked, likeCount });
}

export async function createEventPhoto(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    /* Un evento non ancora iniziato non ha foto: immagini scattate prima del
       via finirebbero in galleria e nel raggruppamento "foto per giorno" fuori
       dal periodo dell'evento, e nessuno le spiegherà. Se l'evento non esiste
       non si blocca (comportamento preesistente: la validità dell'id la
       controlla chi legge la galleria). */
    const event = await EventModel.findById(eventId).select('startDate');
    if (!ensureEventStarted(event, res)) return;

    const files = req.files as
        | { [fieldname: string]: Express.Multer.File[] }
        | Express.Multer.File[]
        | undefined;
    const imageFile = Array.isArray(files) ? undefined : files?.image?.[0];
    const videoFile = Array.isArray(files) ? undefined : files?.video?.[0];

    if (!imageFile && !videoFile) {
        return res.status(400).json({ message: 'Image or video file is required' });
    }

    if (videoFile && !req.user) {
        return res.status(401).json({ message: 'Authentication required for video upload' });
    }

    const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const folder = `events/${eventId}/photos/${nowStr}`;

    let type: 'image' | 'video';
    let image = null;
    let video = null;

    if (videoFile) {
        type = 'video';
        video = await uploadVideoBuffer(videoFile, folder);
    } else {
        if (!imageFile) {
            return res.status(400).json({ message: 'Image or video file is required' });
        }
        type = 'image';
        image = await uploadImageBuffer(imageFile, folder);
    }

    const lastPhoto = await EventPhotoModel.findOne({ eventId }).sort({ sequenceNumber: -1 }).select('sequenceNumber');
    const sequenceNumber = (lastPhoto?.sequenceNumber ?? 0) + 1;

    const now = new Date();

    const photo = await EventPhotoModel.create({
        eventId,
        type,
        image,
        video,
        sequenceNumber,
        takenAt: now,
        frameId: req.body.frameId ?? null,
        createdBy: req.user?.id ?? null
    });

    return res.status(201).json({ item: toPhotoResponse(photo) });
}

export async function deleteEventPhoto(req: Request, res: Response) {
    const { eventId, photoId } = req.params;

    if (!isValidObjectId(eventId) || !isValidObjectId(photoId)) {
        return res.status(400).json({ message: 'Invalid id' });
    }

    const photo = await EventPhotoModel.findOneAndDelete({ _id: photoId, eventId });

    if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
    }

    // i «mi piace» non hanno senso senza la foto: nessun orfano da ripulire
    await EventPhotoLikeModel.deleteMany({ photoId });

    if (photo.type === 'video' && photo.video?.publicId) {
        await deleteVideo(photo.video.publicId).catch(() => {});
    } else if (photo.image?.publicId) {
        await deleteImage(photo.image.publicId).catch(() => {});
    }

    return res.status(204).send();
}

export async function deleteAllEventPhotos(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const photos = await EventPhotoModel.find({ eventId }).select('type image.publicId video.publicId');

    const deletions = photos
        .map((p) => {
            if (p.type === 'video' && p.video?.publicId) return deleteVideo(p.video.publicId).catch(() => {});
            if (p.image?.publicId) return deleteImage(p.image.publicId).catch(() => {});
            return null;
        })
        .filter((d): d is Promise<void> => d !== null);

    await EventPhotoModel.deleteMany({ eventId });
    await EventPhotoLikeModel.deleteMany({ eventId });

    if (deletions.length > 0) {
        await Promise.all(deletions);
    }

    return res.status(204).send();
}

export async function sendEventPhotoEmail(req: Request, res: Response) {
    const { eventId, photoId } = req.params;

    if (!isValidObjectId(eventId) || !isValidObjectId(photoId)) {
        return res.status(400).json({ message: 'Invalid id' });
    }

    const { email, marketingConsent } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ message: 'Invalid email address' });
    }

    if (!isEmailConfigured()) {
        return res.status(400).json({ message: 'Invio email non configurato. Contatta l\'amministratore.' });
    }

    const photo = await EventPhotoModel.findById(photoId);
    if (!photo || photo.eventId.toString() !== eventId) {
        return res.status(404).json({ message: 'Photo not found' });
    }

    if (photo.type === 'video') {
        return res.status(400).json({ message: 'Invio email disponibile solo per le foto' });
    }

    const event = await EventModel.findById(eventId);
    const eventName = event?.name;
    const eventLocation = (event?.location as { label?: string } | undefined)?.label;

    try {
        await sendPhotoEmail(email, photo.image?.url ?? '', eventName ?? undefined, eventLocation ?? undefined);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore sconosciuto';
        return res.status(500).json({ message });
    }

    await recordEmailSubscription(email, eventId, marketingConsent, req.ip ?? null);

    return res.status(200).json({ message: 'Email sent' });
}

export async function sendEventPhotosEmail(req: Request, res: Response) {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const { email, photoIds, marketingConsent } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ message: 'Invalid email address' });
    }

    if (!Array.isArray(photoIds) || photoIds.length === 0 || photoIds.some((id) => !isValidObjectId(id))) {
        return res.status(400).json({ message: 'Invalid photo ids' });
    }

    if (!isEmailConfigured()) {
        return res.status(400).json({ message: 'Invio email non configurato. Contatta l\'amministratore.' });
    }

    const photos = await EventPhotoModel.find({ _id: { $in: photoIds }, eventId });

    if (photos.length !== photoIds.length) {
        return res.status(404).json({ message: 'One or more photos not found' });
    }

    if (photos.some((p) => p.type === 'video')) {
        return res.status(400).json({ message: 'Invio email disponibile solo per le foto' });
    }

    const photoUrls = photos
        .map((p) => p.image?.url ?? '')
        .filter((url) => url.length > 0);

    if (photoUrls.length === 0) {
        return res.status(400).json({ message: 'Invio email disponibile solo per le foto' });
    }

    const event = await EventModel.findById(eventId);
    const eventName = event?.name;
    const eventLocation = (event?.location as { label?: string } | undefined)?.label;

    try {
        await sendPhotosEmail(email, photoUrls, eventName ?? undefined, eventLocation ?? undefined);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore sconosciuto';
        return res.status(500).json({ message });
    }

    await recordEmailSubscription(email, eventId, marketingConsent, req.ip ?? null);

    return res.status(200).json({ message: 'Email sent' });
}

async function recordEmailSubscription(
    email: string,
    eventId: string,
    marketingConsent: unknown,
    ip: string | null
) {
    await EmailSubscriptionModel.findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        {
            $set: {
                email: email.toLowerCase().trim(),
                eventId,
                source: 'photo-email',
                marketingConsent: !!marketingConsent,
                consentTimestamp: new Date(),
                consentIp: ip,
                isActive: true,
                unsubscribedAt: null
            }
        },
        { upsert: true, new: true }
    ).catch((err) => {
        console.error('[sendEventPhotosEmail] failed to record subscription:', err);
    });
}
