import { StandModel } from '../models/stand.model';
import type { SeedEventsResult } from './events-populate';

async function upsertStand(input: {
  name: string;
  slogan: string;
  description: string;
  eventIds: string[];
  locations?: Array<{ eventId: string; location: { type: 'Point'; coordinates: [number, number] } | null }>;
}) {
  return StandModel.findOneAndUpdate(
    { name: input.name },
    { $set: { ...input, coverImage: null, gallery: [] } },
    { new: true, upsert: true },
  );
}

export async function populateStands(seedEvents: SeedEventsResult) {
  const springEventId = seedEvents.springEvent._id.toString();
  const lakeEventId = seedEvents.lakeEvent._id.toString();

  const gourmetStand = await upsertStand({
    name: 'Gourmet Street',
    slogan: 'Il meglio della cucina di strada',
    description: 'Specialità gourmet in versione street food. Dai nostri food truck serviamo piatti preparati al momento con ingredienti selezionati.',
    eventIds: [springEventId, lakeEventId],
    locations: [
      { eventId: springEventId, location: { type: 'Point', coordinates: [7.6845, 45.0700] } },
      { eventId: lakeEventId, location: { type: 'Point', coordinates: [8.5100, 45.7800] } },
    ],
  });

  const bbqStand = await upsertStand({
    name: 'BBQ Revolution',
    slogan: 'Affumicatura e griglia',
    description: 'Carni selezionate, affumicate a bassa temperatura e grigliate alla perfezione.',
    eventIds: [springEventId],
    locations: [
      { eventId: springEventId, location: { type: 'Point', coordinates: [7.6905, 45.0725] } },
    ],
  });

  const sweetStand = await upsertStand({
    name: 'Sweet Corner',
    slogan: 'Dolce tentazione',
    description: 'Dessert artigianali, crêpes e gelati per concludere in bellezza.',
    eventIds: [springEventId, lakeEventId],
    locations: [
      { eventId: springEventId, location: { type: 'Point', coordinates: [7.6820, 45.0680] } },
      { eventId: lakeEventId, location: { type: 'Point', coordinates: [8.5070, 45.7750] } },
    ],
  });

  if (!gourmetStand || !bbqStand || !sweetStand) {
    throw new Error('Failed to seed stands');
  }

  return { gourmetStand, bbqStand, sweetStand };
}

export type SeedStandsResult = Awaited<ReturnType<typeof populateStands>>;
