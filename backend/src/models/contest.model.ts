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
        prizes: {
            type: [{
                label: { type: String, trim: true, required: true },
                awarded: { type: Boolean, default: false }
            }],
            default: []
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
        },
        pickConfig: {
            type: {
                groupPicks: [{
                    group: { type: String, required: true },
                    count: { type: Number, required: true, min: 1 }
                }]
            },
            default: null
        },
        autoPickedPOIIds: {
            type: [Schema.Types.ObjectId],
            ref: 'ContestPOI',
            default: []
        },
        poiHintSelections: {
            type: [{
                poiId: { type: Schema.Types.ObjectId, ref: 'ContestPOI', required: true },
                hintIndex: { type: Number, required: true, min: 0 }
            }],
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
