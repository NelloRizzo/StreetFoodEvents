import { Schema, model, type InferSchemaType } from 'mongoose';

const photoContestEntrySchema = new Schema(
  {
    contestId: {
      type: Schema.Types.ObjectId,
      ref: 'PhotoContest',
      required: true,
      index: true
    },
    photoId: {
      type: Schema.Types.ObjectId,
      ref: 'EventPhoto',
      required: true,
      index: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    order: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

photoContestEntrySchema.index({ contestId: 1, photoId: 1 }, { unique: true });

export type PhotoContestEntry = InferSchemaType<typeof photoContestEntrySchema>;

export const PhotoContestEntryModel = model('PhotoContestEntry', photoContestEntrySchema);
