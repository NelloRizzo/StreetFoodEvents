import { Schema, model, type InferSchemaType } from 'mongoose';

const roleSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80
        },

        description: {
            type: String,
            trim: true,
            default: null,
            maxlength: 500
        },

        scope: {
            type: String,
            enum: ['platform', 'event', 'stand'],
            required: true,
            index: true
        },

        permissions: {
            type: [String],
            required: true,
            default: []
        },

        isSystem: {
            type: Boolean,
            default: false
        },

        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

roleSchema.index({ slug: 1, scope: 1 }, { unique: true });

export type Role = InferSchemaType<typeof roleSchema>;

export const RoleModel = model('Role', roleSchema);
