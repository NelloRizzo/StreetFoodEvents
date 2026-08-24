import { Schema, model, type InferSchemaType } from 'mongoose';

export type SocialPlatform = 'facebook' | 'instagram';

export type SocialPostStatus = 'pending' | 'processing' | 'published' | 'failed';

const socialPostSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true
        },
        photoId: {
            type: Schema.Types.ObjectId,
            ref: 'EventPhoto',
            required: true
        },
        platform: {
            type: String,
            enum: ['facebook', 'instagram'],
            required: true
        },
        caption: {
            type: String,
            trim: true,
            default: '',
            maxlength: 2200
        },
        status: {
            type: String,
            enum: ['pending', 'processing', 'published', 'failed'],
            default: 'pending',
            index: true
        },
        attempts: {
            type: Number,
            default: 0,
            min: 0
        },
        nextAttemptAt: {
            type: Date,
            default: null
        },
        lastError: {
            type: String,
            default: null
        },
        remotePostId: {
            type: String,
            default: null
        },
        permalink: {
            type: String,
            default: null
        },
        publishedAt: {
            type: Date,
            default: null
        },
        requestedByUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    { timestamps: true }
);

socialPostSchema.index({ eventId: 1, createdAt: -1 });
socialPostSchema.index({ status: 1, nextAttemptAt: 1 });

export type SocialPost = InferSchemaType<typeof socialPostSchema>;

export const SocialPostModel = model('SocialPost', socialPostSchema);
