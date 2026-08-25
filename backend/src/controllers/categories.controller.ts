import { type Request, type Response } from 'express';

import { CategoryModel } from '@/models/category.model';

function toCategoryResponse(cat: InstanceType<typeof CategoryModel>) {
    return {
        id: cat._id.toString(),
        label: cat.label,
        sortOrder: cat.sortOrder ?? 0,
        createdAt: cat.createdAt,
    };
}

export async function listCategories(_req: Request, res: Response) {
    const categories = await CategoryModel.find().sort({ sortOrder: 1, label: 1 });
    return res.json({ items: categories.map(toCategoryResponse) });
}

export async function createCategory(req: Request, res: Response) {
    const { label, sortOrder } = req.body;
    const normalized = (label ?? '').trim().replace(/\s+/g, ' ');
    if (!normalized) {
        return res.status(400).json({ message: 'Label is required' });
    }
    if (normalized.length > 80) {
        return res.status(400).json({ message: 'Label must be 80 characters or less' });
    }

    const existing = await CategoryModel.findOne({ label: normalized });
    if (existing) {
        return res.status(200).json({ item: toCategoryResponse(existing) });
    }

    const cat = await CategoryModel.create({
        label: normalized,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
    });
    return res.status(201).json({ item: toCategoryResponse(cat) });
}

export async function updateCategory(req: Request, res: Response) {
    const { catId } = req.params;
    const { label, sortOrder } = req.body;

    const cat = await CategoryModel.findById(catId);
    if (!cat) {
        return res.status(404).json({ message: 'Category not found' });
    }

    if (label !== undefined) {
        const normalized = (label as string).trim().replace(/\s+/g, ' ');
        if (!normalized) {
            return res.status(400).json({ message: 'Label cannot be empty' });
        }
        if (normalized.length > 80) {
            return res.status(400).json({ message: 'Label must be 80 characters or less' });
        }
        const duplicate = await CategoryModel.findOne({ label: normalized, _id: { $ne: catId } });
        if (duplicate) {
            return res.status(409).json({ message: 'A category with this label already exists' });
        }
        cat.label = normalized;
    }
    if (sortOrder !== undefined) {
        cat.sortOrder = Number(sortOrder);
    }

    await cat.save();
    return res.json({ item: toCategoryResponse(cat) });
}

export async function deleteCategory(req: Request, res: Response) {
    const { catId } = req.params;
    const cat = await CategoryModel.findByIdAndDelete(catId);
    if (!cat) {
        return res.status(404).json({ message: 'Category not found' });
    }
    return res.status(204).send();
}
