import { Router, type Request, type Response, type NextFunction } from 'express';
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

/**
 * Wraps an async handler so that any rejection is forwarded to Express's error
 * middleware instead of becoming an unhandled rejection that crashes the
 * process (this happened when the remote sync API returned an error).
 */
function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch(next);
    };
}

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
    const [orders, counters] = await Promise.all([
        listPending('Order'),
        listPending('Counter')
    ]);
    return res.status(200).json({
        orders: orders.length,
        counters: counters.length,
        total: orders.length + counters.length
    });
}

async function handlePush(_req: Request, res: Response) {
    const result = await pushToRemote();
    return res.status(200).json(result);
}

syncRouter.get('/meta', asyncHandler(handleGetMeta));
syncRouter.get('/remote/events', asyncHandler(handleRemoteEvents));
syncRouter.get('/remote/events/:eventId/stands', asyncHandler(handleRemoteStands));
syncRouter.post('/import', asyncHandler(handleImport));
syncRouter.get('/pending/count', asyncHandler(handlePendingCount));
syncRouter.get('/pending', asyncHandler(handlePendingList));
syncRouter.post('/push', asyncHandler(handlePush));

export default syncRouter;
