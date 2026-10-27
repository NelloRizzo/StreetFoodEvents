import { Schema, model, type InferSchemaType } from 'mongoose';

const photoContestSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: null
    },
    status: {
      type: String,
      enum: ['draft', 'open', 'closed'],
      default: 'draft',
      index: true
    },
    votingEnabled: {
      type: Boolean,
      default: false
    },
    startsAt: {
      type: Date,
      default: null
    },
    endsAt: {
      type: Date,
      default: null
    },
    resultsPublished: {
      type: Boolean,
      default: false
    },
    showVotesCount: {
      type: Boolean,
      default: true
    },
    requireDevicePhotoMatch: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    closedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

photoContestSchema.index({ eventId: 1, createdAt: -1 });

export type PhotoContest = InferSchemaType<typeof photoContestSchema>;

export const PhotoContestModel = model('PhotoContest', photoContestSchema);
