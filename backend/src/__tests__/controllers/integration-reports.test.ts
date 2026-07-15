import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/cloudinary', () => ({
    cloudinary: {
        upload: { stream: vi.fn() },
        api: { delete_resources: vi.fn() }
    }
}));

vi.mock('@/services/cloudinary-upload.service', () => ({
    deleteImage: vi.fn().mockResolvedValue(undefined),
    uploadImage: vi.fn(),
    uploadImages: vi.fn()
}));

import { CounterModel } from '../../models/counter.model';
import { EventModel } from '../../models/event.model';
import { EventProductModel } from '../../models/event-product.model';
import { EventUserModel } from '../../models/event-user.model';
import { OrderModel } from '../../models/order.model';
import { ProductModel } from '../../models/product.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { StandModel } from '../../models/stand.model';
import { StationModel } from '../../models/station.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import {
    generateSessionToken,
    getSessionExpiryDate,
    hashSessionToken
} from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession() {
    const user = await UserModel.create({
        firstName: 'Report',
        lastName: 'Tester',
        email: `report-${Date.now()}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        isActive: true
    });

    const sessionToken = generateSessionToken();
    await SessionModel.create({
        userId: user._id,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: getSessionExpiryDate(),
        lastActivityAt: new Date()
    });

    return { user, sessionToken };
}

async function setupReportEnvironment() {
    app = createTestApp();
    const { user, sessionToken } = await createAuthSession();

    const event = await EventModel.create({
        name: 'Report Event',
        location: { label: 'Loc', coordinates: { type: 'Point', coordinates: [12.5, 41.9] } },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-07'),
        currencyName: 'TC',
        cashPaymentsEnabled: true
    });

    const platformAdminRole = await RoleModel.create({
        name: 'Platform Admin',
        scope: 'platform',
        slug: 'platform-admin',
        permissions: [],
        isSystem: true,
        isActive: true
    });

    await UserRoleModel.create({
        userId: user._id,
        roleId: platformAdminRole._id,
        isActive: true
    });

    const stand1 = await StandModel.create({ name: 'Stand One', eventIds: [event._id] });
    const stand2 = await StandModel.create({ name: 'Stand Two', eventIds: [event._id] });

    const station1 = await StationModel.create({ standId: stand1._id, name: 'Station One' });
    const station2 = await StationModel.create({ standId: stand2._id, name: 'Station Two' });

    const product1 = await ProductModel.create({ name: 'Burger', price: 10 });
    const product2 = await ProductModel.create({ name: 'Fries', price: 5 });

    const eventProduct1 = await EventProductModel.create({
        eventId: event._id,
        standId: stand1._id,
        productId: product1._id,
        stationIds: [station1._id]
    });

    const eventProduct2 = await EventProductModel.create({
        eventId: event._id,
        standId: stand2._id,
        productId: product2._id,
        stationIds: [station2._id]
    });

    await CounterModel.create({ standId: stand1._id, seq: 0 });
    await CounterModel.create({ standId: stand2._id, seq: 0 });

    return {
        user,
        sessionToken,
        event,
        stand1,
        stand2,
        station1,
        station2,
        eventProduct1,
        eventProduct2
    };
}

async function createOrder(
    sessionToken: string,
    eventId: string,
    standId: string,
    eventProductId: string,
    stationId: string,
    quantity: number,
    paymentOnCreate?: { creditAmount: number }
) {
    return request(app)
        .post('/api/orders')
        .set('Cookie', `sid=${sessionToken}`)
        .send({
            eventId,
            standId,
            items: [{ eventProductId, stationId, quantity }],
            ...(paymentOnCreate ? { paymentOnCreate } : {})
        });
}

describe('Integration — Order Reports', () => {
    it('stand report shows correct totals', async () => {
        const env = await setupReportEnvironment();

        const order1 = await createOrder(
            env.sessionToken,
            env.event._id.toString(),
            env.stand1._id.toString(),
            env.eventProduct1._id.toString(),
            env.station1._id.toString(),
            2,
            { creditAmount: 0 }
        );
        expect(order1.status).toBe(201);

        const order2 = await createOrder(
            env.sessionToken,
            env.event._id.toString(),
            env.stand1._id.toString(),
            env.eventProduct1._id.toString(),
            env.station1._id.toString(),
            3,
            { creditAmount: 0 }
        );
        expect(order2.status).toBe(201);

        const res = await request(app)
            .get(`/api/orders/report/stand/${env.stand1._id}`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.summary.totalOrders).toBe(2);
        expect(res.body.summary.totalRevenue).toBe(50);
    });

    it('stand report with credit vs cash split', async () => {
        const env = await setupReportEnvironment();

        await EventUserModel.create({
            eventId: env.event._id,
            userId: env.user._id,
            balance: 100,
            isActive: true
        });

        const creditOrder = await createOrder(
            env.sessionToken,
            env.event._id.toString(),
            env.stand1._id.toString(),
            env.eventProduct1._id.toString(),
            env.station1._id.toString(),
            1,
            { creditAmount: 10 }
        );
        expect(creditOrder.status).toBe(201);

        const cashOrder = await createOrder(
            env.sessionToken,
            env.event._id.toString(),
            env.stand1._id.toString(),
            env.eventProduct1._id.toString(),
            env.station1._id.toString(),
            1,
            { creditAmount: 0 }
        );
        expect(cashOrder.status).toBe(201);

        const res = await request(app)
            .get(`/api/orders/report/stand/${env.stand1._id}`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.summary.totalRevenue).toBe(20);
        expect(res.body.summary.totalCreditRevenue).toBe(10);
        expect(res.body.summary.cashRevenue).toBe(10);
    });

    it('event report aggregates across stands', async () => {
        const env = await setupReportEnvironment();

        const order1 = await createOrder(
            env.sessionToken,
            env.event._id.toString(),
            env.stand1._id.toString(),
            env.eventProduct1._id.toString(),
            env.station1._id.toString(),
            2,
            { creditAmount: 0 }
        );
        expect(order1.status).toBe(201);

        const order2 = await createOrder(
            env.sessionToken,
            env.event._id.toString(),
            env.stand2._id.toString(),
            env.eventProduct2._id.toString(),
            env.station2._id.toString(),
            3,
            { creditAmount: 0 }
        );
        expect(order2.status).toBe(201);

        const res = await request(app)
            .get(`/api/orders/report/event/${env.event._id}`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.stands).toHaveLength(2);

        const stand1Report = res.body.stands.find(
            (s: { standId: string }) => s.standId === env.stand1._id.toString()
        );
        const stand2Report = res.body.stands.find(
            (s: { standId: string }) => s.standId === env.stand2._id.toString()
        );

        expect(stand1Report).toBeDefined();
        expect(stand1Report.totalOrders).toBe(1);
        expect(stand1Report.totalRevenue).toBe(20);

        expect(stand2Report).toBeDefined();
        expect(stand2Report.totalOrders).toBe(1);
        expect(stand2Report.totalRevenue).toBe(15);
    });

    it('event report totals sum all stands', async () => {
        const env = await setupReportEnvironment();

        await EventUserModel.create({
            eventId: env.event._id,
            userId: env.user._id,
            balance: 100,
            isActive: true
        });

        const order1 = await createOrder(
            env.sessionToken,
            env.event._id.toString(),
            env.stand1._id.toString(),
            env.eventProduct1._id.toString(),
            env.station1._id.toString(),
            2,
            { creditAmount: 0 }
        );
        expect(order1.status).toBe(201);

        const order2 = await createOrder(
            env.sessionToken,
            env.event._id.toString(),
            env.stand1._id.toString(),
            env.eventProduct1._id.toString(),
            env.station1._id.toString(),
            1,
            { creditAmount: 10 }
        );
        expect(order2.status).toBe(201);

        const order3 = await createOrder(
            env.sessionToken,
            env.event._id.toString(),
            env.stand2._id.toString(),
            env.eventProduct2._id.toString(),
            env.station2._id.toString(),
            2,
            { creditAmount: 0 }
        );
        expect(order3.status).toBe(201);

        const res = await request(app)
            .get(`/api/orders/report/event/${env.event._id}`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);

        expect(res.body.totals.totalOrders).toBe(3);
        expect(res.body.totals.totalRevenue).toBe(40);
        expect(res.body.totals.cashRevenue).toBe(30);
        expect(res.body.totals.creditRevenue).toBe(10);
    });

    it('event report excludes cancelled orders from revenue', async () => {
        const env = await setupReportEnvironment();

        const order1 = await createOrder(
            env.sessionToken,
            env.event._id.toString(),
            env.stand1._id.toString(),
            env.eventProduct1._id.toString(),
            env.station1._id.toString(),
            2,
            { creditAmount: 0 }
        );
        expect(order1.status).toBe(201);
        const orderId1 = order1.body.item.id;

        const cancelRes = await request(app)
            .post(`/api/orders/${orderId1}/cancel`)
            .set('Cookie', `sid=${env.sessionToken}`)
            .send({ reason: 'Changed mind' });
        expect(cancelRes.status).toBe(200);

        const order2 = await createOrder(
            env.sessionToken,
            env.event._id.toString(),
            env.stand1._id.toString(),
            env.eventProduct1._id.toString(),
            env.station1._id.toString(),
            3,
            { creditAmount: 0 }
        );
        expect(order2.status).toBe(201);

        const res = await request(app)
            .get(`/api/orders/report/event/${env.event._id}`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.totals.totalOrders).toBe(2);
        expect(res.body.totals.totalRevenue).toBe(30);

        const standReport = res.body.stands[0];
        expect(standReport.totalOrders).toBe(2);
        expect(standReport.totalRevenue).toBe(30);
        expect(standReport.refundedAmount).toBe(20);

        const statusReport = await request(app)
            .get(`/api/orders/report/stand/${env.stand1._id}`)
            .set('Cookie', `sid=${env.sessionToken}`);

        expect(statusReport.status).toBe(200);
        const cancelledEntry = statusReport.body.statusBreakdown.find(
            (s: { status: string }) => s.status === 'cancelled'
        );
        expect(cancelledEntry).toBeDefined();
        expect(cancelledEntry.count).toBe(1);
    });
});
