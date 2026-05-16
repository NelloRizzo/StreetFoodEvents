import { CounterModel } from '../models/counter.model';
import { EventProductModel } from '../models/event-product.model';
import { OrderModel } from '../models/order.model';
import type { SeedEventsResult } from './events-populate';
import type { SeedProductsResult } from './products-populate';
import type { SeedStandsResult } from './stands-populate';
import type { SeedStationsResult } from './stations-populate';
import type { SeedUsersResult } from './users-populate';

export async function populateOrders(
  seedUsers: SeedUsersResult,
  seedEvents: SeedEventsResult,
  seedStands: SeedStandsResult,
  seedProducts: SeedProductsResult,
  seedStations: SeedStationsResult,
) {
  const springEventId = seedEvents.springEvent._id.toString();
  const standId = seedStands.gourmetStand._id.toString();
  const customerId = seedUsers.customerUser._id.toString();

  const epBurger = await EventProductModel.findOne({
    eventId: springEventId,
    standId,
    productId: seedProducts.burger._id.toString(),
  });
  const epFries = await EventProductModel.findOne({
    eventId: springEventId,
    standId,
    productId: seedProducts.fries._id.toString(),
  });
  const epPulledPork = await EventProductModel.findOne({
    eventId: springEventId,
    standId,
    productId: seedProducts.pulledPork._id.toString(),
  });
  const epDrink = await EventProductModel.findOne({
    eventId: springEventId,
    standId,
    productId: seedProducts.drink._id.toString(),
  });

  if (!epBurger || !epFries || !epPulledPork || !epDrink) {
    throw new Error('Cannot find Gourmet Street EventProducts for Spring event');
  }

  // Order 1: preparing — 2 Smash Burger (Griglia) + 1 Patate Speziate (Cucina)
  await OrderModel.findOneAndUpdate(
    { standId, orderNumber: 1 },
    {
      $set: {
        eventId: springEventId,
        standId,
        orderNumber: 1,
        userId: customerId,
        customerId,
        customerName: 'Luca Rinaldi',
        status: 'preparing',
        items: [
          {
            eventProductId: epBurger._id.toString(),
            productId: seedProducts.burger._id.toString(),
            productName: 'Smash Burger',
            stationId: seedStations.gourmetGrill._id.toString(),
            stationName: 'Griglia',
            quantity: 2,
            unitPrice: 8.5,
            subtotal: 17.0,
            ready: false,
          },
          {
            eventProductId: epFries._id.toString(),
            productId: seedProducts.fries._id.toString(),
            productName: 'Patate Speziate',
            stationId: seedStations.gourmetKitchen._id.toString(),
            stationName: 'Cucina',
            quantity: 1,
            unitPrice: 4.0,
            subtotal: 4.0,
            ready: false,
          },
        ],
        total: 21.0,
        creditAmountUsed: 0,
        paymentStatus: 'unpaid',
        performedByUserId: customerId,
      },
    },
    { upsert: true, new: true },
  );

  // Order 2: ready — 1 Pulled Pork Sandwich (Cucina) + 2 Birra Artigianale (Bibite)
  await OrderModel.findOneAndUpdate(
    { standId, orderNumber: 2 },
    {
      $set: {
        eventId: springEventId,
        standId,
        orderNumber: 2,
        userId: customerId,
        customerId,
        customerName: 'Luca Rinaldi',
        status: 'ready',
        items: [
          {
            eventProductId: epPulledPork._id.toString(),
            productId: seedProducts.pulledPork._id.toString(),
            productName: 'Pulled Pork Sandwich',
            stationId: seedStations.gourmetKitchen._id.toString(),
            stationName: 'Cucina',
            quantity: 1,
            unitPrice: 9.0,
            subtotal: 9.0,
            ready: true,
          },
          {
            eventProductId: epDrink._id.toString(),
            productId: seedProducts.drink._id.toString(),
            productName: 'Birra Artigianale',
            stationId: seedStations.gourmetDrinks._id.toString(),
            stationName: 'Bibite',
            quantity: 2,
            unitPrice: 6.0,
            subtotal: 12.0,
            ready: true,
          },
        ],
        total: 21.0,
        creditAmountUsed: 0,
        paymentStatus: 'paid',
        paidAt: new Date('2026-06-12T11:30:00.000Z'),
        performedByUserId: customerId,
      },
    },
    { upsert: true, new: true },
  );

  // Update counter to match
  await CounterModel.findOneAndUpdate(
    { standId },
    { $set: { seq: 2 } },
    { upsert: true, new: true },
  );
}
