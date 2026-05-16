import { Schema, type InferSchemaType } from 'mongoose';

import { coordinatesSchema } from './coordinates.schema';

export const locationSchema = new Schema(
    {
        label: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        addressLine1: {
            type: String,
            trim: true,
            default: null,
            maxlength: 160
        },
        addressLine2: {
            type: String,
            trim: true,
            default: null,
            maxlength: 160
        },
        city: {
            type: String,
            trim: true,
            default: null,
            maxlength: 120
        },
        province: {
            type: String,
            trim: true,
            default: null,
            maxlength: 120
        },
        region: {
            type: String,
            trim: true,
            default: null,
            maxlength: 120
        },
        country: {
            type: String,
            trim: true,
            default: null,
            maxlength: 120
        },
        postalCode: {
            type: String,
            trim: true,
            default: null,
            maxlength: 20
        },
        coordinates: {
            type: coordinatesSchema,
            required: false
        },
        googleMapsUrl: {
            type: String,
            trim: true,
            default: null
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

export type Location = InferSchemaType<typeof locationSchema>;