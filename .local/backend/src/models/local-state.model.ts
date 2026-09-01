import { Schema, model, type InferSchemaType } from 'mongoose';

const localStateSchema = new Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            default: 'current'
        },
        eventId: {
            type: Schema.Types.ObjectId,
            default: null
        },
        standId: {
            type: Schema.Types.ObjectId,
            default: null
        },
        remoteEventId: {
            type: Schema.Types.ObjectId,
            default: null
        },
        remoteStandId: {
            type: Schema.Types.ObjectId,
            default: null
        },
        eventName: {
            type: String,
            default: null
        },
        currencyName: {
            type: String,
            default: null
        },
        importedAt: {
            type: Date,
            default: null
        }
    },
    { versionKey: false }
);

export type LocalState = InferSchemaType<typeof localStateSchema>;

export const LocalStateModel = model('LocalState', localStateSchema);
