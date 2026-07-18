import { ContestModel } from '../models/contest.model';
import { ContestPOIModel } from '../models/contest-poi.model';
import type { SeedEventsResult } from './events-populate';

export async function populateContests(seedEvents: SeedEventsResult) {
    const springEventId = seedEvents.springEvent._id;

    const cpoi1 = await ContestPOIModel.findOneAndUpdate(
        { eventId: springEventId, name: 'Angolo della Griglia' },
        {
            $set: {
                eventId: springEventId,
                name: 'Angolo della Griglia',
                hint: 'Segui l\'odore della brace',
                sequenceOrder: 1
            }
        },
        { upsert: true, new: true }
    );

    const cpoi2 = await ContestPOIModel.findOneAndUpdate(
        { eventId: springEventId, name: 'Dolci Tentazioni' },
        {
            $set: {
                eventId: springEventId,
                name: 'Dolci Tentazioni',
                hint: 'Il profumo dello zucchero filato ti guiderà',
                sequenceOrder: 2
            }
        },
        { upsert: true, new: true }
    );

    const cpoi3 = await ContestPOIModel.findOneAndUpdate(
        { eventId: springEventId, name: 'Birra & Friends' },
        {
            $set: {
                eventId: springEventId,
                name: 'Birra & Friends',
                hint: 'Brindisi sotto le stelle',
                sequenceOrder: 3
            }
        },
        { upsert: true, new: true }
    );

    const cpoi4 = await ContestPOIModel.findOneAndUpdate(
        { eventId: springEventId, name: 'Angolo dello Chef' },
        {
            $set: {
                eventId: springEventId,
                name: 'Angolo dello Chef',
                hint: 'I segreti della cucina gourmet',
                sequenceOrder: 4
            }
        },
        { upsert: true, new: true }
    );

    const then = new Date();
    then.setFullYear(then.getFullYear() + 1);
    const yesterday = new Date(Date.now() - 86400000);

    await ContestModel.findOneAndUpdate(
        { eventId: springEventId, name: 'Caccia ai Sapori' },
        {
            $set: {
                eventId: springEventId,
                name: 'Caccia ai Sapori',
                description: 'Trova tutti i POI del contest nell\'ordine corretto per vincere un premio!',
                startsAt: yesterday,
                endsAt: then,
                durationMinutes: 30,
                requireSequence: true,
                prizes: [{ label: 'Un cocktail omaggio', awarded: false }],
                isActive: true,
                orderedPOIIds: [cpoi1._id, cpoi2._id, cpoi3._id, cpoi4._id]
            }
        },
        { upsert: true, new: true }
    );

    await ContestModel.findOneAndUpdate(
        { eventId: springEventId, name: 'Esploratori del Gusto' },
        {
            $set: {
                eventId: springEventId,
                name: 'Esploratori del Gusto',
                description: 'Scansiona tutti i POI in qualsiasi ordine. Hai 45 minuti di tempo!',
                startsAt: yesterday,
                endsAt: then,
                durationMinutes: 45,
                requireSequence: false,
                prizes: [
                    { label: 'Un panino gourmet omaggio', awarded: false },
                    { label: 'Una bottiglia di vino', awarded: false },
                    { label: 'Un buono da 20€', awarded: false }
                ],
                isActive: true,
                orderedPOIIds: [cpoi1._id, cpoi2._id, cpoi3._id, cpoi4._id]
            }
        },
        { upsert: true, new: true }
    );

    console.log('  Contest seed: 4 ContestPOI + 2 Contest creati per springEvent');
}
