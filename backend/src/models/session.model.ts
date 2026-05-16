import { Schema, model, type InferSchemaType } from 'mongoose';

const sessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    lastActivityAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    userAgent: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500
    },
    ipAddress: {
      type: String,
      trim: true,
      default: null,
      maxlength: 120
    },
    isRevoked: {
      type: Boolean,
      required: true,
      default: false,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type Session = InferSchemaType<typeof sessionSchema>;

export const SessionModel = model('Session', sessionSchema);
