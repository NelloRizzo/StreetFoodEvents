import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import * as qrcode from 'qrcode';

import { EventModel } from '../models/event.model';
import { EventUserModel } from '../models/event-user.model';
import { FavoriteModel } from '../models/favorite.model';
import { RoleModel } from '../models/role.model';
import { UserRoleModel } from '../models/user-role.model';
import { sanitizeHtmlContent } from '../utils/html-sanitizer';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

async function isEventManager(userId: string) {
    const platformRoleIds = await RoleModel.find({ scope: 'platform' }).distinct('_id');
    if (platformRoleIds.length > 0) {
        const platformRole = await UserRoleModel.findOne({
            userId,
            roleId: { $in: platformRoleIds },
            isActive: true
        });
        if (platformRole) {
            return true;
        }
    }

    const eventRoleIds = await RoleModel.find({ scope: 'event' }).distinct('_id');
    if (eventRoleIds.length > 0) {
        const eventRole = await UserRoleModel.findOne({
            userId,
            roleId: { $in: eventRoleIds },
            isActive: true
        });
        if (eventRole) {
            return true;
        }
    }

    return false;
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
    slideshowTitle?: string | null;
    isPublic?: boolean | null;
    feeBands?: unknown[];
    denominations?: unknown[];
    categories?: unknown[];
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
        slideshowTitle: event.slideshowTitle ?? null,
        isPublic: event.isPublic ?? true,
        feeBands: event.feeBands ?? [],
        denominations: event.denominations ?? [],
        categories: event.categories ?? [],
        createdAt: event.createdAt,
        updatedAt: event.updatedAt
    };
}

export async function listEvents(req: Request, res: Response) {
    // `?public=true`: surface pubbliche (home, menu Eventi navbar) — mostra SOLO eventi visibili,
    // anche se l'utente è un gestore (che altrove vede anche gli eventi nascosti).
    const forcePublic = req.query.public === 'true';
    const canManage = req.user ? await isEventManager(req.user.id) : false;
    const filter = !forcePublic && canManage ? {} : { isPublic: { $ne: false } };

    const items = await EventModel.find(filter).sort({ startDate: 1, createdAt: -1 });

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

    const activeEvents = await EventModel.find({ isPublic: { $ne: false }, endDate: { $gte: new Date() } })
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
        unifiedCashierEnabled,
        slideshowTitle,
        isPublic,
        feeBands,
        denominations,
        categories
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
        unifiedCashierEnabled: unifiedCashierEnabled ?? false,
        slideshowTitle: slideshowTitle ?? null,
        isPublic: isPublic ?? true,
        feeBands: Array.isArray(feeBands) ? feeBands : [],
        denominations: Array.isArray(denominations) ? denominations : [],
        categories: Array.isArray(categories) ? categories : []
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
        unifiedCashierEnabled,
        slideshowTitle,
        isPublic,
        feeBands,
        denominations,
        categories
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

    if (slideshowTitle !== undefined) {
        event.slideshowTitle = slideshowTitle;
    }

    if (isPublic !== undefined) {
        event.isPublic = isPublic;
    }

    if (feeBands !== undefined) {
        event.set('feeBands', Array.isArray(feeBands) ? feeBands : []);
    }

    if (denominations !== undefined) {
        event.set('denominations', Array.isArray(denominations) ? denominations : []);
    }

    if (categories !== undefined) {
        event.set('categories', Array.isArray(categories) ? categories : []);
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

export async function eventMenuQrCode(req: Request, res: Response) {
  const eventId = req.params.eventId;

  if (!isValidObjectId(eventId)) {
    return res.status(400).json({ message: 'Invalid event id' });
  }

  const event = await EventModel.findById(eventId);

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  const { StandModel } = await import('../models/stand.model');

  const stands = await StandModel.find({ eventIds: new Types.ObjectId(eventId) })
    .select('name numbers');

  const eventIdObj = new Types.ObjectId(eventId);
  const firstStand = stands
    .filter((s) => s.numbers?.some((n) => n.eventId.equals(eventIdObj) && n.showOnMap !== false))
    .sort((a, b) => {
      const numA = a.numbers?.find((n) => n.eventId.equals(eventIdObj))?.number ?? Infinity;
      const numB = b.numbers?.find((n) => n.eventId.equals(eventIdObj))?.number ?? Infinity;
      return numA - numB;
    })[0];

  if (!firstStand) {
    return res.status(404).json({ message: 'No visible stands for this event' });
  }

  const origin = req.headers.origin ?? `${req.protocol}://${req.headers.host}`;
  const url = `${origin}/events/${eventId}/stands/${firstStand._id.toString()}`;

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

export async function eventContestsQrCode(req: Request, res: Response) {
  const eventId = req.params.eventId;

  if (!isValidObjectId(eventId)) {
    return res.status(400).json({ message: 'Invalid event id' });
  }

  const event = await EventModel.findById(eventId);

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  const origin = req.headers.origin ?? `${req.protocol}://${req.headers.host}`;
  const url = `${origin}/events/${eventId}/contests`;

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

export async function eventMenu(req: Request, res: Response) {
    const eventId = req.params.eventId;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await EventModel.findById(eventId);
    if (!event) {
        return res.status(404).json({ message: 'Event not found' });
    }

    const { EventProductModel } = await import('../models/event-product.model');
    const { StandModel } = await import('../models/stand.model');

    const eventIdObj = new Types.ObjectId(eventId);

    const [eventProducts, stands] = await Promise.all([
        EventProductModel.find({ eventId: eventIdObj, available: true })
            .populate('productId')
            .sort({ sequenceOrder: 1, createdAt: 1 })
            .lean(),
        StandModel.find({ eventIds: eventIdObj })
            .select('name numbers coverImage logo')
            .lean()
    ]);

    const standMap = new Map(stands.map((s) => [s._id.toString(), s]));

    const standItems = eventProducts
        .filter((ep) => ep.productId)
        .map((ep) => {
            const stand = standMap.get(ep.standId.toString());
            const product = ep.productId as unknown as { _id: Types.ObjectId; name: string; price: number; ingredients: string[]; coverImage: unknown; gallery: unknown[] };
            const standNumber = stand?.numbers?.find((n) => n.eventId.equals(eventIdObj));

            return {
                standId: ep.standId.toString(),
                standName: stand?.name ?? '',
                standNumber: standNumber?.number ?? null,
                standCoverImage: stand?.coverImage ?? null,
                standLogo: stand?.logo ?? null,
                productId: product._id.toString(),
                eventProductId: ep._id.toString(),
                name: product.name,
                price: ep.priceOverride ?? product.price,
                ingredients: product.ingredients,
                coverImage: product.coverImage ?? null,
                gallery: product.gallery ?? [],
                categoryId: ep.categoryId ?? null,
                stationIds: ep.stationIds.map((id) => id.toString()),
                sequenceOrder: ep.sequenceOrder ?? 0,
            };
        });

    const categories = (event.categories ?? []) as Array<{ label: string; sortOrder?: number }>;
    const categoryLabels = categories
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((c) => c.label);

    const byCategory: Record<string, typeof standItems> = {};
    for (const label of categoryLabels) {
        byCategory[label] = [];
    }
    byCategory['Senza categoria'] = [];

    for (const item of standItems) {
        const cat = item.categoryId;
        if (cat && byCategory[cat]) {
            byCategory[cat].push(item);
        } else if (cat) {
            byCategory[cat] = [item];
        } else {
            byCategory['Senza categoria'].push(item);
        }
    }

    return res.status(200).json({
        event: {
            id: event._id.toString(),
            name: event.name,
            currencyName: event.currencyName,
            currencySymbol: event.currencySymbol ?? null,
            exchangeRate: event.exchangeRate ?? 1,
        },
        categories: categoryLabels,
        items: standItems,
        byCategory,
    });
}
