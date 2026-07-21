import { Schema, model, type InferSchemaType } from 'mongoose';

const contestParticipationSchema = new Schema(
    {
        contestId: {
            type: Schema.Types.ObjectId,
            ref: 'Contest',
            required: true,
            index: true
        },
        participantId: {
            type: String,
            required: true
        },
        scannedPOIIds: {
            type: [Schema.Types.ObjectId],
            default: []
        },
        startedAt: {
            type: Date,
            default: Date.now
        },
        completedAt: {
            type: Date,
            default: null
        },
        isWinner: {
            type: Boolean,
            default: null
        },
        deviceName: {
            type: String,
            trim: true,
            default: null,
            maxlength: 100
        },
        prizeAwarded: {
            type: Boolean,
            default: false
        },
        awardedPrizeLabel: {
            type: String,
            trim: true,
            default: null
        },
        claimCode: {
            type: String,
            trim: true,
            default: null,
            maxlength: 10
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

contestParticipationSchema.index({ contestId: 1, participantId: 1 }, { unique: true });

export type ContestParticipation = InferSchemaType<typeof contestParticipationSchema>;
export const ContestParticipationModel = model('ContestParticipation', contestParticipationSchema);
