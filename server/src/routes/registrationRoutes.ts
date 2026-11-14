import { Router } from 'express';
import { getRegistration, getRegistrationTicket, getMyRegistrations } from '../controllers/registrationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/my-tickets', authenticateToken, getMyRegistrations);
router.get('/ref/:reference', getRegistration);
router.get('/:id/ticket', getRegistrationTicket);

export default router;
