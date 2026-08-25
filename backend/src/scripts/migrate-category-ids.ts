import { connectDatabase, disconnectDatabase } from '../config/database';
import mongoose from 'mongoose';

/**
 * Migra EventProduct: converte il vecchio campo singolo `categoryId` (stringa)
 * nel nuovo campo array `categoryIds[]`.
 *
 * - Se `categoryId` esiste ed è una stringa non vuota → `categoryIds: [categoryId]`
 * - Se `categoryId` è vuoto/assente → `categoryIds: []`
 * - Rimuove il campo `categoryId` dopo la migrazione
 */

async function run() {
    await connectDatabase();

    const db = mongoose.connection.db!;
    const collection = db.collection('eventproducts');

    // Conta documenti con il vecchio campo categoryId
    const total = await collection.countDocuments({ categoryId: { $exists: true } });
    console.log(`Trovati ${total} documenti con campo legacy 'categoryId'.`);

    if (total === 0) {
        console.log('Nessuna migrazione necessaria.');
        return;
    }

    // Migra: categoryId stringa → categoryIds array
    const withCategoryId = await collection.find({ categoryId: { $exists: true, $ne: null }, $and: [{ categoryId: { $ne: '' } }] }).toArray();
    console.log(`Di questi, ${withCategoryId.length} hanno un valore non vuoto da migrare.`);

    // Set categoryIds from categoryId for documents that have a non-empty categoryId
    const result1 = await collection.updateMany(
        { categoryId: { $exists: true, $ne: null }, $and: [{ categoryId: { $ne: '' } }] },
        [
            {
                $set: {
                    categoryIds: ['$categoryId'],
                },
            },
        ],
    );
    console.log(`Aggiornati ${result1.modifiedCount} documenti con categoryIds = [categoryId].`);

    // Set categoryIds = [] for documents with empty/null/missing categoryId
    const result2 = await collection.updateMany(
        { categoryId: { $exists: true }, $or: [{ categoryId: null }, { categoryId: '' }] },
        { $set: { categoryIds: [] } },
    );
    console.log(`Aggiornati ${result2.modifiedCount} documenti con categoryIds = [] (categoryId vuoto).`);

    // Remove the legacy categoryId field from all documents
    const result3 = await collection.updateMany(
        { categoryId: { $exists: true } },
        { $unset: { categoryId: '' } },
    );
    console.log(`Rimosso campo 'categoryId' da ${result3.modifiedCount} documenti.`);

    console.log('Migrazione completata.');
}

void run()
    .catch((error) => {
        console.error('Migrazione fallita:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await disconnectDatabase();
    });
