import { describe, expect, it } from 'vitest';

import { UserModel } from '../../models/user.model';
import { createTestUser } from '../helpers/factory';

describe('User model', () => {
    it('creates a valid user', async () => {
        const data = createTestUser();
        const user = await UserModel.create(data);

        expect(user._id).toBeDefined();
        expect(user.firstName).toBe(data.firstName);
        expect(user.lastName).toBe(data.lastName);
        expect(user.email).toBe(data.email);
        expect(user.isActive).toBe(true);
    });

    it('enforces unique email', async () => {
        const email = `unique-${Date.now()}@test.com`;
        await UserModel.create(createTestUser({ email }));

        await expect(
            UserModel.create(createTestUser({ email }))
        ).rejects.toThrow();
    });

    it('converts email to lowercase', async () => {
        const user = await UserModel.create(
            createTestUser({ email: 'MixedCase@TEST.com' })
        );

        expect(user.email).toBe('mixedcase@test.com');
    });

    it('does not select passwordHash by default', async () => {
        await UserModel.create(createTestUser());

        const user = await UserModel.findOne({});
        expect(user!.passwordHash).toBeUndefined();
    });

    it('selects passwordHash when using +select', async () => {
        await UserModel.create(createTestUser());

        const user = await UserModel.findOne({}).select('+passwordHash');
        expect(user!.passwordHash).toBeDefined();
    });

    it('trims firstName and lastName', async () => {
        const user = await UserModel.create(
            createTestUser({ firstName: '  John  ', lastName: '  Doe  ' })
        );

        expect(user.firstName).toBe('John');
        expect(user.lastName).toBe('Doe');
    });
});
