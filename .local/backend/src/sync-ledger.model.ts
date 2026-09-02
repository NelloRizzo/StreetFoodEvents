import { Schema, model, type InferSchemaType } from 'mongoose';

export const syncStatusValues = ['pending', 'synced', 'conflict'] as const;

const syncLedgerSchema = new Schema(
    {
        entityType: { type: String, required: true, enum: ['Order', 'Counter'] },
        localId: { type: Schema.Types.ObjectId, required: true },
        machineId: { type: String, required: true },
        syncStatus: { type: String, enum: syncStatusValues, default: 'pending', index: true },
        lastModifiedAt: { type: Date, default: Date.now },
        syncedAt: { type: Date, default: null },
        remoteVersion: { type: Number, default: 0 }
    },
    { versionKey: false }
);

syncLedgerSchema.index({ entityType: 1, localId: 1 }, { unique: true });
syncLedgerSchema.index({ syncStatus: 1, lastModifiedAt: 1 });

export type SyncLedger = InferSchemaType<typeof syncLedgerSchema>;
export type SyncStatus = (typeof syncStatusValues)[number];

export const SyncLedgerModel = model('SyncLedger', syncLedgerSchema);
