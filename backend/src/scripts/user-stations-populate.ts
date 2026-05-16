import { UserStationModel } from '../models/user-station.model';
import type { SeedStationsResult } from './stations-populate';
import type { SeedUsersResult } from './users-populate';

export async function populateUserStations(
  seedUsers: SeedUsersResult,
  seedStations: SeedStationsResult,
) {
  // Assign kitchen user to Gourmet Kitchen station
  await UserStationModel.findOneAndUpdate(
    {
      userId: seedUsers.kitchenUser._id.toString(),
      stationId: seedStations.gourmetKitchen._id.toString(),
    },
    {
      $set: {
        userId: seedUsers.kitchenUser._id.toString(),
        stationId: seedStations.gourmetKitchen._id.toString(),
        assignedBy: seedUsers.adminUser._id.toString(),
        isActive: true,
      },
    },
    { new: true, upsert: true },
  );

  // Assign cashier user to Gourmet Drinks station
  await UserStationModel.findOneAndUpdate(
    {
      userId: seedUsers.cashierUser._id.toString(),
      stationId: seedStations.gourmetDrinks._id.toString(),
    },
    {
      $set: {
        userId: seedUsers.cashierUser._id.toString(),
        stationId: seedStations.gourmetDrinks._id.toString(),
        assignedBy: seedUsers.adminUser._id.toString(),
        isActive: true,
      },
    },
    { new: true, upsert: true },
  );
}
