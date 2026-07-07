import { Schema, model, type InferSchemaType } from 'mongoose';

import { imageSchema } from './schemas/image.schema';

const eventFrameSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        image: {
            type: imageSchema,
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

export type EventFrame = InferSchemaType<typeof eventFrameSchema>;

export const EventFrameModel = model('EventFrame', eventFrameSchema);
