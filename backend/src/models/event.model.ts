import { Schema, model, type InferSchemaType } from 'mongoose';

import { imageSchema } from './schemas/image.schema';
import { locationSchema } from './schemas/location.schema';

const eventSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        location: {
            type: locationSchema,
            required: true
        },
        startDate: {
            type: Date,
            required: true,
            index: true
        },
        endDate: {
            type: Date,
            required: true,
            index: true,
            validate: {
                validator(this: { startDate?: Date }, value: Date) {
                    if (!this.startDate) {
                        return true;
                    }

                    return value >= this.startDate;
                },
                message: 'endDate must be greater than or equal to startDate'
            }
        },
        currencyName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80
        },
        currencySymbol: {
            type: imageSchema,
            default: null
        },
        exchangeRate: {
            type: Number,
            default: 1,
            min: 0.01
        },
        themeBrand: {
            type: String,
            trim: true,
            default: null,
            maxlength: 7
        },
        themeText: {
            type: String,
            trim: true,
            default: null,
            maxlength: 7
        },
        themeSurface: {
            type: String,
            trim: true,
            default: null,
            maxlength: 7
        },
        themeHighlight: {
            type: String,
            trim: true,
            default: null,
            maxlength: 7
        },
        url: {
            type: String,
            trim: true,
            default: null,
            maxlength: 2048
        },
        shortDescription: {
            type: String,
            trim: true,
            default: null,
            maxlength: 500
        },
        longDescription: {
            type: String,
            trim: true,
            default: null
        },
        coverImage: {
            type: imageSchema,
            default: null
        },
        logo: {
            type: imageSchema,
            default: null
        },
        gallery: {
            type: [imageSchema],
            default: []
        },
        cashPaymentsEnabled: {
            type: Boolean,
            default: true
        },
        unifiedCashierEnabled: {
            type: Boolean,
            default: false
        },
        cashRegisterResetAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

eventSchema.index({ 'location.coordinates': '2dsphere' });
eventSchema.index({ name: 1, startDate: 1 });

export type Event = InferSchemaType<typeof eventSchema>;

export const EventModel = model('Event', eventSchema);