import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, requireRole(['admin', 'organiser', 'auditor']), getAuditLogs);

export default router;
