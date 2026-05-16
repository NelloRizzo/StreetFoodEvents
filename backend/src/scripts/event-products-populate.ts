import { EventProductModel } from '../models/event-product.model';
import type { SeedEventsResult } from './events-populate';
import type { SeedProductsResult } from './products-populate';
import type { SeedStandsResult } from './stands-populate';
import type { SeedStationsResult } from './stations-populate';

export async function populateEventProducts(
  seedEvents: SeedEventsResult,
  seedStands: SeedStandsResult,
  seedProducts: SeedProductsResult,
  seedStations: SeedStationsResult,
) {
  const springEvents: Array<{
    standId: string;
    productId: string;
    stationIds: string[];
    priceOverride?: number;
  }> = [
    // Gourmet Street @ Spring
    { standId: seedStands.gourmetStand._id.toString(), productId: seedProducts.burger._id.toString(), stationIds: [seedStations.gourmetGrill._id.toString()] },
    { standId: seedStands.gourmetStand._id.toString(), productId: seedProducts.pulledPork._id.toString(), stationIds: [seedStations.gourmetGrill._id.toString(), seedStations.gourmetKitchen._id.toString()] },
    { standId: seedStands.gourmetStand._id.toString(), productId: seedProducts.fries._id.toString(), stationIds: [seedStations.gourmetKitchen._id.toString()] },
    { standId: seedStands.gourmetStand._id.toString(), productId: seedProducts.drink._id.toString(), stationIds: [seedStations.gourmetDrinks._id.toString()], priceOverride: 6.0 },
    // BBQ Revolution @ Spring
    { standId: seedStands.bbqStand._id.toString(), productId: seedProducts.ribs._id.toString(), stationIds: [seedStations.bbqGrill._id.toString()] },
    { standId: seedStands.bbqStand._id.toString(), productId: seedProducts.sausage._id.toString(), stationIds: [seedStations.bbqGrill._id.toString()] },
    { standId: seedStands.bbqStand._id.toString(), productId: seedProducts.fries._id.toString(), stationIds: [seedStations.bbqKitchen._id.toString()] },
    { standId: seedStands.bbqStand._id.toString(), productId: seedProducts.drink._id.toString(), stationIds: [seedStations.bbqGrill._id.toString(), seedStations.bbqKitchen._id.toString()] },
    // Sweet Corner @ Spring
    { standId: seedStands.sweetStand._id.toString(), productId: seedProducts.crepe._id.toString(), stationIds: [seedStations.sweetKitchen._id.toString()] },
    { standId: seedStands.sweetStand._id.toString(), productId: seedProducts.gelato._id.toString(), stationIds: [seedStations.sweetCounter._id.toString()] },
  ];

  const lakeEvents: Array<{
    standId: string;
    productId: string;
    stationIds: string[];
    priceOverride?: number;
  }> = [
    // Gourmet Street @ Lake
    { standId: seedStands.gourmetStand._id.toString(), productId: seedProducts.burger._id.toString(), stationIds: [seedStations.gourmetGrill._id.toString()], priceOverride: 9.0 },
    { standId: seedStands.gourmetStand._id.toString(), productId: seedProducts.fries._id.toString(), stationIds: [seedStations.gourmetKitchen._id.toString()] },
    { standId: seedStands.gourmetStand._id.toString(), productId: seedProducts.drink._id.toString(), stationIds: [seedStations.gourmetDrinks._id.toString()] },
    { standId: seedStands.gourmetStand._id.toString(), productId: seedProducts.water._id.toString(), stationIds: [seedStations.gourmetDrinks._id.toString()] },
    // Sweet Corner @ Lake
    { standId: seedStands.sweetStand._id.toString(), productId: seedProducts.gelato._id.toString(), stationIds: [seedStations.sweetCounter._id.toString()] },
    { standId: seedStands.sweetStand._id.toString(), productId: seedProducts.drink._id.toString(), stationIds: [seedStations.sweetCounter._id.toString()] },
  ];

  const allLinks = [
    ...springEvents.map((ep) => ({ ...ep, eventId: seedEvents.springEvent._id.toString() })),
    ...lakeEvents.map((ep) => ({ ...ep, eventId: seedEvents.lakeEvent._id.toString() })),
  ];

  const results = [];

  for (const link of allLinks) {
    const doc = await EventProductModel.findOneAndUpdate(
      {
        eventId: link.eventId,
        standId: link.standId,
        productId: link.productId,
      },
      {
        $set: {
          eventId: link.eventId,
          standId: link.standId,
          productId: link.productId,
          stationIds: link.stationIds,
          priceOverride: link.priceOverride ?? null,
        },
      },
      { new: true, upsert: true },
    );

    if (!doc) {
      throw new Error(`Failed to link product ${link.productId} to event ${link.eventId} stand ${link.standId}`);
    }

    results.push(doc);
  }

  return { eventProducts: results };
}
