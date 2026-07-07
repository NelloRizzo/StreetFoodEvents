import { Schema, model, type InferSchemaType } from 'mongoose';

const aliasSchema = new Schema(
    {
        text: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 100,
            validate: {
                validator(value: string) {
                    return /^[a-z0-9_-]+$/.test(value);
                },
                message: 'Alias can only contain letters, numbers, underscores and hyphens'
            }
        },
        entityType: {
            type: String,
            enum: ['event', 'stand'],
            required: true
        },
        entityRef: {
            type: Schema.Types.ObjectId,
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

aliasSchema.index({ entityType: 1, entityRef: 1 });

export type Alias = InferSchemaType<typeof aliasSchema>;

export const AliasModel = model('Alias', aliasSchema);
