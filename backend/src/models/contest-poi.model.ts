import { Schema, model, type InferSchemaType } from 'mongoose';

const contestPOISchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        hint: {
            type: String,
            trim: true,
            default: null,
            maxlength: 300
        },
        groups: {
            type: [String],
            default: []
        },
        sequenceOrder: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

contestPOISchema.index({ eventId: 1 });
contestPOISchema.index({ eventId: 1, name: 1 }, { unique: true });

export type ContestPOI = InferSchemaType<typeof contestPOISchema>;
export const ContestPOIModel = model('ContestPOI', contestPOISchema);
