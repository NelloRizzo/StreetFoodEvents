import { Schema, model, type InferSchemaType } from 'mongoose';

const favoriteSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            default: null,
            index: true
        },
        standId: {
            type: Schema.Types.ObjectId,
            ref: 'Stand',
            default: null,
            index: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

favoriteSchema.index({ userId: 1, eventId: 1 }, { unique: true, partialFilterExpression: { eventId: { $ne: null } } });
favoriteSchema.index({ userId: 1, standId: 1 }, { unique: true, partialFilterExpression: { standId: { $ne: null } } });

export type Favorite = InferSchemaType<typeof favoriteSchema>;

export const FavoriteModel = model('Favorite', favoriteSchema);
