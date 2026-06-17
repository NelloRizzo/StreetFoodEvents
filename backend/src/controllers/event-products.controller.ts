import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { EventProductModel } from '../models/event-product.model';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

type PopulatedProduct = {
    _id: Types.ObjectId;
    name: string;
    ingredients: string[];
    price: number;
};

function toEventProductResponse(ep: {
    _id: Types.ObjectId;
    eventId: Types.ObjectId;
    standId: Types.ObjectId;
    productId: Types.ObjectId | PopulatedProduct;
    stationIds: Types.ObjectId[];
    priceOverride?: number | null;
    available?: boolean;
    createdAt: Date;
    updatedAt: Date;
}) {
    const isPopulated = typeof ep.productId === 'object' && ep.productId !== null && '_id' in ep.productId;
    const product = isPopulated ? (ep.productId as PopulatedProduct) : null;

    return {
        id: ep._id.toString(),
        eventId: ep.eventId.toString(),
        standId: ep.standId.toString(),
        productId: isPopulated ? product!._id.toString() : ep.productId.toString(),
        product: isPopulated
            ? {
                  id: product!._id.toString(),
                  name: product!.name,
                  price: product!.price,
                  ingredients: product!.ingredients,
              }
            : null,
        stationIds: ep.stationIds.map((id) => id.toString()),
        priceOverride: ep.priceOverride ?? null,
        available: ep.available ?? true,
        createdAt: ep.createdAt,
        updatedAt: ep.updatedAt
    };
}

export async function listEventProducts(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};

    if (req.query.eventId) {
        filter.eventId = req.query.eventId;
    }

    if (req.query.standId) {
        filter.standId = req.query.standId;
    }

    const items = await EventProductModel.find(filter)
        .populate('productId')
        .sort({ createdAt: -1 });

    return res.status(200).json({
        items: items.map(toEventProductResponse)
    });
}

export async function getEventProductById(req: Request, res: Response) {
    const epId = req.params.epId;

    if (!isValidObjectId(epId)) {
        return res.status(400).json({
            message: 'Invalid event product id'
        });
    }

    const ep = await EventProductModel.findById(epId).populate('productId');

    if (!ep) {
        return res.status(404).json({
            message: 'Event product not found'
        });
    }

    return res.status(200).json({
        item: toEventProductResponse(ep)
    });
}

export async function createEventProduct(req: Request, res: Response) {
    const {
        eventId,
        standId,
        productId,
        stationIds,
        priceOverride
    } = req.body;

    if (!eventId || !isValidObjectId(eventId)) {
        return res.status(400).json({
            message: 'Invalid or missing eventId'
        });
    }

    if (!standId || !isValidObjectId(standId)) {
        return res.status(400).json({
            message: 'Invalid or missing standId'
        });
    }

    if (!productId || !isValidObjectId(productId)) {
        return res.status(400).json({
            message: 'Invalid or missing productId'
        });
    }

    if (!Array.isArray(stationIds) || stationIds.length === 0) {
        return res.status(400).json({
            message: 'At least one stationId is required'
        });
    }

    const existing = await EventProductModel.findOne({
        eventId,
        standId,
        productId
    });

    if (existing) {
        return res.status(409).json({
            message: 'Product already linked to this event and stand'
        });
    }

    const ep = await EventProductModel.create({
        eventId,
        standId,
        productId,
        stationIds,
        priceOverride: priceOverride ?? null
    });

    return res.status(201).json({
        item: toEventProductResponse(ep)
    });
}

export async function updateEventProduct(req: Request, res: Response) {
    const epId = req.params.epId;

    if (!isValidObjectId(epId)) {
        return res.status(400).json({
            message: 'Invalid event product id'
        });
    }

    const ep = await EventProductModel.findById(epId);

    if (!ep) {
        return res.status(404).json({
            message: 'Event product not found'
        });
    }

    const {
        stationIds,
        priceOverride,
        available
    } = req.body;

    if (stationIds !== undefined) {
        if (!Array.isArray(stationIds) || stationIds.length === 0) {
            return res.status(400).json({
                message: 'At least one stationId is required'
            });
        }

        ep.stationIds = stationIds;
    }

    if (priceOverride !== undefined) {
        ep.priceOverride = priceOverride;
    }

    if (available !== undefined) {
        ep.available = available;
    }

    await ep.save();

    return res.status(200).json({
        item: toEventProductResponse(ep)
    });
}

export async function deleteEventProduct(req: Request, res: Response) {
    const epId = req.params.epId;

    if (!isValidObjectId(epId)) {
        return res.status(400).json({
            message: 'Invalid event product id'
        });
    }

    const ep = await EventProductModel.findByIdAndDelete(epId);

    if (!ep) {
        return res.status(404).json({
            message: 'Event product not found'
        });
    }

    return res.status(204).send();
}
