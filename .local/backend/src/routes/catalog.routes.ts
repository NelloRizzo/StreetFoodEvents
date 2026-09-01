import { Router, type Request, type Response } from 'express';
import { Types } from 'mongoose';

import { EventModel, EventProductModel, ProductModel, StandModel, StationModel } from '../models';

export const catalogRouter = Router();

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

interface ImageLite {
    url: string;
    width: number;
    height: number;
}

function imageToLite(image: unknown): ImageLite | null {
    if (!image || typeof image !== 'object') return null;
    const v = image as { url?: unknown; width?: unknown; height?: unknown };
    if (typeof v.url !== 'string' || typeof v.width !== 'number' || typeof v.height !== 'number') return null;
    return { url: v.url, width: v.width, height: v.height };
}

export async function getStandCatalog(req: Request, res: Response) {
    const standId = req.params.standId;
    const eventId = req.query.eventId as string | undefined;

    if (!isValidObjectId(standId)) return res.status(400).json({ message: 'Invalid stand id' });
    if (eventId && !isValidObjectId(eventId)) return res.status(400).json({ message: 'Invalid event id' });

    const stand = await StandModel.findById(standId).lean();
    if (!stand) return res.status(404).json({ message: 'Stand not found' });

    let event: any = null;
    if (eventId) event = await EventModel.findById(eventId).lean();

    const stations = await StationModel.find({ standId: stand._id }).sort({ sequenceOrder: 1 }).lean();

    const epFilter: Record<string, unknown> = { standId: stand._id, available: true };
    if (eventId) epFilter.eventId = new Types.ObjectId(eventId);

    const eventProducts = await EventProductModel.find(epFilter).sort({ sequenceOrder: 1 }).lean();
    const productIds = eventProducts.map((ep: any) => ep.productId);
    const products = await ProductModel.find({ _id: { $in: productIds } }).lean();
    const productById = new Map<string, any>(products.map((p: any) => [p._id.toString(), p]));

    const items = eventProducts.map((ep: any) => {
        const product = productById.get(ep.productId.toString());
        return {
            eventProductId: ep._id.toString(),
            productId: ep.productId.toString(),
            name: product?.name ?? '',
            description: product?.description ?? null,
            price: ep.priceOverride ?? product?.price ?? 0,
            stationIds: ep.stationIds.map((s: any) => s.toString()),
            categoryIds: ep.categoryIds ?? [],
            coverImage: imageToLite(product?.coverImage)
        };
    });

    return res.status(200).json({
        standId: stand._id.toString(),
        standName: stand.name,
        coverImage: imageToLite(stand.coverImage),
        eventId: eventId ?? null,
        eventName: event?.name ?? null,
        currencyName: event?.currencyName ?? null,
        currencySymbol: imageToLite(event?.currencySymbol),
        stations: stations.map((s: any) => ({
            id: s._id.toString(),
            name: s.name
        })),
        items
    });
}

catalogRouter.get('/stand/:standId/menu', getStandCatalog);
