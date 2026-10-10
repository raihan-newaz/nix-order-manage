import { Router } from 'express';
import { login, logout, changePassword, getMe, listUsers, createUser, updateUser } from './authController';
import { authenticateToken, requireRole } from '../../middlewares/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many login attempts. Try again later.' } });
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.post('/change-password', authenticateToken, loginLimiter, changePassword);
router.get('/me', authenticateToken, getMe);
router.get('/users', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT']), listUsers);
router.post('/users', authenticateToken, requireRole(['SUPER_ADMIN']), createUser);
router.put('/users/:id', authenticateToken, requireRole(['SUPER_ADMIN']), updateUser);

export default router;
