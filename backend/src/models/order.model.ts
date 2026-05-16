import { Schema, model, type InferSchemaType } from 'mongoose';

export const orderStatusValues = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'completed',
    'cancelled'
] as const;

export const paymentStatusValues = ['unpaid', 'paid', 'refunded'] as const;

const orderItemSchema = new Schema(
    {
        eventProductId: {
            type: Schema.Types.ObjectId,
            ref: 'EventProduct',
            required: true
        },
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        productName: {
            type: String,
            required: true,
            maxlength: 200
        },
        stationId: {
            type: Schema.Types.ObjectId,
            ref: 'Station',
            required: true
        },
        stationName: {
            type: String,
            required: true,
            maxlength: 200
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },
        subtotal: {
            type: Number,
            required: true,
            min: 0
        },
        ready: {
            type: Boolean,
            default: false
        },
        notes: {
            type: String,
            trim: true,
            default: null,
            maxlength: 500
        }
    },
    { _id: false }
);

const orderSchema = new Schema(
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
            required: true,
            index: true
        },
        orderNumber: {
            type: Number,
            required: true,
            default: 0
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        customerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true
        },
        customerName: {
            type: String,
            trim: true,
            default: null,
            maxlength: 200
        },
        status: {
            type: String,
            enum: orderStatusValues,
            required: true,
            default: 'pending',
            index: true
        },
        items: {
            type: [orderItemSchema],
            required: true,
            validate: {
                validator(value: typeof orderItemSchema[]) {
                    return value.length > 0;
                },
                message: 'At least one item is required'
            }
        },
        total: {
            type: Number,
            required: true,
            min: 0
        },
        creditAmountUsed: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },
        paymentStatus: {
            type: String,
            enum: paymentStatusValues,
            required: true,
            default: 'unpaid',
            index: true
        },
        paidAt: {
            type: Date,
            default: null
        },
        paymentTransactionId: {
            type: Schema.Types.ObjectId,
            ref: 'EventUserTransaction',
            default: null
        },
        performedByUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        notes: {
            type: String,
            trim: true,
            default: null,
            maxlength: 1000
        },
        cancelledAt: {
            type: Date,
            default: null
        },
        cancelReason: {
            type: String,
            trim: true,
            default: null,
            maxlength: 500
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

orderSchema.index({ eventId: 1, standId: 1, createdAt: -1 });
orderSchema.index({ standId: 1, status: 1 });
orderSchema.index({ userId: 1, createdAt: -1 });

export type Order = InferSchemaType<typeof orderSchema>;
export type OrderStatus = (typeof orderStatusValues)[number];
export type PaymentStatus = (typeof paymentStatusValues)[number];

export const OrderModel = model('Order', orderSchema);
