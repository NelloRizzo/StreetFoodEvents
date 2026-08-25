import { Schema, model, type InferSchemaType } from 'mongoose';

const categorySchema = new Schema(
    {
        label: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
            unique: true
        },
        sortOrder: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

categorySchema.index({ label: 1 }, { unique: true });
categorySchema.index({ sortOrder: 1 });

export type Category = InferSchemaType<typeof categorySchema>;

export const CategoryModel = model('Category', categorySchema);
