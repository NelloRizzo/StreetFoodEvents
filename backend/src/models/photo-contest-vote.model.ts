import { Schema, model, type InferSchemaType } from 'mongoose';

const photoContestVoteSchema = new Schema(
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
    deviceIdHash: {
      type: String,
      required: true,
      trim: true
    },
    votedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

photoContestVoteSchema.index({ contestId: 1, deviceIdHash: 1 }, { unique: true });
photoContestVoteSchema.index({ contestId: 1, photoId: 1 });

export type PhotoContestVote = InferSchemaType<typeof photoContestVoteSchema>;

export const PhotoContestVoteModel = model('PhotoContestVote', photoContestVoteSchema);
