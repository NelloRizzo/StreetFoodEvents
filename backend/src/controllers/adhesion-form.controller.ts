import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import {
    deleteAdhesionForm,
    generateAdhesionForm,
    getAdhesionForm,
    updateAdhesionForm
} from '../services/adhesion-form.service';

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

function toErrorResponse(error: unknown): { status: number; message: string } {
    if (error instanceof Error) {
        if (error.message === 'Event not found' || error.message === 'Adhesion form not found') {
            return { status: 404, message: error.message };
        }
        if (error.message === 'Invalid section slug') {
            return { status: 400, message: error.message };
        }
    }

    console.error(error);

    return { status: 500, message: 'Internal server error' };
}

export async function getForm(req: Request, res: Response) {
    const eventId = req.params.eventId;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const item = await getAdhesionForm(eventId);

    if (!item) {
        return res.status(404).json({ message: 'Adhesion form not found' });
    }

    return res.status(200).json({ item });
}

export async function generate(req: Request, res: Response) {
    const eventId = req.params.eventId;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    try {
        const existing = await getAdhesionForm(eventId);
        const item = await generateAdhesionForm(eventId);

        return res.status(existing ? 200 : 201).json({ item });
    } catch (error) {
        const { status, message } = toErrorResponse(error);
        return res.status(status).json({ message });
    }
}

export async function update(req: Request, res: Response) {
    const eventId = req.params.eventId;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const { sections } = req.body;

    if (!Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json({ message: 'sections must be a non-empty array' });
    }

    try {
        const item = await updateAdhesionForm(eventId, sections);
        return res.status(200).json({ item });
    } catch (error) {
        const { status, message } = toErrorResponse(error);
        return res.status(status).json({ message });
    }
}

export async function remove(req: Request, res: Response) {
    const eventId = req.params.eventId;

    if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const deleted = await deleteAdhesionForm(eventId);

    if (!deleted) {
        return res.status(404).json({ message: 'Adhesion form not found' });
    }

    return res.status(204).send();
}