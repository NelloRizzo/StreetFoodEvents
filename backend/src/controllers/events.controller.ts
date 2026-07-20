import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import * as qrcode from 'qrcode';

import { EventModel } from '../models/event.model';
import { EventUserModel } from '../models/event-user.model';
import { FavoriteModel } from '../models/favorite.model';
import { sanitizeHtmlContent } from '../utils/html-sanitizer';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function generateGoogleMapsUrl(location: {
    addressLine1?: string | null;
    coordinates?: { coordinates?: number[] } | null;
    city?: string | null;
}): string | null {
    if (location.coordinates?.coordinates?.length === 2) {
        const [lng, lat] = location.coordinates.coordinates;
        if (lat !== 0 || lng !== 0) {
            return `https://www.google.com/maps/?q=${lat},${lng}`;
        }
    }

    if (location.addressLine1) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.addressLine1)}`;
    }

    if (location.city) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.city)}`;
    }

    return null;
}

function toEventResponse(event: {
    _id: Types.ObjectId;
    name: string;
    location: unknown;
    startDate: Date;
    endDate: Date;
    currencyName: string;
    currencySymbol?: unknown | null;
    exchangeRate?: number | null;
    themeBrand?: string | null;
    themeText?: string | null;
    themeSurface?: string | null;
    themeHighlight?: string | null;
    url?: string | null;
    shortDescription?: string | null;
    longDescription?: string | null;
    coverImage?: unknown | null;
    logo?: unknown | null;
    gallery?: unknown[];
    cashPaymentsEnabled?: boolean | null;
    unifiedCashierEnabled?: boolean | null;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: event._id.toString(),
        name: event.name,
        location: event.location,
        startDate: event.startDate,
        endDate: event.endDate,
        currencyName: event.currencyName,
        currencySymbol: event.currencySymbol ?? null,
        exchangeRate: event.exchangeRate ?? 1,
        themeBrand: event.themeBrand ?? null,
        themeText: event.themeText ?? null,
        themeSurface: event.themeSurface ?? null,
        themeHighlight: event.themeHighlight ?? null,
        url: event.url ?? null,
        shortDescription: event.shortDescription ?? null,
        longDescription: event.longDescription ?? null,
        coverImage: event.coverImage ?? null,
        logo: event.logo ?? null,
        gallery: event.gallery ?? [],
        cashPaymentsEnabled: event.cashPaymentsEnabled ?? true,
        unifiedCashierEnabled: event.unifiedCashierEnabled ?? false,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt
    };
}

export async function listEvents(_req: Request, res: Response) {
    const items = await EventModel.find().sort({ startDate: 1, createdAt: -1 });

    return res.status(200).json({
        items: items.map(toEventResponse)
    });
}

export async function homeEvents(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const userId = req.user.id;

    const favorites = await FavoriteModel.find({ userId, eventId: { $ne: null } })
        .populate<{ eventId: { _id: Types.ObjectId; name: string; location: unknown; startDate: Date; endDate: Date; currencyName: string; currencySymbol?: unknown; shortDescription?: string | null; logo?: unknown | null } }>('eventId')
        .sort({ createdAt: -1 });

    const favoriteEvents = await Promise.all(
        favorites.map(async (fav) => {
            if (!fav.eventId) return null;

            const eventDoc = fav.eventId;
            const wallet = await EventUserModel.findOne({
                eventId: eventDoc._id,
                userId,
                isActive: true
            });

            return {
                id: fav._id.toString(),
                event: toEventResponse(eventDoc as Parameters<typeof toEventResponse>[0]),
                wallet: wallet ? { balance: wallet.balance, joinedAt: wallet.joinedAt } : null,
                createdAt: fav.createdAt,
                updatedAt: fav.updatedAt
            };
        })
    );

    const activeEvents = await EventModel.find({ endDate: { $gte: new Date() } })
        .sort({ startDate: 1 });

    return res.status(200).json({
        favorites: favoriteEvents.filter(Boolean),
        activeEvents: activeEvents.map(toEventResponse)
    });
}

export async function getEventById(req: Request, res: Response) {
    const eventId = req.params.eventId;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({
            message: 'Invalid event id'
        });
    }

    const event = await EventModel.findById(eventId);

    if (!event) {
        return res.status(404).json({
            message: 'Event not found'
        });
    }

    return res.status(200).json({
        item: toEventResponse(event)
    });
}

export async function createEvent(req: Request, res: Response) {
    const {
        name,
        location,
        startDate,
        endDate,
        currencyName,
        currencySymbol,
        exchangeRate,
        themeBrand,
        themeText,
        themeSurface,
        themeHighlight,
        url,
        shortDescription,
        longDescription,
        coverImage,
        logo,
        gallery,
        cashPaymentsEnabled,
        unifiedCashierEnabled
    } = req.body;

    if (location && !location.googleMapsUrl) {
        location.googleMapsUrl = generateGoogleMapsUrl(location);
    }

    const event = await EventModel.create({
        name,
        location,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        currencyName,
        currencySymbol: currencySymbol ?? null,
        exchangeRate: exchangeRate ?? 1,
        themeBrand: themeBrand ?? null,
        themeText: themeText ?? null,
        themeSurface: themeSurface ?? null,
        themeHighlight: themeHighlight ?? null,
        url: url ?? null,
        shortDescription: sanitizeHtmlContent(shortDescription),
        longDescription: sanitizeHtmlContent(longDescription),
        coverImage: coverImage ?? null,
        logo: logo ?? null,
        gallery: gallery ?? [],
        cashPaymentsEnabled: cashPaymentsEnabled ?? true,
        unifiedCashierEnabled: unifiedCashierEnabled ?? false
    });

    return res.status(201).json({
        item: toEventResponse(event)
    });
}

export async function updateEvent(req: Request, res: Response) {
    const eventId = req.params.eventId;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({
            message: 'Invalid event id'
        });
    }

    const event = await EventModel.findById(eventId);

    if (!event) {
        return res.status(404).json({
            message: 'Event not found'
        });
    }

    const {
        name,
        location,
        startDate,
        endDate,
        currencyName,
        currencySymbol,
        exchangeRate,
        themeBrand,
        themeText,
        themeSurface,
        themeHighlight,
        url,
        shortDescription,
        longDescription,
        coverImage,
        logo,
        gallery,
        cashPaymentsEnabled,
        unifiedCashierEnabled
    } = req.body;

    if (name !== undefined) {
        event.name = name;
    }

    if (location !== undefined) {
        if (!location.googleMapsUrl) {
            location.googleMapsUrl = generateGoogleMapsUrl(location);
        }
        event.location = location;
    }

    if (startDate !== undefined) {
        event.startDate = new Date(startDate);
    }

    if (endDate !== undefined) {
        event.endDate = new Date(endDate);
    }

    if (currencyName !== undefined) {
        event.currencyName = currencyName;
    }

    if (currencySymbol !== undefined) {
        event.currencySymbol = currencySymbol;
    }

    if (exchangeRate !== undefined) {
        event.exchangeRate = exchangeRate;
    }

    if (themeBrand !== undefined) {
        event.themeBrand = themeBrand;
    }

    if (themeText !== undefined) {
        event.themeText = themeText;
    }

    if (themeSurface !== undefined) {
        event.themeSurface = themeSurface;
    }

    if (themeHighlight !== undefined) {
        event.themeHighlight = themeHighlight;
    }

    if (url !== undefined) {
        event.url = url;
    }

    if (shortDescription !== undefined) {
        event.shortDescription = sanitizeHtmlContent(shortDescription);
    }

    if (longDescription !== undefined) {
        event.longDescription = sanitizeHtmlContent(longDescription);
    }

    if (coverImage !== undefined) {
        event.coverImage = coverImage;
    }

    if (logo !== undefined) {
        event.logo = logo;
    }

    if (gallery !== undefined) {
        event.gallery = gallery;
    }

    if (cashPaymentsEnabled !== undefined) {
        event.cashPaymentsEnabled = cashPaymentsEnabled;
    }

    if (unifiedCashierEnabled !== undefined) {
        event.unifiedCashierEnabled = unifiedCashierEnabled;
    }

    await event.save();

    return res.status(200).json({
        item: toEventResponse(event)
    });
}

export async function eventQrCode(req: Request, res: Response) {
  const eventId = req.params.eventId;

  if (!isValidObjectId(eventId)) {
    return res.status(400).json({ message: 'Invalid event id' });
  }

  const event = await EventModel.findById(eventId);

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  const origin = req.headers.origin ?? `${req.protocol}://${req.headers.host}`;
  const url = `${origin}/events/${eventId}`;

  const qrDataUrl = await qrcode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#264137',
      light: '#ffffff'
    }
  });

  return res.status(200).json({ qrCode: qrDataUrl });
}

export async function deleteEvent(req: Request, res: Response) {
    const eventId = req.params.eventId;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({
            message: 'Invalid event id'
        });
    }

    const event = await EventModel.findByIdAndDelete(eventId);

    if (!event) {
        return res.status(404).json({
            message: 'Event not found'
        });
    }

    return res.status(204).send();
}
