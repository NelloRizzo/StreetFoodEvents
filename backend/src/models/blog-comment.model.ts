import { Schema, model, type InferSchemaType } from 'mongoose';

export const blogCommentStatusValues = ['visible', 'hidden'] as const;

const blogCommentSchema = new Schema(
    {
        postId: {
            type: Schema.Types.ObjectId,
            ref: 'BlogPost',
            required: true,
            index: true
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        /* Denormalizzato: se l'utente viene cancellato o cambia nome il
           commento resta leggibile senza join. */
        authorName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },
        body: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },
        status: {
            type: String,
            enum: blogCommentStatusValues,
            default: 'visible',
            index: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

blogCommentSchema.index({ postId: 1, createdAt: -1 });

// Un commento per utente per notizia (evita spam e doppioni accidentali).
blogCommentSchema.index(
    { postId: 1, userId: 1 },
    { unique: true }
);

export type BlogComment = InferSchemaType<typeof blogCommentSchema>;
export type BlogCommentStatus = (typeof blogCommentStatusValues)[number];

export const BlogCommentModel = model('BlogComment', blogCommentSchema);
