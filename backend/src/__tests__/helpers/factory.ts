import { Types } from 'mongoose';

import type { AuthUser } from '../../types/auth-user';

export function createTestUser(overrides: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    phone: string | null;
    isActive: boolean;
}> = {}) {
    return {
        firstName: 'Test',
        lastName: 'User',
        email: `test-${Date.now()}@example.com`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hash',
        phone: null,
        isActive: true,
        ...overrides
    };
}

export function createTestEvent(overrides: Partial<{
    name: string;
    location: {
        label: string;
        addressLine1: string | null;
        city: string | null;
        province: string | null;
        region: string | null;
        country: string | null;
        postalCode: string | null;
        coordinates: { type: string; coordinates: number[] };
        googleMapsUrl: string | null;
    };
    startDate: Date;
    endDate: Date;
    currencyName: string;
    themeBrand: string | null;
    themeText: string | null;
    themeSurface: string | null;
    themeHighlight: string | null;
    url: string | null;
    shortDescription: string | null;
    longDescription: string | null;
}> = {}) {
    const startDate = new Date('2026-06-01');
    const endDate = new Date('2026-06-07');
    return {
        name: `Event ${Date.now()}`,
        location: {
            label: 'Test Location',
            addressLine1: null,
            city: null,
            province: null,
            region: null,
            country: null,
            postalCode: null,
            coordinates: { type: 'Point', coordinates: [12.5, 41.9] },
            googleMapsUrl: null
        },
        startDate,
        endDate,
        currencyName: 'TestCoin',
        themeBrand: null,
        themeText: null,
        themeSurface: null,
        themeHighlight: null,
        url: null,
        shortDescription: null,
        longDescription: null,
        ...overrides
    };
}

export function createTestStand(overrides: Partial<{
    name: string;
    slogan: string | null;
    description: string | null;
    eventIds: Types.ObjectId[];
}> = {}) {
    return {
        name: `Stand ${Date.now()}`,
        slogan: null,
        description: null,
        eventIds: [],
        ...overrides
    };
}

export function createTestStation(overrides: Partial<{
    standId: Types.ObjectId;
    name: string;
}> = {}) {
    return {
        standId: new Types.ObjectId(),
        name: `Station ${Date.now()}`,
        ...overrides
    };
}

export function createTestProduct(overrides: Partial<{
    name: string;
    ingredients: string[];
    price: number;
}> = {}) {
    return {
        name: `Product ${Date.now()}`,
        ingredients: [],
        price: 10,
        ...overrides
    };
}

export function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
    return {
        id: new Types.ObjectId().toString(),
        email: 'test@example.com',
        sessionId: new Types.ObjectId().toString(),
        ...overrides
    };
}
