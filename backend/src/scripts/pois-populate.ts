import { POIModel } from '../models/poi.model';
import type { SeedEventsResult } from './events-populate';

export async function populatePois(seedEvents: SeedEventsResult) {
  await POIModel.findOneAndUpdate(
    { name: 'Info Point', eventId: seedEvents.springEvent._id },
    {
      $set: {
        eventId: seedEvents.springEvent._id,
        name: 'Info Point',
        description: 'Punto informazioni principale. Qui puoi ritirare la mappa dell\'evento e ricevere assistenza.',
        location: { type: 'Point', coordinates: [7.6860, 45.0700] },
        iconType: 'info',
        coverImage: null,
        gallery: [],
      },
    },
    { upsert: true, new: true },
  );

  await POIModel.findOneAndUpdate(
    { name: 'Ingresso Principale', eventId: seedEvents.springEvent._id },
    {
      $set: {
        eventId: seedEvents.springEvent._id,
        name: 'Ingresso Principale',
        description: 'Accesso principale all\'area evento da Piazza Castello.',
        location: { type: 'Point', coordinates: [7.6875, 45.0710] },
        iconType: 'entrance',
        coverImage: null,
        gallery: [],
      },
    },
    { upsert: true, new: true },
  );

  await POIModel.findOneAndUpdate(
    { name: 'Parcheggio', eventId: seedEvents.springEvent._id },
    {
      $set: {
        eventId: seedEvents.springEvent._id,
        name: 'Parcheggio',
        description: 'Parcheggio custodito per i visitatori. Posti limitati.',
        location: { type: 'Point', coordinates: [7.6830, 45.0720] },
        iconType: 'parking',
        coverImage: null,
        gallery: [],
      },
    },
    { upsert: true, new: true },
  );

  await POIModel.findOneAndUpdate(
    { name: 'Palco Musica dal Vivo', eventId: seedEvents.springEvent._id },
    {
      $set: {
        eventId: seedEvents.springEvent._id,
        name: 'Palco Musica dal Vivo',
        description: 'Musica dal vivo con artisti locali durante tutta la durata dell\'evento.',
        location: { type: 'Point', coordinates: [7.6890, 45.0695] },
        iconType: 'stage',
        coverImage: null,
        gallery: [],
      },
    },
    { upsert: true, new: true },
  );

  await POIModel.findOneAndUpdate(
    { name: 'Bagni', eventId: seedEvents.springEvent._id },
    {
      $set: {
        eventId: seedEvents.springEvent._id,
        name: 'Bagni',
        description: 'Servizi igienici a disposizione dei visitatori.',
        location: { type: 'Point', coordinates: [7.6840, 45.0690] },
        iconType: 'toilet',
        coverImage: null,
        gallery: [],
      },
    },
    { upsert: true, new: true },
  );
}
