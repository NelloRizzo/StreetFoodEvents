import { Schema, Types, model, type InferSchemaType } from 'mongoose';

const eventProductSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        standId: {
            type: Schema.Types.ObjectId,
            ref: 'Stand',
            required: true,
            index: true
        },
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true
        },
        stationIds: {
            type: [{ type: Schema.Types.ObjectId, ref: 'Station' }],
            required: true,
            validate: {
                validator(value: Types.ObjectId[]) {
                    return value.length > 0;
                },
                message: 'At least one station is required'
            }
        },
        priceOverride: {
            type: Number,
            default: null,
            min: 0
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

eventProductSchema.index({ eventId: 1, standId: 1, productId: 1 }, { unique: true });
eventProductSchema.index({ eventId: 1, stationIds: 1 });

export type EventProduct = InferSchemaType<typeof eventProductSchema>;

export const EventProductModel = model('EventProduct', eventProductSchema);
