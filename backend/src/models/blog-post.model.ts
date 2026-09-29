import { Schema, model, type InferSchemaType } from 'mongoose';
import { imageSchema } from './schemas/image.schema';

export const blogPostStatusValues = ['draft', 'published'] as const;

const blogPostSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            unique: true,
            maxlength: 220
        },
        excerpt: {
            type: String,
            trim: true,
            default: null,
            maxlength: 400
        },
        contentHtml: {
            type: String,
            required: true
        },
        coverImage: {
            type: imageSchema,
            default: null
        },
        categoryId: {
            type: Schema.Types.ObjectId,
            ref: 'BlogCategory',
            default: null,
            index: true
        },
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            default: null,
            index: true
        },
        authorUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true
        },
        isPinned: {
            type: Boolean,
            default: false,
            index: true
        },
        pinnedAt: {
            type: Date,
            default: null
        },
        status: {
            type: String,
            enum: blogPostStatusValues,
            default: 'draft',
            index: true
        },
        publishedAt: {
            type: Date,
            default: null,
            index: true
        },
        viewCount: {
            type: Number,
            min: 0,
            default: 0
        },
        commentCount: {
            type: Number,
            min: 0,
            default: 0
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Ordinamento del blog pubblico: i pinnati in testa, poi dalla piu' recente.
// Serve anche al filtro "published + isPinned" dell'aside della home.
blogPostSchema.index({ status: 1, isPinned: -1, publishedAt: -1 });

export type BlogPost = InferSchemaType<typeof blogPostSchema>;
export type BlogPostStatus = (typeof blogPostStatusValues)[number];

export const BlogPostModel = model('BlogPost', blogPostSchema);
