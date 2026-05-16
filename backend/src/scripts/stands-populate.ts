import { StandModel } from '../models/stand.model';
import type { SeedEventsResult } from './events-populate';

async function upsertStand(input: {
  name: string;
  slogan: string;
  description: string;
  eventIds: string[];
}) {
  return StandModel.findOneAndUpdate(
    { name: input.name },
    { $set: { ...input, coverImage: null, gallery: [] } },
    { new: true, upsert: true },
  );
}

export async function populateStands(seedEvents: SeedEventsResult) {
  const gourmetStand = await upsertStand({
    name: 'Gourmet Street',
    slogan: 'Il meglio della cucina di strada',
    description: 'Specialità gourmet in versione street food. Dai nostri food truck serviamo piatti preparati al momento con ingredienti selezionati.',
    eventIds: [seedEvents.springEvent._id.toString(), seedEvents.lakeEvent._id.toString()],
  });

  const bbqStand = await upsertStand({
    name: 'BBQ Revolution',
    slogan: 'Affumicatura e griglia',
    description: 'Carni selezionate, affumicate a bassa temperatura e grigliate alla perfezione.',
    eventIds: [seedEvents.springEvent._id.toString()],
  });

  const sweetStand = await upsertStand({
    name: 'Sweet Corner',
    slogan: 'Dolce tentazione',
    description: 'Dessert artigianali, crêpes e gelati per concludere in bellezza.',
    eventIds: [seedEvents.springEvent._id.toString(), seedEvents.lakeEvent._id.toString()],
  });

  if (!gourmetStand || !bbqStand || !sweetStand) {
    throw new Error('Failed to seed stands');
  }

  return { gourmetStand, bbqStand, sweetStand };
}

export type SeedStandsResult = Awaited<ReturnType<typeof populateStands>>;
