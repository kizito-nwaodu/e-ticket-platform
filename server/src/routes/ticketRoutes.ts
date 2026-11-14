import { Router } from 'express';
import { getTicket, postRevokeTicket, postReissueTicket, searchTickets } from '../controllers/ticketController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Public: view digital ticket details (by ticket ID or ticket number)
router.get('/view/:id', getTicket);

// Staff: search tickets for supervisor review / manual entry lookup
router.get('/search', authenticateToken, requireRole(['admin', 'organiser', 'supervisor', 'scanner_operator']), searchTickets);

// Organiser/Supervisor: Revoke or Reissue ticket (Appendix C)
router.post('/:id/revoke', authenticateToken, requireRole(['admin', 'organiser', 'supervisor']), postRevokeTicket);
router.post('/:id/reissue', authenticateToken, requireRole(['admin', 'organiser', 'supervisor']), postReissueTicket);

export default router;
