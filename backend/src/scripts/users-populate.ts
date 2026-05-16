import * as argon2 from 'argon2';

import { UserModel } from '../models/user.model';

async function upsertUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender?: string;
  password: string;
  birthday?: Date;
}) {
  const passwordHash = await argon2.hash(input.password);

  return UserModel.findOneAndUpdate(
    { email: input.email.toLowerCase() },
    {
      $set: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        passwordHash,
        isActive: true,
      },
    },
    {
      new: true,
      upsert: true,
    },
  );
}

export async function populateUsers() {
  const adminUser = await upsertUser({
    firstName: 'Giulia',
    lastName: 'Ferri',
    email: 'giulia.ferri@streetfoodevents.test',
    phone: '+39 333 000 0001',
    gender: 'f',
    password: 'Password123!',
  });

  const cashierUser = await upsertUser({
    firstName: 'Marco',
    lastName: 'Conti',
    email: 'marco.conti@streetfoodevents.test',
    phone: '+39 333 000 0002',
    password: 'Password123!',
  });

  const kitchenUser = await upsertUser({
    firstName: 'Sara',
    lastName: 'Leoni',
    email: 'sara.leoni@streetfoodevents.test',
    phone: '+39 333 000 0003',
    gender: 'f',
    password: 'Password123!',
  });

  const customerUser = await upsertUser({
    firstName: 'Luca',
    lastName: 'Rinaldi',
    email: 'luca.rinaldi@streetfoodevents.test',
    phone: '+39 333 000 0004',
    password: 'Password123!',
  });

  if (!adminUser || !cashierUser || !kitchenUser || !customerUser) {
    throw new Error('Failed to seed users');
  }

  return {
    adminUser,
    cashierUser,
    kitchenUser,
    customerUser,
  };
}

export type SeedUsersResult = Awaited<ReturnType<typeof populateUsers>>;
