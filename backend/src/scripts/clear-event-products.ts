import { connectDatabase, disconnectDatabase } from '../config/database';
import { EventProductModel } from '../models/event-product.model';

async function main() {
  await connectDatabase();

  const result = await EventProductModel.deleteMany({});
  console.log(`Eliminate ${result.deletedCount} associazioni prodotto/evento/stand.`);

  await disconnectDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
