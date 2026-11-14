import prisma from '../config/db';
import { issueTicketForRegistration } from './ticketService';
import { generateQrDataUrl } from './qrService';
import { generateRegistrationCode } from './codeService';
import { logAuditAction } from './auditService';

export interface RegistrationInput {
  eventId: string;
  fullName: string;
  email: string;
  phone?: string;
  ticketTypeId?: string;
  privacyConsent: boolean;
}

export async function createRegistration(input: RegistrationInput) {
  const { eventId, fullName, email, phone, ticketTypeId, privacyConsent } = input;

  // 1. NDPA 2023 Statutory Privacy Notice Check
  if (!privacyConsent) {
    throw new Error('You must acknowledge and accept the privacy notice in compliance with the Nigeria Data Protection Act (NDPA 2023).');
  }

  // 2. Validate Event
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      ticketTypes: true,
      _count: {
        select: {
          registrations: { where: { status: 'approved' } },
        },
      },
    },
  });

  if (!event) {
    throw new Error('Event does not exist');
  }

  if (event.endAt && new Date(event.endAt) < new Date()) {
    throw new Error('This event has already concluded. Operator-assisted registrations are closed.');
  }

  if (event.status !== 'published') {
    throw new Error(`Event is currently ${event.status}. Registrations are not accepted.`);
  }

  if (event.endAt && new Date(event.endAt) < new Date()) {
    throw new Error('This event has already concluded. Registrations are closed.');
  }

  // 3. Capacity Check
  const currentCount = event._count.registrations;
  if (currentCount >= event.capacity) {
    throw new Error('Event registration has reached maximum capacity.');
  }

  // Determine Ticket Type
  let targetTicketTypeId = ticketTypeId;
  if (!targetTicketTypeId && event.ticketTypes.length > 0) {
    targetTicketTypeId = event.ticketTypes[0].id;
  }

  if (!targetTicketTypeId) {
    throw new Error('No ticket type available for this event.');
  }

  // 4. Statutory Rule: Registrant must have a registered UserAccount
  const cleanEmail = email.trim().toLowerCase();
  const userAccount = await prisma.userAccount.findUnique({
    where: { email: cleanEmail },
  });

  if (!userAccount) {
    throw new Error('Account registration required. You must complete account registration before registering for an event pass.');
  }

  // 5. Duplicate Check: same attendee email already registered for this event
  const existingAttendee = await prisma.attendee.findFirst({
    where: { email: cleanEmail },
    include: {
      registrations: {
        where: { eventId, status: { in: ['approved', 'pending'] } },
      },
    },
  });

  if (existingAttendee && existingAttendee.registrations.length > 0) {
    throw new Error('A registration under this email address already exists for this event.');
  }

  // 6. Transaction: Create Attendee + Registration + Ticket
  const result = await prisma.$transaction(async (tx) => {
    let attendee = existingAttendee;
    if (!attendee) {
      attendee = await tx.attendee.create({
        data: {
          fullName: fullName.trim(),
          email: cleanEmail,
          phone: phone ? phone.trim() : null,
          privacyConsent: true,
        },
        include: { registrations: true },
      });
    }

    let reference = generateRegistrationCode();
    for (let i = 0; i < 5; i++) {
      const exists = await tx.registration.findUnique({ where: { reference } });
      if (!exists) break;
      reference = generateRegistrationCode();
    }

    const registration = await tx.registration.create({
      data: {
        eventId,
        attendeeId: attendee.id,
        ticketTypeId: targetTicketTypeId,
        status: 'approved',
        reference,
      },
      include: {
        event: true,
        attendee: true,
        ticketType: true,
      },
    });

    // Create delivery notification record
    await tx.notification.create({
      data: {
        registrationId: registration.id,
        channel: 'web',
        template: 'TICKET_DELIVERY_CONFIRMATION',
        status: 'sent',
      },
    });

    return registration;
  });

  // Issue Ticket
  const ticketResult = await issueTicketForRegistration(result.id);
  const qrDataUrl = await generateQrDataUrl(ticketResult.plainToken);

  await logAuditAction('REGISTRATION_CREATED', 'Registration', result.id, null, {
    reference: result.reference,
    attendeeEmail: result.attendee.email,
    eventId: result.eventId,
  });

  return {
    registration: result,
    ticket: ticketResult.ticket,
    plainToken: ticketResult.plainToken,
    qrDataUrl,
  };
}

export async function scheduleFailedRegistrant(input: {
  eventId: string;
  fullName: string;
  email: string;
  phone?: string;
  ticketTypeId?: string;
  reason?: string;
  actorId: string;
  actorEmail: string;
}) {
  const { eventId, fullName, email, phone, ticketTypeId, reason, actorId, actorEmail } = input;

  const cleanEmail = email.trim().toLowerCase();
  const cleanActorEmail = (actorEmail || '').trim().toLowerCase();

  // STRICT ANTI-SELF-DEALING RULE: Organisers cannot schedule tickets for themselves!
  if (cleanActorEmail && cleanEmail === cleanActorEmail) {
    throw new Error('Organisers are prohibited from scheduling or issuing event tickets to themselves. Self-booking through management consoles violates institutional separation of duties.');
  }

  // Check event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { ticketTypes: true },
  });

  if (!event) {
    throw new Error('Event does not exist');
  }

  if (event.endAt && new Date(event.endAt) < new Date()) {
    throw new Error('This event has already concluded. Operator-assisted registrations are closed.');
  }

  // Determine Ticket Type
  let targetTicketTypeId = ticketTypeId;
  if (!targetTicketTypeId && event.ticketTypes.length > 0) {
    targetTicketTypeId = event.ticketTypes[0].id;
  }

  // Find or create attendee
  let attendee = await prisma.attendee.findFirst({
    where: { email: cleanEmail },
  });

  if (!attendee) {
    attendee = await prisma.attendee.create({
      data: {
        fullName: fullName.trim(),
        email: cleanEmail,
        phone: phone ? phone.trim() : null,
        privacyConsent: true,
      },
    });
  }

  // Check if they already have an approved registration
  const existingReg = await prisma.registration.findFirst({
    where: { eventId, attendeeId: attendee.id, status: 'approved' },
  });

  if (existingReg) {
    throw new Error(`Delegate '${cleanEmail}' already holds an active registration (${existingReg.reference}) for this event.`);
  }

  let reference = generateRegistrationCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.registration.findUnique({ where: { reference } });
    if (!exists) break;
    reference = generateRegistrationCode();
  }

  const registration = await prisma.registration.create({
    data: {
      eventId,
      attendeeId: attendee.id,
      ticketTypeId: targetTicketTypeId!,
      reference,
      status: 'approved',
    },
    include: { attendee: true, event: true, ticketType: true },
  });

  // Issue active ticket with ISO/IEC 18004 token
  const ticketResult = await issueTicketForRegistration(registration.id);
  const qrDataUrl = await generateQrDataUrl(ticketResult.plainToken);

  // Log audit action with reason and actor
  await logAuditAction('FAILED_REGISTRANT_ASSISTED', 'Registration', registration.id, actorId, {
    registrantEmail: cleanEmail,
    registrantName: fullName.trim(),
    ticketNumber: ticketResult.ticket.ticketNumber,
    reference: registration.reference,
    reason: reason || 'Organiser manual schedule for failed online registration',
    scheduledByOrganiserEmail: cleanActorEmail,
  });

  return {
    registration,
    ticket: ticketResult.ticket,
    plainToken: ticketResult.plainToken,
    qrDataUrl,
  };
}

export async function getRegistrationByReference(reference: string) {
  const reg = await prisma.registration.findUnique({
    where: { reference },
    include: {
      event: true,
      attendee: true,
      ticketType: true,
      tickets: {
        include: { checkIn: true },
        orderBy: { issuedAt: 'desc' },
      },
    },
  });

  if (!reg) {
    throw new Error('Registration not found');
  }

  return reg;
}
