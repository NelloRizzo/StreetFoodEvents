import { Schema, model, type InferSchemaType } from 'mongoose';
import { imageSchema } from './schemas/image.schema';

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    avatar: {
      type: imageSchema,
      default: null
    },
    gender: {
      type: String,
      enum: ['m', 'f'],
      required: false,
      default: 'm'
    },
    birthday: {
      type: Date,
      required: false
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    passwordHash: {
      type: String,
      required: true,
      select: false
    },

    phone: {
      type: String,
      trim: true,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = model('User', userSchema);
