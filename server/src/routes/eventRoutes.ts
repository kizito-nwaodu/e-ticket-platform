import { Router } from 'express';
import { getEvents, getEvent, postEvent, patchEventStatus, removeEvent } from '../controllers/eventController';
import { addEventGate } from '../controllers/adminController';
import { registerAttendee, postScheduleFailedRegistrant } from '../controllers/registrationController';
import { getDashboardAnalytics, exportAttendanceReport } from '../controllers/analyticsController';
import { authenticateToken, optionalAuthenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Public & Attendee: list published events, view event details, attendee self-registration
router.get('/', getEvents);
router.get('/:id', getEvent);
router.post('/:id/registrations', optionalAuthenticateToken, registerAttendee);

// Organiser/Admin: create event, change status, add gates, delete old events, schedule failed registrants
router.post('/', authenticateToken, requireRole(['admin', 'organiser']), postEvent);
router.patch('/:id/status', authenticateToken, requireRole(['admin', 'organiser'], 'id'), patchEventStatus);
router.delete('/:id', authenticateToken, requireRole(['admin', 'organiser'], 'id'), removeEvent);
router.post('/:id/gates', authenticateToken, requireRole(['admin', 'organiser', 'supervisor'], 'id'), addEventGate);
router.post('/:id/schedule-registrant', authenticateToken, requireRole(['admin', 'organiser'], 'id'), postScheduleFailedRegistrant);

// Analytics & Reports (Appendix C)
router.get('/:id/dashboard', authenticateToken, requireRole(['admin', 'organiser', 'supervisor', 'auditor'], 'id'), getDashboardAnalytics);
router.get('/:id/attendance-export', authenticateToken, requireRole(['admin', 'organiser', 'auditor'], 'id'), exportAttendanceReport);

export default router;
