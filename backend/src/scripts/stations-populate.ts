import { StationModel } from '../models/station.model';
import type { SeedStandsResult } from './stands-populate';

async function upsertStation(input: {
  standId: string;
  name: string;
}) {
  return StationModel.findOneAndUpdate(
    { standId: input.standId, name: input.name },
    { $set: input },
    { new: true, upsert: true },
  );
}

export async function populateStations(seedStands: SeedStandsResult) {
  const gourmetGrill = await upsertStation({
    standId: seedStands.gourmetStand._id.toString(),
    name: 'Griglia',
  });
  const gourmetKitchen = await upsertStation({
    standId: seedStands.gourmetStand._id.toString(),
    name: 'Cucina',
  });
  const gourmetDrinks = await upsertStation({
    standId: seedStands.gourmetStand._id.toString(),
    name: 'Bibite',
  });

  const bbqGrill = await upsertStation({
    standId: seedStands.bbqStand._id.toString(),
    name: 'Griglia',
  });
  const bbqKitchen = await upsertStation({
    standId: seedStands.bbqStand._id.toString(),
    name: 'Cucina',
  });

  const sweetKitchen = await upsertStation({
    standId: seedStands.sweetStand._id.toString(),
    name: 'Cucina',
  });
  const sweetCounter = await upsertStation({
    standId: seedStands.sweetStand._id.toString(),
    name: 'Banco',
  });

  if (!gourmetGrill || !gourmetKitchen || !gourmetDrinks || !bbqGrill || !bbqKitchen || !sweetKitchen || !sweetCounter) {
    throw new Error('Failed to seed stations');
  }

  return {
    gourmetGrill,
    gourmetKitchen,
    gourmetDrinks,
    bbqGrill,
    bbqKitchen,
    sweetKitchen,
    sweetCounter,
  };
}

export type SeedStationsResult = Awaited<ReturnType<typeof populateStations>>;
