import { Schema, type InferSchemaType } from 'mongoose';

export const documentSchema = new Schema(
    {
        url: {
            type: String,
            required: true,
            trim: true
        },
        publicId: {
            type: String,
            required: true,
            trim: true
        },
        format: {
            type: String,
            required: true,
            trim: true
        },
        bytes: {
            type: Number,
            required: true,
            min: 1
        },
        originalName: {
            type: String,
            required: true,
            trim: true
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

export type Document = InferSchemaType<typeof documentSchema>;