import express from 'express';
import request from 'supertest';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { hasRole } from '../../middlewares/role.middleware';
import { RoleModel } from '../../models/role.model';
import { UserRoleModel } from '../../models/user-role.model';

/* Il middleware da' per scontato che `req.user` sia gia' impostato
 * (lo fa authMiddleware): qui lo simuliamo per testare il guard da solo. */
const USER_ID = new Types.ObjectId();

function makeApp() {
    const app = express();
    app.use((req, _res, next) => {
        (req as express.Request & { user?: unknown }).user = {
            id: USER_ID.toString(),
            email: 'test@example.com',
            sessionId: new Types.ObjectId().toString()
        };
        next();
    });

    /* Route con ENTRAMBI i parametri: e' il caso in cui il guard era rotto. */
    const guard = hasRole(['stand-cashier'], { eventParam: 'eventId', standParam: 'standId' });
    app.get('/api/probe/:eventId/stands/:standId', guard, (_req, res) => {
        res.json({ ok: true });
    });

    return app;
}

async function assign(
    slug: string,
    scopes: { eventId?: Types.ObjectId; standId?: Types.ObjectId } = {},
    isActive = true
) {
    const role = await RoleModel.create({ name: `Role ${slug}`, slug, scope: 'stand', permissions: ['manage'] });
    await UserRoleModel.create({ userId: USER_ID, roleId: role._id, isActive, ...scopes });
}

describe('Middleware: hasRole con scope evento E stand', () => {
    const app = makeApp();
    const eventA = new Types.ObjectId();
    const eventB = new Types.ObjectId();
    const standA = new Types.ObjectId();
    const standB = new Types.ObjectId();

    beforeEach(async () => {
        // La pulizia delle collection e' globale (helpers/setup.ts).
    });

    it('ruolo senza scope (globale) passa su entrambi i parametri', async () => {
        await assign('stand-cashier');

        const res = await request(app).get(`/api/probe/${eventA}/stands/${standA}`);
        expect(res.status).toBe(200);
    });

    it('ruolo con scope stand ma senza evento passa: lo scope evento non e\' impostato', async () => {
        await assign('stand-cashier', { standId: standA });

        const res = await request(app).get(`/api/probe/${eventA}/stands/${standA}`);
        expect(res.status).toBe(200);
    });

    /* Il bug: i due scope erano due chiavi $or NELLO STESSO oggetto, quindi la
     * seconda sovrascriveva la prima e lo scope evento non veniva controllato:
     * un ruolo legato all'evento B passava la route dell'evento A. */
    it('ruolo legato a un ALTRO evento viene respinto (cross-event)', async () => {
        await assign('stand-cashier', { eventId: eventB, standId: standA });

        const res = await request(app).get(`/api/probe/${eventA}/stands/${standA}`);
        expect(res.status).toBe(403);
    });

    it('ruolo dell\'evento giusto ma di un ALTRO stand viene respinto (cross-stand)', async () => {
        await assign('stand-cashier', { eventId: eventA, standId: standB });

        const res = await request(app).get(`/api/probe/${eventA}/stands/${standA}`);
        expect(res.status).toBe(403);
    });

    it('ruolo con evento e stand corretti passa', async () => {
        await assign('stand-cashier', { eventId: eventA, standId: standA });

        const res = await request(app).get(`/api/probe/${eventA}/stands/${standA}`);
        expect(res.status).toBe(200);
    });

    /* event-admin viene aggiunto agli slug ammessi quando c'e' eventParam. */
    it('event-admin dell\'evento richiesto passa', async () => {
        const role = await RoleModel.create({ name: 'Role event-admin', slug: 'event-admin', scope: 'event', permissions: ['manage'] });
        await UserRoleModel.create({ userId: USER_ID, roleId: role._id, eventId: eventA, isActive: true });

        const res = await request(app).get(`/api/probe/${eventA}/stands/${standA}`);
        expect(res.status).toBe(200);
    });

    it('event-admin di un altro evento viene respinto', async () => {
        const role = await RoleModel.create({ name: 'Role event-admin 2', slug: 'event-admin', scope: 'event', permissions: ['manage'] });
        await UserRoleModel.create({ userId: USER_ID, roleId: role._id, eventId: eventB, isActive: true });

        const res = await request(app).get(`/api/probe/${eventA}/stands/${standA}`);
        expect(res.status).toBe(403);
    });

    it('ruolo disattivato viene respinto', async () => {
        await assign('stand-cashier', { eventId: eventA, standId: standA }, false);

        const res = await request(app).get(`/api/probe/${eventA}/stands/${standA}`);
        expect(res.status).toBe(403);
    });
});
