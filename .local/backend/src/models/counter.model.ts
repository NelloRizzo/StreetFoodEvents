import { Schema, model, type InferSchemaType } from 'mongoose';

const counterSchema = new Schema(
    {
        standId: {
            type: Schema.Types.ObjectId,
            ref: 'Stand',
            required: true,
            unique: true,
            index: true
        },
        seq: {
            type: Number,
            required: true,
            default: 0
        }
    },
    {
        versionKey: false
    }
);

export type Counter = InferSchemaType<typeof counterSchema>;

export const CounterModel = model('Counter', counterSchema);
