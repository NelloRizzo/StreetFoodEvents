import { Schema, Types, model, type InferSchemaType } from 'mongoose';

export const promotionTypeValues = ['discount', 'product', 'value'] as const;
export const promotionDiscountTypeValues = ['percent', 'fixed'] as const;

const formulaSchema = new Schema(
    {
        paid: {
            type: Number,
            required: true,
            min: 1
        },
        total: {
            type: Number,
            required: true,
            min: 2,
            validate: {
                validator(value: number) {
                    return value > 1;
                },
                message: 'Formula total must be greater than 1'
            }
        }
    },
    { _id: false }
);

const promotionSchema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        standId: {
            type: Schema.Types.ObjectId,
            ref: 'Stand',
            default: null,
            index: true
        },
        code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            maxlength: 40
        },
        title: {
            type: String,
            trim: true,
            default: null,
            maxlength: 160
        },
        type: {
            type: String,
            enum: promotionTypeValues,
            required: true,
            index: true
        },
        discountType: {
            type: String,
            enum: promotionDiscountTypeValues,
            default: null
        },
        discountValue: {
            type: Number,
            default: null,
            min: 0
        },
        eventProductId: {
            type: Schema.Types.ObjectId,
            ref: 'EventProduct',
            default: null,
            index: true
        },
        formula: {
            type: formulaSchema,
            default: null
        },
        formulaMaxFree: {
            type: Number,
            default: null,
            min: 1
        },
        valueAmount: {
            type: Number,
            default: null,
            min: 0.01
        },
        maxPresentations: {
            type: Number,
            default: null,
            min: 1
        },
        perUserLimit: {
            type: Number,
            default: null,
            min: 1
        },
        usedCount: {
            type: Number,
            default: 0,
            min: 0
        },
        expiresAt: {
            type: Date,
            default: null
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

promotionSchema.index({ eventId: 1, code: 1 }, { unique: true });

const promotionUsageSchema = new Schema(
    {
        promotionId: {
            type: Schema.Types.ObjectId,
            ref: 'Promotion',
            required: true,
            index: true
        },
        code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            maxlength: 40
        },
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
            default: null,
            index: true
        },
        eventUserId: {
            type: Schema.Types.ObjectId,
            ref: 'EventUser',
            default: null,
            index: true
        },
        type: {
            type: String,
            enum: promotionTypeValues,
            required: true
        },
        discountAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        freeUnits: {
            type: Number,
            default: 0,
            min: 0
        },
        valueAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        appliedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

promotionUsageSchema.index({ eventId: 1, promotionId: 1, createdAt: -1 });

export type Promotion = InferSchemaType<typeof promotionSchema> & { _id: Types.ObjectId };
export type PromotionType = (typeof promotionTypeValues)[number];
export type PromotionDiscountType = (typeof promotionDiscountTypeValues)[number];

export type PromotionUsage = InferSchemaType<typeof promotionUsageSchema> & { _id: Types.ObjectId };

export const PromotionModel = model('Promotion', promotionSchema);
export const PromotionUsageModel = model('PromotionUsage', promotionUsageSchema);