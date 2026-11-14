import { Router } from 'express';
import { listAllUsers, createUserWithRole, assignUserRole, deleteUserAccount } from '../controllers/adminController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Platform Admin only
router.get('/users', authenticateToken, requireRole(['admin']), listAllUsers);
router.post('/users', authenticateToken, requireRole(['admin']), createUserWithRole);
router.delete('/users/:id', authenticateToken, requireRole(['admin']), deleteUserAccount);
router.post('/assign-role', authenticateToken, requireRole(['admin']), assignUserRole);

export default router;
