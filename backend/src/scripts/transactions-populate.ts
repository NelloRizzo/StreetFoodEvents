import { EventUserTransactionModel } from '../models/event-user-transaction.model';
import { createEventUserTransaction } from '../services/event-user-transactions.service';
import type { SeedEventsResult } from './events-populate';
import type { SeedUsersResult } from './users-populate';

export async function populateTransactions(
  seedUsers: SeedUsersResult,
  seedEvents: SeedEventsResult,
) {
  await EventUserTransactionModel.deleteMany({
    eventUserId: seedEvents.customerSpringWallet._id,
  });

  seedEvents.customerSpringWallet.balance = 0;
  await seedEvents.customerSpringWallet.save();

  await createEventUserTransaction({
    eventUserId: seedEvents.customerSpringWallet._id,
    type: 'top-up',
    direction: 'credit',
    amount: 40,
    description: 'Ricarica iniziale wallet demo',
    performedByUserId: seedUsers.adminUser._id,
    occurredAt: new Date('2026-06-12T10:30:00.000Z'),
  });

  await createEventUserTransaction({
    eventUserId: seedEvents.customerSpringWallet._id,
    type: 'purchase',
    direction: 'debit',
    amount: 12,
    description: 'Acquisto panino gourmet',
    performedByUserId: seedUsers.cashierUser._id,
    occurredAt: new Date('2026-06-12T11:10:00.000Z'),
  });

  await createEventUserTransaction({
    eventUserId: seedEvents.customerSpringWallet._id,
    type: 'purchase',
    direction: 'debit',
    amount: 8,
    description: 'Bevanda e dessert',
    performedByUserId: seedUsers.cashierUser._id,
    occurredAt: new Date('2026-06-12T11:45:00.000Z'),
  });

  await createEventUserTransaction({
    eventUserId: seedEvents.customerSpringWallet._id,
    type: 'refund',
    direction: 'credit',
    amount: 5,
    description: 'Storno test',
    performedByUserId: seedUsers.adminUser._id,
    occurredAt: new Date('2026-06-12T12:05:00.000Z'),
  });
}
