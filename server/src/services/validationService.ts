import prisma from '../config/db';
import { hashToken } from './qrService';
import { logAuditAction } from './auditService';

export interface ValidationRequest {
  token: string;
  eventId: string;
  gateId?: string;
  operatorId?: string;
  deviceInfo?: string;
}

export interface ValidationResponse {
  outcome: 'admit' | 'already_used' | 'wrong_event' | 'revoked' | 'expired' | 'not_found' | 'review';
  message: string;
  ticketId?: string;
  ticketNumber?: string;
  attendeeName?: string;
  ticketTypeName?: string;
  eventName?: string;
  checkedInAt?: string;
  scanAttemptId?: string;
}

export async function validateAndCheckIn(params: ValidationRequest): Promise<ValidationResponse> {
  const { token, eventId, gateId, operatorId } = params;
  const rawInput = token.trim();
  const tokenHash = hashToken(rawInput);

  // Normalize code for hyphen-agnostic/case-insensitive ticketCode matching
  const cleanCode = rawInput.toUpperCase().replace(/[\s\-_]/g, '');

  // Use a database transaction to ensure atomic validation and check-in
  return await prisma.$transaction(async (tx) => {
    // 1. Look up ticket by unique tokenHash OR by ticketNumber (allowing hyphen-agnostic matches)
    let ticket = await tx.ticket.findUnique({
      where: { tokenHash },
      include: {
        registration: {
          include: {
            attendee: true,
            ticketType: true,
            event: true,
          },
        },
        checkIn: true,
      },
    });

    if (!ticket) {
      // Check direct ticketNumber match
      ticket = await tx.ticket.findFirst({
        where: {
          OR: [
            { ticketNumber: rawInput },
            { ticketNumber: rawInput.toUpperCase() },
          ],
        },
        include: {
          registration: {
            include: {
              attendee: true,
              ticketType: true,
              event: true,
            },
          },
          checkIn: true,
        },
      });
    }

    if (!ticket && cleanCode.length >= 6) {
      // Hyphen-free match on ticketNumber e.g. ICN9X7P4W matches ICN-9X7-P4W
      const candidates = await tx.ticket.findMany({
        where: {
          registration: { eventId },
        },
        include: {
          registration: {
            include: {
              attendee: true,
              ticketType: true,
              event: true,
            },
          },
          checkIn: true,
        },
        take: 50,
      });

      const matched = candidates.find(
        (c) => c.ticketNumber.toUpperCase().replace(/[\s\-_]/g, '') === cleanCode
      );
      if (matched) {
        ticket = matched;
      }
    }

    // Case 1: Ticket not found
    if (!ticket) {
      const attempt = await tx.scanAttempt.create({
        data: {
          eventId,
          gateId: gateId || null,
          operatorId: operatorId || null,
          tokenHashPresented: tokenHash,
          outcome: 'not_found',
          notes: 'Unrecognized token presented at gate',
        },
      });

      return {
        outcome: 'not_found',
        message: 'Invalid ticket code: No matching ticket found in database.',
        scanAttemptId: attempt.id,
      };
    }

    const reg = ticket.registration;

    // Case 2: Wrong event
    if (reg.eventId !== eventId) {
      const attempt = await tx.scanAttempt.create({
        data: {
          ticketId: ticket.id,
          eventId,
          gateId: gateId || null,
          operatorId: operatorId || null,
          tokenHashPresented: tokenHash,
          outcome: 'wrong_event',
          notes: `Ticket belongs to event '${reg.event.title}' (${reg.eventId}) but scanned at event ${eventId}`,
        },
      });

      return {
        outcome: 'wrong_event',
        message: `Ticket belongs to another event: "${reg.event.title}". Admission denied.`,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        attendeeName: reg.attendee.fullName,
        eventName: reg.event.title,
        scanAttemptId: attempt.id,
      };
    }

    // Case 3: Revoked
    if (ticket.status === 'revoked') {
      const attempt = await tx.scanAttempt.create({
        data: {
          ticketId: ticket.id,
          eventId,
          gateId: gateId || null,
          operatorId: operatorId || null,
          tokenHashPresented: tokenHash,
          outcome: 'revoked',
          notes: ticket.revocationReason || 'Ticket was previously revoked',
        },
      });

      return {
        outcome: 'revoked',
        message: `Ticket is REVOKED. Reason: ${ticket.revocationReason || 'Revoked by organiser'}.`,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        attendeeName: reg.attendee.fullName,
        scanAttemptId: attempt.id,
      };
    }

    // Case 4: Already used (CheckIn already exists or status is used)
    if (ticket.checkIn || ticket.status === 'used') {
      const priorTime = ticket.checkIn ? ticket.checkIn.checkedInAt.toISOString() : 'previously';
      const attempt = await tx.scanAttempt.create({
        data: {
          ticketId: ticket.id,
          eventId,
          gateId: gateId || null,
          operatorId: operatorId || null,
          tokenHashPresented: tokenHash,
          outcome: 'already_used',
          notes: `Replay detected. Already admitted at ${priorTime}`,
        },
      });

      return {
        outcome: 'already_used',
        message: `ALREADY USED: This ticket was already admitted at ${priorTime}.`,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        attendeeName: reg.attendee.fullName,
        checkedInAt: priorTime,
        scanAttemptId: attempt.id,
      };
    }

    // Case 5: Expired
    const now = new Date();
    if (ticket.status === 'expired' || now > ticket.validTo) {
      const attempt = await tx.scanAttempt.create({
        data: {
          ticketId: ticket.id,
          eventId,
          gateId: gateId || null,
          operatorId: operatorId || null,
          tokenHashPresented: tokenHash,
          outcome: 'expired',
          notes: `Expired on ${ticket.validTo.toISOString()}`,
        },
      });

      return {
        outcome: 'expired',
        message: 'Ticket has EXPIRED. Validity period ended.',
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        attendeeName: reg.attendee.fullName,
        scanAttemptId: attempt.id,
      };
    }

    // Case 6: Review (non-active status)
    if (ticket.status !== 'active') {
      const attempt = await tx.scanAttempt.create({
        data: {
          ticketId: ticket.id,
          eventId,
          gateId: gateId || null,
          operatorId: operatorId || null,
          tokenHashPresented: tokenHash,
          outcome: 'review',
          notes: `Ticket status is ${ticket.status}`,
        },
      });

      return {
        outcome: 'review',
        message: `Ticket status is '${ticket.status}'. Please refer attendee to Gate Supervisor.`,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        attendeeName: reg.attendee.fullName,
        scanAttemptId: attempt.id,
      };
    }

    // Case 7: ELIGIBLE -> ATOMIC ADMISSION
    // Create CheckIn record (guaranteed unique by unique constraint on ticketId)
    const checkIn = await tx.checkIn.create({
      data: {
        ticketId: ticket.id,
        eventId,
        gateId: gateId || null,
        operatorId: operatorId || null,
        checkedInAt: now,
        isManualOverride: false,
      },
    });

    // Update ticket status to 'used'
    await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: 'used' },
    });

    // Record accepted ScanAttempt
    const attempt = await tx.scanAttempt.create({
      data: {
        ticketId: ticket.id,
        eventId,
        gateId: gateId || null,
        operatorId: operatorId || null,
        tokenHashPresented: tokenHash,
        outcome: 'admit',
        notes: 'Admitted successfully',
      },
    });

    return {
      outcome: 'admit',
      message: 'ADMIT: Ticket verified successfully. Welcome!',
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      attendeeName: reg.attendee.fullName,
      ticketTypeName: reg.ticketType.name,
      eventName: reg.event.title,
      checkedInAt: checkIn.checkedInAt.toISOString(),
      scanAttemptId: attempt.id,
    };
  });
}

/**
 * Manual override admission by Gate Supervisor (FR-08)
 */
export async function manualOverrideCheckIn(params: {
  ticketId: string;
  eventId: string;
  supervisorId: string;
  gateId?: string;
  reason: string;
}): Promise<ValidationResponse> {
  const { ticketId, eventId, supervisorId, gateId, reason } = params;

  if (!reason || reason.trim().length < 5) {
    throw new Error('A detailed reason is required for manual admission override');
  }

  const { checkIn, ticket } = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: {
        registration: {
          include: { attendee: true, ticketType: true, event: true },
        },
        checkIn: true,
      },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.registration.eventId !== eventId) {
      throw new Error('Ticket belongs to a different event');
    }

    if (ticket.checkIn) {
      throw new Error(`Ticket is already checked in at ${ticket.checkIn.checkedInAt.toISOString()}`);
    }

    const checkIn = await tx.checkIn.create({
      data: {
        ticketId: ticket.id,
        eventId,
        gateId: gateId || null,
        operatorId: supervisorId,
        isManualOverride: true,
        overrideReason: reason.trim(),
      },
    });

    await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: 'used' },
    });

    await tx.scanAttempt.create({
      data: {
        ticketId: ticket.id,
        eventId,
        gateId: gateId || null,
        operatorId: supervisorId,
        tokenHashPresented: ticket.tokenHash,
        outcome: 'admit',
        notes: `Manual supervisor override: ${reason}`,
      },
    });

    return {
      checkIn,
      ticket,
    };
  });

  await logAuditAction(
    'MANUAL_CHECKIN_OVERRIDE',
    'Ticket',
    ticket.id,
    supervisorId,
    { reason, gateId, eventId, ticketNumber: ticket.ticketNumber }
  );

  return {
    outcome: 'admit',
    message: 'MANUAL OVERRIDE APPROVED: Attendee admitted with recorded audit trail.',
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    attendeeName: ticket.registration.attendee.fullName,
    ticketTypeName: ticket.registration.ticketType.name,
    eventName: ticket.registration.event.title,
    checkedInAt: checkIn.checkedInAt.toISOString(),
  };
}
