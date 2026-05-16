import { Schema, type InferSchemaType } from 'mongoose';

export const imageSchema = new Schema(
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
        width: {
            type: Number,
            required: true,
            min: 1
        },
        height: {
            type: Number,
            required: true,
            min: 1
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
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

export type Image = InferSchemaType<typeof imageSchema>;