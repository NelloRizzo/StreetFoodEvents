import { describe, expect, it } from 'vitest';

import { EventModel } from '../../models/event.model';
import { createTestEvent } from '../helpers/factory';

describe('Event model', () => {
    it('creates a valid event', async () => {
        const data = createTestEvent();
        const event = await EventModel.create(data);

        expect(event._id).toBeDefined();
        expect(event.name).toBe(data.name);
        expect(event.currencyName).toBe(data.currencyName);
    });

    it('rejects endDate before startDate', async () => {
        const startDate = new Date('2026-06-10');
        const endDate = new Date('2026-06-01');

        await expect(
            EventModel.create(createTestEvent({ startDate, endDate }))
        ).rejects.toThrow();
    });

    it('accepts same startDate and endDate', async () => {
        const date = new Date('2026-06-10');

        const event = await EventModel.create(
            createTestEvent({ startDate: date, endDate: date })
        );

        expect(event.startDate).toEqual(date);
        expect(event.endDate).toEqual(date);
    });

    it('stores theme colors when provided', async () => {
        const event = await EventModel.create(
            createTestEvent({
                themeBrand: '#ff0000',
                themeText: '#ffffff',
                themeSurface: '#000000',
                themeHighlight: '#00ff00'
            })
        );

        expect(event.themeBrand).toBe('#ff0000');
        expect(event.themeText).toBe('#ffffff');
        expect(event.themeSurface).toBe('#000000');
        expect(event.themeHighlight).toBe('#00ff00');
    });

    it('stores null theme colors by default', async () => {
        const event = await EventModel.create(createTestEvent());

        expect(event.themeBrand).toBeNull();
        expect(event.themeText).toBeNull();
        expect(event.themeSurface).toBeNull();
        expect(event.themeHighlight).toBeNull();
    });

    it('stores url, short and long descriptions', async () => {
        const event = await EventModel.create(
            createTestEvent({
                url: 'https://example.com',
                shortDescription: 'Short desc',
                longDescription: 'Long desc with <b>HTML</b>'
            })
        );

        expect(event.url).toBe('https://example.com');
        expect(event.shortDescription).toBe('Short desc');
        expect(event.longDescription).toBe('Long desc with <b>HTML</b>');
    });
});
