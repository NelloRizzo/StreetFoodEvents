import { Schema, model, type InferSchemaType } from 'mongoose';

const blogCategorySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80
        },
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            unique: true,
            maxlength: 90
        },
        description: {
            type: String,
            trim: true,
            default: null,
            maxlength: 300
        },
        color: {
            type: String,
            trim: true,
            default: null,
            maxlength: 20
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

export type BlogCategory = InferSchemaType<typeof blogCategorySchema>;
export const BlogCategoryModel = model('BlogCategory', blogCategorySchema);
