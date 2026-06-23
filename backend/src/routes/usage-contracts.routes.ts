import { Router } from 'express';

import {
    createUsageContract,
    deleteUsageContract,
    getUsageContract,
    listUsageContracts,
    updateUsageContract,
} from '../controllers/usage-contracts.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const usageContractsRouter = Router();

usageContractsRouter.use(asyncHandler(authMiddleware));

usageContractsRouter.get('/', asyncHandler(listUsageContracts));
usageContractsRouter.post('/', asyncHandler(createUsageContract));
usageContractsRouter.get('/:id', asyncHandler(getUsageContract));
usageContractsRouter.patch('/:id', asyncHandler(updateUsageContract));
usageContractsRouter.delete('/:id', asyncHandler(deleteUsageContract));
