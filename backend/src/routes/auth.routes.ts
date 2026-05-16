import { Router } from 'express';

import { getMyRoles, getMyStands, login, logout, me, meQrCode, register, updateMe } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(register));
authRouter.post('/login', asyncHandler(login));
authRouter.post('/logout', asyncHandler(authMiddleware), asyncHandler(logout));
authRouter.get('/me', asyncHandler(authMiddleware), asyncHandler(me));
authRouter.get('/me/qrcode', asyncHandler(authMiddleware), asyncHandler(meQrCode));
authRouter.get('/me/roles', asyncHandler(authMiddleware), asyncHandler(getMyRoles));
authRouter.get('/me/stands', asyncHandler(authMiddleware), asyncHandler(getMyStands));
authRouter.patch('/me', asyncHandler(authMiddleware), asyncHandler(updateMe));
