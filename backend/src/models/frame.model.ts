import { Schema, model, type InferSchemaType } from 'mongoose';
import { imageSchema } from './schemas/image.schema';

const frameSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        image: {
            type: imageSchema,
            required: true
        },
        textPosition: {
            vertical: {
                type: String,
                enum: ['top', 'center', 'bottom'],
                default: 'bottom'
            },
            horizontal: {
                type: String,
                enum: ['left', 'center', 'right'],
                default: 'center'
            }
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

export type Frame = InferSchemaType<typeof frameSchema>;
export const FrameModel = model('Frame', frameSchema);
