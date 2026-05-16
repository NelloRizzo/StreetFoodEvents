import { Schema, model, type InferSchemaType } from 'mongoose';

const userStationSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        stationId: {
            type: Schema.Types.ObjectId,
            ref: 'Station',
            required: true,
            index: true
        },
        assignedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

userStationSchema.index({ userId: 1, stationId: 1 }, { unique: true });

export type UserStation = InferSchemaType<typeof userStationSchema>;

export const UserStationModel = model('UserStation', userStationSchema);
