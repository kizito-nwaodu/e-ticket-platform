import { Request, Response } from 'express';
import { createRegistration, getRegistrationByReference, scheduleFailedRegistrant } from '../services/registrationService';
import prisma from '../config/db';
import { generateQrDataUrl } from '../services/qrService';

export async function registerAttendee(req: any, res: Response) {
  try {
    const eventId = req.params.id;
    const actor = req.user;
    const { fullName, email, phone, ticketTypeId, privacyConsent } = req.body;

    if (actor) {
      const roles = (actor.roles || []).map((r: any) => r.role);
      const isOpsUser = roles.some((role: string) => role !== 'attendee');
      const hasRegistrationRights = roles.some((role: string) => role === 'admin' || role === 'organiser');

      if (isOpsUser && !hasRegistrationRights) {
        return res.status(403).json({
          success: false,
          error: 'Your operational role does not have event registration rights.',
        });
      }

      if (isOpsUser && actor.email && email && actor.email.toLowerCase() === email.trim().toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Operations staff cannot self-register as a delegate. Use an attendee account or register an attendee on their behalf.',
        });
      }
    }

    const result = await createRegistration({
      eventId,
      fullName,
      email,
      phone,
      ticketTypeId,
      privacyConsent: Boolean(privacyConsent),
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Digital ticket has been issued.',
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function getRegistration(req: Request, res: Response) {
  try {
    const reg = await getRegistrationByReference(req.params.reference);
    res.json({ success: true, registration: reg });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message });
  }
}

export async function getRegistrationTicket(req: Request, res: Response) {
  try {
    const registrationId = req.params.id;
    const ticket = await prisma.ticket.findFirst({
      where: { registrationId },
      include: {
        registration: {
          include: {
            attendee: true,
            event: true,
            ticketType: true,
          },
        },
        checkIn: true,
      },
      orderBy: { issuedAt: 'desc' },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found for registration' });
    }

    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMyRegistrations(req: any, res: Response) {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const attendee = await prisma.attendee.findFirst({
      where: { email: userEmail.toLowerCase() },
      include: {
        registrations: {
          include: {
            attendee: true,
            event: {
              include: { gates: true },
            },
            ticketType: true,
            tickets: {
              include: { checkIn: { include: { gate: true } } },
              orderBy: { issuedAt: 'desc' },
            },
          },
          orderBy: { registeredAt: 'desc' },
        },
      },
    });

    res.json({
      success: true,
      attendee,
      registrations: attendee?.registrations || [],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function postScheduleFailedRegistrant(req: any, res: Response) {
  try {
    const eventId = req.params.id;
    const actorId = req.user?.userId;
    const actorEmail = req.user?.email;
    const { fullName, email, phone, ticketTypeId, reason } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({ success: false, error: 'Full legal name and delegate email are required.' });
    }

    if (actorEmail && actorEmail.toLowerCase() === email.trim().toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Self-registration is disabled. Authorized operators may only register attendees on their behalf.',
      });
    }

    const result = await scheduleFailedRegistrant({
      eventId,
      fullName,
      email,
      phone,
      ticketTypeId,
      reason,
      actorId,
      actorEmail,
    });

    res.status(201).json({
      success: true,
      message: `Failed registrant '${fullName}' successfully scheduled and active ticket issued.`,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}
