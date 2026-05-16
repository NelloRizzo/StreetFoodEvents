import { FavoriteModel } from '../models/favorite.model';
import type { SeedEventsResult } from './events-populate';
import type { SeedUsersResult } from './users-populate';

export async function populateFavorites(
  seedUsers: SeedUsersResult,
  seedEvents: SeedEventsResult,
) {
  await FavoriteModel.findOneAndUpdate(
    {
      userId: seedUsers.customerUser._id,
      eventId: seedEvents.springEvent._id,
    },
    {
      $set: {
        userId: seedUsers.customerUser._id,
        eventId: seedEvents.springEvent._id,
        standId: null,
      },
    },
    { upsert: true, new: true },
  );

  await FavoriteModel.findOneAndUpdate(
    {
      userId: seedUsers.customerUser._id,
      eventId: seedEvents.lakeEvent._id,
    },
    {
      $set: {
        userId: seedUsers.customerUser._id,
        eventId: seedEvents.lakeEvent._id,
        standId: null,
      },
    },
    { upsert: true, new: true },
  );
}

export type SeedFavoritesResult = Awaited<ReturnType<typeof populateFavorites>>;
