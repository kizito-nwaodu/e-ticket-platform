import { Router } from 'express';
import { login, getCurrentUser, registerAttendeeAccount } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Rate limiter for authentication endpoints (OWASP API4 brute force defense)
const loginLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  message: 'Too many authentication attempts. Please wait 5 minutes before trying again.',
});

const registerLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: 'Too many registration requests. Please wait a few minutes before trying again.',
});

router.post('/login', loginLimiter, login);
router.post('/register', registerLimiter, registerAttendeeAccount);
router.get('/me', authenticateToken, getCurrentUser);

export default router;
