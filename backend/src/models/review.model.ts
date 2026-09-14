import { Schema, model, type InferSchemaType } from 'mongoose';

export const reviewStatusValues = ['visible', 'hidden'] as const;

const reviewSchema = new Schema(
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
            default: null,
            index: true
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        comment: {
            type: String,
            trim: true,
            default: null,
            maxlength: 1000
        },
        reviewerName: {
            type: String,
            trim: true,
            default: null,
            maxlength: 200
        },
        reviewerEmail: {
            type: String,
            trim: true,
            lowercase: true,
            default: null,
            maxlength: 300
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true
        },
        guestTokenHash: {
            type: String,
            default: null
        },
        status: {
            type: String,
            enum: reviewStatusValues,
            default: 'visible',
            index: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

reviewSchema.index({ eventId: 1, standId: 1, createdAt: -1 });

reviewSchema.index(
    { eventId: 1, standId: 1, userId: 1 },
    { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } }
);

reviewSchema.index(
    { eventId: 1, standId: 1, guestTokenHash: 1 },
    { unique: true, partialFilterExpression: { guestTokenHash: { $type: 'string' } } }
);

export type Review = InferSchemaType<typeof reviewSchema>;
export type ReviewStatus = (typeof reviewStatusValues)[number];

export const ReviewModel = model('Review', reviewSchema);