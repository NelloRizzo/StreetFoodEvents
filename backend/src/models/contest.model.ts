import { Schema, model, type InferSchemaType } from 'mongoose';

const contestSchema = new Schema(
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
        description: {
            type: String,
            trim: true,
            default: null
        },
        startsAt: {
            type: Date,
            required: true
        },
        endsAt: {
            type: Date,
            required: true
        },
        durationMinutes: {
            type: Number,
            required: true,
            min: 1
        },
        requireSequence: {
            type: Boolean,
            default: false
        },
        prize: {
            type: String,
            trim: true,
            default: null
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        orderedPOIIds: {
            type: [Schema.Types.ObjectId],
            ref: 'ContestPOI',
            default: []
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

contestSchema.index({ eventId: 1, isActive: 1 });

export type Contest = InferSchemaType<typeof contestSchema>;
export const ContestModel = model('Contest', contestSchema);
