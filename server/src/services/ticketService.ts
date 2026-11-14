import prisma from '../config/db';
import { generateSecureToken, generateQrDataUrl } from './qrService';
import { generateTicketCode } from './codeService';
import { logAuditAction } from './auditService';

export async function issueTicketForRegistration(registrationId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true, attendee: true, ticketType: true },
  });

  if (!registration) {
    throw new Error('Registration not found');
  }

  // Generate opaque token and SHA-256 hash
  const { plainToken, tokenHash } = generateSecureToken();

  // Generate boarding-pass ticket code: EVT-XXX-XXX with Crockford Base32
  let ticketNumber = generateTicketCode(registration.event?.title);
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.ticket.findUnique({ where: { ticketNumber } });
    if (!exists) break;
    ticketNumber = generateTicketCode(registration.event?.title);
  }

  const validFrom = registration.event.startAt;
  const validTo = registration.event.endAt;

  const ticket = await prisma.ticket.create({
    data: {
      registrationId,
      ticketNumber,
      token: plainToken,
      tokenHash,
      status: 'active',
      validFrom,
      validTo,
    },
  });

  await logAuditAction(
    'TICKET_ISSUED',
    'Ticket',
    ticket.id,
    null,
    { registrationId, ticketNumber, attendeeEmail: registration.attendee.email }
  );

  return {
    ticket,
    plainToken,
  };
}

export async function getTicketDisplayData(ticketIdOrNumber: string) {
  const ticket = await prisma.ticket.findFirst({
    where: {
      OR: [{ id: ticketIdOrNumber }, { ticketNumber: ticketIdOrNumber }],
    },
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
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  return ticket;
}

export async function revokeTicket(ticketId: string, reason: string, actorId?: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'revoked',
      revocationReason: reason || 'Revoked by administrator',
    },
  });

  await logAuditAction(
    'TICKET_REVOKED',
    'Ticket',
    ticket.id,
    actorId,
    { reason, ticketNumber: ticket.ticketNumber }
  );

  return updated;
}

export async function reissueTicket(ticketId: string, reason: string, actorId?: string) {
  return await prisma.$transaction(async (tx) => {
    const oldTicket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: { registration: { include: { event: true } } },
    });

    if (!oldTicket) {
      throw new Error('Ticket not found');
    }

    // Revoke old ticket
    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'revoked',
        revocationReason: `Superceded by reissue: ${reason}`,
      },
    });

    // Create new ticket
    const { plainToken, tokenHash } = generateSecureToken();
    // Generate fresh boarding-pass ticket code: EVT-XXX-XXX
    let newTicketNumber = generateTicketCode(oldTicket.registration.event?.title);
    for (let i = 0; i < 5; i++) {
      const exists = await tx.ticket.findUnique({ where: { ticketNumber: newTicketNumber } });
      if (!exists) break;
      newTicketNumber = generateTicketCode(oldTicket.registration.event?.title);
    }

    const newTicket = await tx.ticket.create({
      data: {
        registrationId: oldTicket.registrationId,
        ticketNumber: newTicketNumber,
        token: plainToken,
        tokenHash,
        status: 'active',
        validFrom: oldTicket.validFrom,
        validTo: oldTicket.validTo,
      },
    });

    await logAuditAction(
      'TICKET_REISSUED',
      'Ticket',
      newTicket.id,
      actorId,
      {
        previousTicketId: oldTicket.id,
        previousTicketNumber: oldTicket.ticketNumber,
        newTicketNumber,
        reason,
      }
    );

    return {
      newTicket,
      plainToken,
    };
  });
}
