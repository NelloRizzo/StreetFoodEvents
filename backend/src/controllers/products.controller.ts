import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { ProductModel } from '../models/product.model';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toProductResponse(product: {
    _id: Types.ObjectId;
    name: string;
    ingredients: string[];
    price: number;
    coverImage?: unknown | null;
    gallery?: unknown[];
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: product._id.toString(),
        name: product.name,
        ingredients: product.ingredients,
        price: product.price,
        coverImage: product.coverImage ?? null,
        gallery: product.gallery ?? [],
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
    };
}

export async function listProducts(_req: Request, res: Response) {
    const items = await ProductModel.find().sort({ name: 1 });

    return res.status(200).json({
        items: items.map(toProductResponse)
    });
}

export async function getProductById(req: Request, res: Response) {
    const productId = req.params.productId;

    if (!isValidObjectId(productId)) {
        return res.status(400).json({
            message: 'Invalid product id'
        });
    }

    const product = await ProductModel.findById(productId);

    if (!product) {
        return res.status(404).json({
            message: 'Product not found'
        });
    }

    return res.status(200).json({
        item: toProductResponse(product)
    });
}

export async function createProduct(req: Request, res: Response) {
    const {
        name,
        ingredients,
        price,
        coverImage,
        gallery
    } = req.body;

    if (price === undefined || typeof price !== 'number' || price < 0) {
        return res.status(400).json({
            message: 'Valid price is required'
        });
    }

    const product = await ProductModel.create({
        name,
        ingredients: Array.isArray(ingredients) ? ingredients : [],
        price,
        coverImage: coverImage ?? null,
        gallery: gallery ?? []
    });

    return res.status(201).json({
        item: toProductResponse(product)
    });
}

export async function updateProduct(req: Request, res: Response) {
    const productId = req.params.productId;

    if (!isValidObjectId(productId)) {
        return res.status(400).json({
            message: 'Invalid product id'
        });
    }

    const product = await ProductModel.findById(productId);

    if (!product) {
        return res.status(404).json({
            message: 'Product not found'
        });
    }

    const {
        name,
        ingredients,
        price,
        coverImage,
        gallery
    } = req.body;

    if (name !== undefined) {
        product.name = name;
    }

    if (ingredients !== undefined) {
        product.ingredients = ingredients;
    }

    if (price !== undefined) {
        if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({
                message: 'Invalid price'
            });
        }

        product.price = price;
    }

    if (coverImage !== undefined) {
        product.coverImage = coverImage;
    }

    if (gallery !== undefined) {
        product.gallery = gallery;
    }

    await product.save();

    return res.status(200).json({
        item: toProductResponse(product)
    });
}

export async function deleteProduct(req: Request, res: Response) {
    const productId = req.params.productId;

    if (!isValidObjectId(productId)) {
        return res.status(400).json({
            message: 'Invalid product id'
        });
    }

    const product = await ProductModel.findByIdAndDelete(productId);

    if (!product) {
        return res.status(404).json({
            message: 'Product not found'
        });
    }

    return res.status(204).send();
}
