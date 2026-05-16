import { Schema, model, type InferSchemaType } from 'mongoose';

const userRoleSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },

        roleId: {
            type: Schema.Types.ObjectId,
            ref: 'Role',
            required: true,
            index: true
        },

        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            default: null,
            index: true
        },

        standId: {
            type: Schema.Types.ObjectId,
            ref: 'Stand',
            default: null,
            index: true
        },

        assignedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        startsAt: {
            type: Date,
            default: null
        },

        endsAt: {
            type: Date,
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

userRoleSchema.index(
    {
        userId: 1,
        roleId: 1,
        eventId: 1,
        standId: 1
    },
    {
        unique: true
    }
);

export type UserRole = InferSchemaType<typeof userRoleSchema>;

export const UserRoleModel = model('UserRole', userRoleSchema);
