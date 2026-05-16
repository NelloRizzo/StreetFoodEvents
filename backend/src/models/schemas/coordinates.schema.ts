import { Schema, type InferSchemaType } from 'mongoose';

export const coordinatesSchema = new Schema(
    {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true,
            validate: {
                validator(value: number[]) {
                    if (value.length !== 2) {
                        return false;
                    }

                    const [longitude, latitude] = value;

                    if (!longitude || !latitude) return false;

                    return longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
                },
                message: 'Coordinates must be [longitude, latitude]'
            }
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

export type Coordinates = InferSchemaType<typeof coordinatesSchema>;