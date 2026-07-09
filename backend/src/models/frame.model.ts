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
        textColor: {
            type: String,
            default: '#ffffff',
            validate: {
                validator: (v: string) => /^#[0-9a-fA-F]{6}$/.test(v),
                message: 'textColor must be a valid hex color (e.g. #ffffff)'
            }
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
