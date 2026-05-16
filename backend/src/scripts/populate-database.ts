import { connectDatabase, disconnectDatabase } from '../config/database';
import { populateEventProducts } from './event-products-populate';
import { populateEvents } from './events-populate';
import { populateFavorites } from './favorites-populate';
import { populateOrders } from './orders-populate';
import { populateProducts } from './products-populate';
import { populateRoles } from './roles-populate';
import { populateStandRoles } from './stand-roles-populate';
import { populateStands } from './stands-populate';
import { populateStations } from './stations-populate';
import { populateTransactions } from './transactions-populate';
import { populateUserStations } from './user-stations-populate';
import { populateUsers } from './users-populate';

async function run() {
  await connectDatabase();

  const users = await populateUsers();
  const roles = await populateRoles(users);
  const events = await populateEvents(users, roles);
  const stands = await populateStands(events);
  await populateStandRoles(users, roles, stands);
  const stations = await populateStations(stands);
  const products = await populateProducts();
  await populateEventProducts(events, stands, products, stations);
  await populateOrders(users, events, stands, products, stations);
  await populateTransactions(users, events);
  await populateUserStations(users, stations);
  await populateFavorites(users, events);

  console.log('Database populated successfully');
  console.log('Login test user:', users.adminUser.email);
  console.log('Password:', 'Password123!');
}

void run()
  .catch((error) => {
    console.error('Database population failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
