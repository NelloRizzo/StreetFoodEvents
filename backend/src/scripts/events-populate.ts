import { EventUserModel } from '../models/event-user.model';
import { EventModel } from '../models/event.model';
import { UserRoleModel } from '../models/user-role.model';
import type { SeedRolesResult } from './roles-populate';
import type { SeedUsersResult } from './users-populate';

async function upsertEvent(input: {
  name: string;
  location: {
    label: string;
    addressLine1: string;
    city: string;
    province: string;
    region: string;
    country: string;
    postalCode: string;
    coordinates: {
      type: 'Point';
      coordinates: [number, number];
    };
    googleMapsUrl: string;
  };
  startDate: Date;
  endDate: Date;
  currencyName: string;
  themeBrand?: string | null;
  themeText?: string | null;
  themeSurface?: string | null;
  themeHighlight?: string | null;
}) {
  return EventModel.findOneAndUpdate(
    { name: input.name, startDate: input.startDate },
    {
      $set: {
        ...input,
        coverImage: null,
        logo: null,
        gallery: [],
        themeBrand: input.themeBrand ?? null,
        themeText: input.themeText ?? null,
        themeSurface: input.themeSurface ?? null,
        themeHighlight: input.themeHighlight ?? null,
      },
    },
    {
      new: true,
      upsert: true,
    },
  );
}

export async function populateEvents(
  seedUsers: SeedUsersResult,
  seedRoles: SeedRolesResult,
) {
  const springEvent = await upsertEvent({
    name: 'Spring Street Food Parade',
    location: {
      label: 'Piazza Castello, Torino',
      addressLine1: 'Piazza Castello',
      city: 'Torino',
      province: 'TO',
      region: 'Piemonte',
      country: 'Italia',
      postalCode: '10122',
      coordinates: {
        type: 'Point',
        coordinates: [7.6869, 45.0705],
      },
      googleMapsUrl: 'https://maps.google.com/?q=45.0705,7.6869',
    },
    startDate: new Date('2026-06-12T10:00:00.000Z'),
    endDate: new Date('2026-06-14T23:00:00.000Z'),
    currencyName: 'Scrip',
    themeBrand: '#d4836a',
    themeText: '#1e2c21',
    themeSurface: '#f2efe4',
    themeHighlight: '#c8d96f',
  });

  const lakeEvent = await upsertEvent({
    name: 'Lake Bites Festival',
    location: {
      label: 'Lungolago, Lecco',
      addressLine1: 'Lungolago Isonzo',
      city: 'Lecco',
      province: 'LC',
      region: 'Lombardia',
      country: 'Italia',
      postalCode: '23900',
      coordinates: {
        type: 'Point',
        coordinates: [9.3977, 45.8566],
      },
      googleMapsUrl: 'https://maps.google.com/?q=45.8566,9.3977',
    },
    startDate: new Date('2026-07-03T11:00:00.000Z'),
    endDate: new Date('2026-07-05T23:30:00.000Z'),
    currencyName: 'Bite',
    themeBrand: '#3b82b0',
    themeText: '#141c24',
    themeSurface: '#e8eef0',
    themeHighlight: '#8cc4d8',
  });

  if (!springEvent || !lakeEvent) {
    throw new Error('Failed to seed events');
  }

  await UserRoleModel.findOneAndUpdate(
    {
      userId: seedUsers.adminUser._id,
      roleId: seedRoles.eventAdminRole._id,
      eventId: springEvent._id,
      standId: null,
    },
    {
      $set: {
        userId: seedUsers.adminUser._id,
        roleId: seedRoles.eventAdminRole._id,
        eventId: springEvent._id,
        standId: null,
        assignedBy: seedUsers.adminUser._id,
        isActive: true,
      },
    },
    { upsert: true, new: true },
  );

  const customerSpringWallet = await EventUserModel.findOneAndUpdate(
    {
      eventId: springEvent._id,
      userId: seedUsers.customerUser._id,
    },
    {
      $set: {
        eventId: springEvent._id,
        userId: seedUsers.customerUser._id,
        balance: 42,
        isActive: true,
        joinedAt: new Date('2026-06-12T09:30:00.000Z'),
        notes: 'Wallet demo per test frontend',
      },
    },
    { upsert: true, new: true },
  );

  const customerLakeWallet = await EventUserModel.findOneAndUpdate(
    {
      eventId: lakeEvent._id,
      userId: seedUsers.customerUser._id,
    },
    {
      $set: {
        eventId: lakeEvent._id,
        userId: seedUsers.customerUser._id,
        balance: 15,
        isActive: true,
        joinedAt: new Date('2026-07-03T10:00:00.000Z'),
        notes: 'Wallet demo per test frontend',
      },
    },
    { upsert: true, new: true },
  );

  if (!customerSpringWallet || !customerLakeWallet) {
    throw new Error('Failed to seed event users');
  }

  return {
    springEvent,
    lakeEvent,
    customerSpringWallet,
    customerLakeWallet,
  };
}

export type SeedEventsResult = Awaited<ReturnType<typeof populateEvents>>;
