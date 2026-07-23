/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDatabase, disconnectDatabase } from '../config/database';
import mongoose from 'mongoose';

import { SessionModel } from '../models/session.model';
import { UserRoleModel } from '../models/user-role.model';
import { UserStationModel } from '../models/user-station.model';
import { FavoriteModel } from '../models/favorite.model';
import { UsageContractModel } from '../models/usage-contract.model';
import { EventUserTransactionModel } from '../models/event-user-transaction.model';
import { EventUserModel } from '../models/event-user.model';
import { OrderModel } from '../models/order.model';
import { CounterModel } from '../models/counter.model';
import { StationModel } from '../models/station.model';
import { EventProductModel } from '../models/event-product.model';
import { EventPhotoModel } from '../models/event-photo.model';
import { EventFrameModel } from '../models/event-frame.model';
import { POIModel } from '../models/poi.model';
import { ContestParticipationModel } from '../models/contest-participation.model';
import { ContestModel } from '../models/contest.model';
import { ContestPOIModel } from '../models/contest-poi.model';
import { AliasModel } from '../models/alias.model';
import { StandModel } from '../models/stand.model';
import { EventModel } from '../models/event.model';
import { UserModel } from '../models/user.model';
import { ProductModel } from '../models/product.model';

let totalRemoved = 0;

async function removeOrphans(label: string, model: any, query: Record<string, unknown>) {
    const count = await model.countDocuments(query);
    if (count > 0) {
        await model.deleteMany(query);
        console.log(`  ${label}: ${count} removed`);
        totalRemoved += count;
    } else {
        console.log(`  ${label}: clean`);
    }
}

async function run() {
    await connectDatabase();

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const validEventIds = (await EventModel.find().select('_id').lean()).map((e) => e._id);
    const validStandIds = (await StandModel.find().select('_id').lean()).map((s) => s._id);
    const validStationIds = (await StationModel.find().select('_id').lean()).map((s) => s._id);
    const validUserIds = (await UserModel.find().select('_id').lean()).map((u) => u._id);
    const validProductIds = (await ProductModel.find().select('_id').lean()).map((p) => p._id);
    const validEventUserIds = (await EventUserModel.find().select('_id').lean()).map((eu) => eu._id);
    const validContestIds = (await ContestModel.find().select('_id').lean()).map((c) => c._id);

    const validEventIdSet = new Set(validEventIds.map(String));
    const validStandIdSet = new Set(validStandIds.map(String));

    console.log('--- Cleanup orphaned data ---');
    console.log('');

    // 1. Sessions
    console.log('[Sessions]');
    await removeOrphans('Orphaned sessions', SessionModel, {
        userId: { $nin: validUserIds },
    });

    // 2. UserRoles
    console.log('[UserRoles]');
    await removeOrphans('Invalid userId', UserRoleModel, {
        userId: { $nin: validUserIds },
    });
    await removeOrphans('Invalid standId', UserRoleModel, {
        standId: { $ne: null, $nin: validStandIds },
    });
    await removeOrphans('Invalid eventId', UserRoleModel, {
        eventId: { $ne: null, $nin: validEventIds },
    });

    // 3. UserStations
    console.log('[UserStations]');
    await removeOrphans('Invalid userId', UserStationModel, {
        userId: { $nin: validUserIds },
    });
    await removeOrphans('Invalid stationId', UserStationModel, {
        stationId: { $nin: validStationIds },
    });

    // 4. Favorites
    console.log('[Favorites]');
    await removeOrphans('Invalid userId', FavoriteModel, {
        userId: { $nin: validUserIds },
    });

    // 5. UsageContracts
    console.log('[UsageContracts]');
    await removeOrphans('Invalid userId', UsageContractModel, {
        userId: { $nin: validUserIds },
    });
    await removeOrphans('Invalid eventId', UsageContractModel, {
        eventId: { $nin: validEventIds },
    });

    // 6. EventUserTransactions
    console.log('[EventUserTransactions]');
    await removeOrphans('Invalid eventUserId', EventUserTransactionModel, {
        eventUserId: { $nin: validEventUserIds },
    });
    await removeOrphans('Invalid eventId', EventUserTransactionModel, {
        eventId: { $nin: validEventIds },
    });
    await removeOrphans('Invalid userId (non-null)', EventUserTransactionModel, {
        userId: { $ne: null, $nin: validUserIds },
    });

    // 7. EventUsers
    console.log('[EventUsers]');
    await removeOrphans('Invalid eventId', EventUserModel, {
        eventId: { $nin: validEventIds },
    });

    // 8. Orders
    console.log('[Orders]');
    await removeOrphans('Invalid eventId', OrderModel, {
        eventId: { $nin: validEventIds },
    });
    await removeOrphans('Invalid standId', OrderModel, {
        standId: { $nin: validStandIds },
    });
    await removeOrphans('Invalid userId', OrderModel, {
        userId: { $nin: validUserIds },
    });

    // 9. Counters
    console.log('[Counters]');
    await removeOrphans('Invalid standId', CounterModel, {
        standId: { $nin: validStandIds },
    });

    // 10. Stations
    console.log('[Stations]');
    await removeOrphans('Invalid standId', StationModel, {
        standId: { $nin: validStandIds },
    });

    // 11. EventProducts
    console.log('[EventProducts]');
    await removeOrphans('Invalid eventId', EventProductModel, {
        eventId: { $nin: validEventIds },
    });
    await removeOrphans('Invalid standId', EventProductModel, {
        standId: { $nin: validStandIds },
    });
    await removeOrphans('Invalid productId', EventProductModel, {
        productId: { $nin: validProductIds },
    });

    // 12. EventPhotos
    console.log('[EventPhotos]');
    await removeOrphans('Invalid eventId', EventPhotoModel, {
        eventId: { $nin: validEventIds },
    });

    // 13. EventFrames
    console.log('[EventFrames]');
    await removeOrphans('Invalid eventId', EventFrameModel, {
        eventId: { $nin: validEventIds },
    });

    // 14. POIs
    console.log('[POIs]');
    await removeOrphans('Invalid eventId', POIModel, {
        eventId: { $nin: validEventIds },
    });

    // 15. ContestParticipations
    console.log('[ContestParticipations]');
    await removeOrphans('Invalid contestId', ContestParticipationModel, {
        contestId: { $nin: validContestIds },
    });

    // 16. Contests
    console.log('[Contests]');
    await removeOrphans('Invalid eventId', ContestModel, {
        eventId: { $nin: validEventIds },
    });

    // 17. ContestPOIs
    console.log('[ContestPOIs]');
    await removeOrphans('Invalid eventId', ContestPOIModel, {
        eventId: { $nin: validEventIds },
    });

    // 18. Stands with no valid events
    console.log('[Stands]');
    const orphanedStands = await StandModel.find({
        eventIds: { $not: { $elemMatch: { $in: validEventIds } } },
    });
    if (orphanedStands.length > 0) {
        await StandModel.deleteMany({ _id: { $in: orphanedStands.map((s) => s._id) } });
        console.log(`  Stands with no valid events: ${orphanedStands.length} removed`);
        totalRemoved += orphanedStands.length;
    } else {
        console.log('  Stands with no valid events: clean');
    }

    // 19. Aliases
    console.log('[Aliases]');
    const aliases = await AliasModel.find().lean();
    const orphanedAliasIds: mongoose.Types.ObjectId[] = [];
    for (const alias of aliases) {
        const a = alias as { entityType: string; entityRef?: mongoose.Types.ObjectId; _id: mongoose.Types.ObjectId };
        if (a.entityType === 'event' && !validEventIdSet.has(String(a.entityRef))) {
            orphanedAliasIds.push(a._id);
        } else if (a.entityType === 'stand' && !validStandIdSet.has(String(a.entityRef))) {
            orphanedAliasIds.push(a._id);
        }
    }
    if (orphanedAliasIds.length > 0) {
        await AliasModel.deleteMany({ _id: { $in: orphanedAliasIds } });
        console.log(`  Orphaned aliases: ${orphanedAliasIds.length} removed`);
        totalRemoved += orphanedAliasIds.length;
    } else {
        console.log('  Orphaned aliases: clean');
    }

    // 20. Orphaned counters
    console.log('[Counter cleanup]');
    const standsWithOrders = (await OrderModel.distinct('standId')).map(String);
    const orphanedCounters = await CounterModel.deleteMany({
        standId: { $nin: standsWithOrders.map((id) => new mongoose.Types.ObjectId(id)) },
    });
    if (orphanedCounters.deletedCount > 0) {
        console.log(`  Counters with no orders: ${orphanedCounters.deletedCount} removed`);
        totalRemoved += orphanedCounters.deletedCount;
    } else {
        console.log('  Counters with no orders: clean');
    }

    console.log('');
    console.log(`--- Done. Total removed: ${totalRemoved} ---`);
}

void run()
    .catch((error) => {
        console.error('Cleanup failed');
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await disconnectDatabase();
    });
