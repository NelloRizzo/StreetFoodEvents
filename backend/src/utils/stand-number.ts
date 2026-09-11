import { Types } from 'mongoose';

import { StandModel } from '../models/stand.model';

export async function nextStandNumber(eventId: string): Promise<number> {
    const eventIdObj = new Types.ObjectId(eventId);
    const result = await StandModel.aggregate([
        { $match: { 'numbers.eventId': eventIdObj } },
        { $unwind: '$numbers' },
        { $match: { 'numbers.eventId': eventIdObj } },
        { $group: { _id: null, max: { $max: '$numbers.number' } } }
    ]) as Array<{ max?: number }>;
    return (result[0]?.max ?? 0) + 1;
}
