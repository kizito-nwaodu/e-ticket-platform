import { Router } from 'express';
import { postCheckIn, postManualOverride, getRecentScans } from '../controllers/validationController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Scanning / Gate Admission API (Appendix C: POST /validation/check-in)
router.post('/check-in', authenticateToken, requireRole(['admin', 'organiser', 'supervisor', 'scanner_operator']), postCheckIn);

// Supervisor Manual Override Check-in (FR-08)
router.post('/manual-override', authenticateToken, requireRole(['admin', 'organiser', 'supervisor']), postManualOverride);

// Live feed of recent scans for the scanner operator terminal
router.get('/recent-scans', authenticateToken, requireRole(['admin', 'organiser', 'supervisor', 'scanner_operator']), getRecentScans);

export default router;
