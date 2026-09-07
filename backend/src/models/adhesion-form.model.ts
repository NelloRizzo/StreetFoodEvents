import { Schema, model, type InferSchemaType } from 'mongoose';

const adhesionFormSectionSchema = new Schema(
    {
        slug: {
            type: String,
            required: true,
            trim: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        content: {
            type: String,
            required: true,
            default: ''
        },
        generatedFrom: {
            type: String,
            default: null
        }
    },
    { _id: false }
);

const adhesionFormSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            unique: true,
            index: true
        },
        sections: {
            type: [adhesionFormSectionSchema],
            default: []
        },
        eventFingerprint: {
            type: String,
            default: null
        },
        generatedAt: {
            type: Date,
            default: null
        },
        stale: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

export type AdhesionForm = InferSchemaType<typeof adhesionFormSchema>;

export type AdhesionFormSection = InferSchemaType<typeof adhesionFormSectionSchema>;

export const AdhesionFormModel = model('AdhesionForm', adhesionFormSchema);