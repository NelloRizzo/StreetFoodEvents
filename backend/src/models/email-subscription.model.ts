import { Schema, model, type InferSchemaType } from 'mongoose';

const emailSubscriptionSchema = new Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            default: null
        },
        displayName: {
            type: String,
            default: null
        },
        source: {
            type: String,
            enum: ['photo-email', 'manual', 'event-registration'],
            default: 'photo-email'
        },
        marketingConsent: {
            type: Boolean,
            default: false
        },
        consentTimestamp: {
            type: Date,
            default: Date.now
        },
        consentIp: {
            type: String,
            default: null
        },
        isActive: {
            type: Boolean,
            default: true
        },
        unsubscribedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

emailSubscriptionSchema.index({ email: 1, eventId: 1 }, { unique: true, partialFilterExpression: { eventId: { $type: 'objectId' } } });

export type EmailSubscription = InferSchemaType<typeof emailSubscriptionSchema>;

export const EmailSubscriptionModel = model('EmailSubscription', emailSubscriptionSchema);
