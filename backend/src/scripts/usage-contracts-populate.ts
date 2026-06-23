import { UsageContractModel } from '../models/usage-contract.model';
import { UserModel } from '../models/user.model';
import { EventModel } from '../models/event.model';

export async function populateUsageContracts() {
    const luca = await UserModel.findOne({ email: 'luca.rinaldi@streetfoodevents.test' });
    const springEvent = await EventModel.findOne({ name: 'Spring Street Food Festival' });

    if (!luca || !springEvent) {
        console.log('  Skipping usage contracts: prerequisite data not found (need luca + Spring Event)');
        return;
    }

    const existing = await UsageContractModel.findOne({
        userId: luca._id,
        eventId: springEvent._id,
    });
    if (existing) {
        console.log('  Usage contracts already seeded');
        return;
    }

    await UsageContractModel.create({
        userId: luca._id,
        eventId: springEvent._id,
        maxStands: 2,
        status: 'active',
        notes: 'Contratto di prova per Luca Rinaldi — autorizzato fino a 2 stand',
        createdBy: luca._id,
    });

    console.log('  Usage contracts seeded');
}
