import { Types } from 'mongoose';

import { connectDatabase, disconnectDatabase } from './db';
import {
    CounterModel,
    EventModel,
    EventProductModel,
    EventUserModel,
    LocalStateModel,
    ProductModel,
    StandModel,
    StationModel,
    UserModel
} from './models';

const OID = {
    event: new Types.ObjectId('64b000000000000000000001'),
    stand: new Types.ObjectId('64b000000000000000000002'),
    stationCucina: new Types.ObjectId('64b000000000000000000003'),
    stationGriglia: new Types.ObjectId('64b000000000000000000004'),
    stationBibite: new Types.ObjectId('64b000000000000000000005'),
    product1: new Types.ObjectId('64b000000000000000000006'),
    product2: new Types.ObjectId('64b000000000000000000007'),
    product3: new Types.ObjectId('64b000000000000000000008'),
    product4: new Types.ObjectId('64b000000000000000000009'),
    userCashier: new Types.ObjectId('000000000000000000000001'),
    userClient1: new Types.ObjectId('000000000000000000000002'),
    userClient2: new Types.ObjectId('000000000000000000000003')
};

async function seedEvent() {
    const exists = await EventModel.findById(OID.event);
    if (exists) return;
    await EventModel.create({
        _id: OID.event,
        name: 'Street Food Festival Demo',
        location: { label: 'Piazza Demo', city: 'Milano', country: 'IT' },
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        currencyName: 'Crediti',
        currencySymbol: null,
        exchangeRate: 1,
        isPublic: true,
        cashPaymentsEnabled: true,
        unifiedCashierEnabled: true
    });
    console.log('[seed] Event creato');
}

async function seedStand() {
    const exists = await StandModel.findById(OID.stand);
    if (exists) return;
    await StandModel.create({
        _id: OID.stand,
        type: 'food',
        name: 'Trattoria del Porto',
        slogan: 'Cucina del sud',
        description: 'Specialità mediterranee',
        eventIds: [OID.event],
        locations: [{ eventId: OID.event, location: { type: 'Point', coordinates: [9.19, 45.46] } }],
        numbers: [{ eventId: OID.event, number: 1, showOnMap: true }]
    });
    console.log('[seed] Stand creato');
}

async function seedStations() {
    const count = await StationModel.countDocuments({ standId: OID.stand });
    if (count > 0) return;
    await StationModel.create([
        { _id: OID.stationCucina, standId: OID.stand, name: 'Cucina', sequenceOrder: 0 },
        { _id: OID.stationGriglia, standId: OID.stand, name: 'Griglia', sequenceOrder: 1 },
        { _id: OID.stationBibite, standId: OID.stand, name: 'Bibite', sequenceOrder: 2 }
    ]);
    console.log('[seed] Postazioni create');
}

async function seedProducts() {
    const count = await ProductModel.countDocuments({ _id: { $in: [OID.product1, OID.product2, OID.product3, OID.product4] } });
    if (count > 0) return;

    await ProductModel.create([
        { _id: OID.product1, name: 'Panino con porchetta', description: 'Il classico', price: 6, ingredients: ['Pane', 'Porchetta'] },
        { _id: OID.product2, name: 'Pizza fritta', description: 'Croccante e soffice', price: 5, ingredients: ['Impasto', 'Ricotta', 'Salame'] },
        { _id: OID.product3, name: 'Arancino', description: 'Fritto siciliano', price: 4, ingredients: ['Riso', 'Ragù'] },
        { _id: OID.product4, name: 'Bibita', description: 'Analcolica', price: 2, ingredients: [] }
    ]);

    await EventProductModel.create([
        { _id: new Types.ObjectId('64b00000000000000000000a'), eventId: OID.event, standId: OID.stand, productId: OID.product1, stationIds: [OID.stationCucina], priceOverride: null, available: true },
        { _id: new Types.ObjectId('64b00000000000000000000b'), eventId: OID.event, standId: OID.stand, productId: OID.product2, stationIds: [OID.stationCucina, OID.stationGriglia], priceOverride: 5.5, available: true },
        { _id: new Types.ObjectId('64b00000000000000000000c'), eventId: OID.event, standId: OID.stand, productId: OID.product3, stationIds: [OID.stationCucina], priceOverride: null, available: true },
        { _id: new Types.ObjectId('64b00000000000000000000d'), eventId: OID.event, standId: OID.stand, productId: OID.product4, stationIds: [OID.stationBibite], priceOverride: null, available: true }
    ]);
    console.log('[seed] Prodotti + EventProduct creati');
}

async function seedUsersAndClients() {
    const cashier = await UserModel.findById(OID.userCashier);
    if (!cashier) {
        await UserModel.create({
            _id: OID.userCashier,
            firstName: 'Cassa',
            lastName: 'Locale',
            email: 'cassa@local.demo',
            passwordHash: null,
            isActive: true
        });
    }

    await EventUserModel.findOneAndUpdate(
        { eventId: OID.event, userId: OID.userClient1 },
        { $setOnInsert: { eventId: OID.event, userId: OID.userClient1, balance: 50, displayName: 'Mario Rossi', isActive: true } },
        { upsert: true }
    );
    await EventUserModel.findOneAndUpdate(
        { eventId: OID.event, userId: OID.userClient2 },
        { $setOnInsert: { eventId: OID.event, userId: OID.userClient2, balance: 20, displayName: 'Giulia Bianchi', isActive: true } },
        { upsert: true }
    );
    await EventUserModel.findOneAndUpdate(
        { eventId: OID.event, userId: null },
        { $setOnInsert: { eventId: OID.event, userId: null, displayName: 'Cliente Generico', balance: 0, isActive: true } },
        { upsert: true }
    );

    await CounterModel.findOneAndUpdate(
        { standId: OID.stand },
        { $setOnInsert: { standId: OID.stand, seq: 0 } },
        { upsert: true }
    );
    console.log('[seed] Utenti + clienti + counter creati');
}

async function main() {
    await connectDatabase();
    await seedEvent();
    await seedStand();
    await seedStations();
    await seedProducts();
    await seedUsersAndClients();
    await LocalStateModel.findOneAndUpdate(
        { key: 'current' },
        {
            $setOnInsert: {
                key: 'current',
                eventId: OID.event,
                standId: OID.stand,
                remoteEventId: OID.event,
                remoteStandId: OID.stand,
                eventName: 'Street Food Festival Demo',
                currencyName: 'Crediti',
                importedAt: new Date()
            }
        },
        { upsert: true }
    );
    console.log('[seed] Completato');
    await disconnectDatabase();
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
