import { Schema, model, type InferSchemaType } from 'mongoose';

const stationSchema = new Schema(
    {
        standId: {
            type: Schema.Types.ObjectId,
            ref: 'Stand',
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

stationSchema.index({ standId: 1, name: 1 }, { unique: true });

export type Station = InferSchemaType<typeof stationSchema>;

export const StationModel = model('Station', stationSchema);
