import { Router, type Request, type Response } from 'express';
import {
    getMeta,
    fetchRemoteEvents,
    fetchRemoteStands,
    importFromRemote,
    countPending,
    pushToRemote,
    listPending
} from '../sync.service';

export const syncRouter = Router();

async function handleGetMeta(_req: Request, res: Response) {
    const meta = await getMeta();
    return res.status(200).json(meta);
}

async function handleRemoteEvents(_req: Request, res: Response) {
    const result = await fetchRemoteEvents();
    return res.status(200).json(result);
}

async function handleRemoteStands(req: Request, res: Response) {
    const { eventId } = req.params;
    if (!eventId) return res.status(400).json({ message: 'eventId required' });
    const result = await fetchRemoteStands(eventId);
    return res.status(200).json(result);
}

async function handleImport(req: Request, res: Response) {
    const { eventId, standId, force } = req.body ?? {};
    if (!eventId || !standId) {
        return res.status(400).json({ message: 'eventId and standId required' });
    }
    const result = await importFromRemote(eventId, standId, force === true);
    if (result.status === 'pending') {
        return res.status(409).json({
            message: `${result.pendingCount} modifiche non sincronizzate. Sincronizza prima o usa force: true per sovrascrivere.`,
            pendingCount: result.pendingCount
        });
    }
    return res.status(200).json(result);
}

async function handlePendingCount(_req: Request, res: Response) {
    const count = await countPending();
    return res.status(200).json({ count });
}

async function handlePendingList(_req: Request, res: Response) {
    const [orders, transactions, counters] = await Promise.all([
        listPending('Order'),
        listPending('EventUserTransaction'),
        listPending('Counter')
    ]);
    return res.status(200).json({
        orders: orders.length,
        transactions: transactions.length,
        counters: counters.length,
        total: orders.length + transactions.length + counters.length
    });
}

async function handlePush(_req: Request, res: Response) {
    const result = await pushToRemote();
    return res.status(200).json(result);
}

syncRouter.get('/meta', handleGetMeta);
syncRouter.get('/remote/events', handleRemoteEvents);
syncRouter.get('/remote/events/:eventId/stands', handleRemoteStands);
syncRouter.post('/import', handleImport);
syncRouter.get('/pending/count', handlePendingCount);
syncRouter.get('/pending', handlePendingList);
syncRouter.post('/push', handlePush);

export default syncRouter;
