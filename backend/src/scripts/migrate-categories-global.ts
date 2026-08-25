/**
 * Migration: extract categories from Events into the global Category collection.
 * Run with: npx tsx src/scripts/migrate-categories-global.ts
 */
import mongoose from 'mongoose';

import { env } from '../config/env';
import { EventModel } from '../models/event.model';
import { CategoryModel } from '../models/category.model';

async function run() {
    await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB_NAME });
    console.log('Connected to MongoDB');

    const events = await EventModel.find({ 'categories.0': { $exists: true } }).lean();
    console.log(`Found ${events.length} events with categories`);

    const seen = new Map<string, number>(); // label -> max sortOrder

    for (const event of events) {
        for (const cat of event.categories ?? []) {
            const key = cat.label.trim().toLowerCase();
            const existing = seen.get(key);
            if (existing !== undefined) {
                seen.set(key, Math.max(existing, cat.sortOrder ?? 0));
                continue;
            }
            seen.set(key, cat.sortOrder ?? 0);
        }
    }

    console.log(`Found ${seen.size} unique categories across all events`);

    let created = 0;
    let skipped = 0;

    for (const [label, sortOrder] of seen) {
        const normalized = label.trim().replace(/\s+/g, ' ');
        const existing = await CategoryModel.findOne({ label: normalized });
        if (existing) {
            skipped++;
            continue;
        }
        await CategoryModel.create({ label: normalized, sortOrder });
        created++;
        console.log(`  Created: "${normalized}" (sortOrder: ${sortOrder})`);
    }

    console.log(`Done. Created: ${created}, Skipped (already exist): ${skipped}`);
    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
