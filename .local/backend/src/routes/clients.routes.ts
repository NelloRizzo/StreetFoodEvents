import { Router, type Request, type Response } from 'express';
import { Types } from 'mongoose';

import { EventUserModel, UserModel } from '../models';

export const clientsRouter = Router();

function isValidObjectId(value: string | undefined): value is string {
    return value !== undefined && Types.ObjectId.isValid(value);
}

export async function listEventClients(req: Request, res: Response) {
    const eventId = req.params.eventId;
    if (!isValidObjectId(eventId)) return res.status(400).json({ message: 'Invalid event id' });

    const eventUsers = await EventUserModel.find({ eventId: new Types.ObjectId(eventId), isActive: true }).lean();

    const userIds = eventUsers.filter((eu: any) => eu.userId).map((eu: any) => eu.userId);
    const users = await UserModel.find({ _id: { $in: userIds } }).select('firstName lastName email').lean();
    const userById = new Map<string, any>(users.map((u: any) => [u._id.toString(), u]));

    const items = eventUsers.map((eu: any) => {
        const user = eu.userId ? userById.get(eu.userId.toString()) : undefined;
        return {
            id: eu._id.toString(),
            userId: eu.userId?.toString() ?? null,
            displayName:
                eu.displayName ??
                (user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Cliente generico'),
            balance: eu.balance
        };
    });

    return res.status(200).json({ items });
}

clientsRouter.get('/event/:eventId', listEventClients);
