import prisma from '../config/db';
import { logAuditAction } from './auditService';

export async function listEvents(statusFilter?: string) {
  const where: any = {};
  if (statusFilter) {
    where.status = statusFilter;
  }
  return await prisma.event.findMany({
    where,
    include: {
      ticketTypes: true,
      gates: true,
      _count: {
        select: {
          registrations: true,
          checkIns: true,
        },
      },
    },
    orderBy: { startAt: 'desc' },
  });
}

export async function getEventById(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      ticketTypes: true,
      gates: true,
      _count: {
        select: {
          registrations: true,
          checkIns: true,
        },
      },
    },
  });

  if (!event) {
    throw new Error('Event not found');
  }

  return event;
}

export async function createEvent(data: {
  title: string;
  description: string;
  venue: string;
  startAt: string;
  endAt: string;
  capacity: number;
  status?: string;
  ticketTypes?: { name: string; price: number; capacity: number }[];
  gates?: { name: string }[];
  actorId?: string;
}) {
  const { title, description, venue, startAt, endAt, capacity, status, ticketTypes, gates, actorId } = data;

  const event = await prisma.event.create({
    data: {
      title,
      description,
      venue,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      capacity: Number(capacity),
      status: status || 'published',
      ticketTypes: {
        create: ticketTypes && ticketTypes.length > 0 ? ticketTypes.map(tt => ({
          name: tt.name,
          price: tt.price || 0,
          capacity: tt.capacity || Number(capacity),
        })) : [
          { name: 'Standard Delegate', price: 0, capacity: Number(capacity) }
        ],
      },
      gates: {
        create: gates && gates.length > 0 ? gates.map(g => ({
          name: g.name,
          status: 'open',
        })) : [
          { name: 'Main Gate A', status: 'open' },
          { name: 'Side Gate B', status: 'open' },
        ],
      },
    },
    include: {
      ticketTypes: true,
      gates: true,
    },
  });

  await logAuditAction('EVENT_CREATED', 'Event', event.id, actorId, {
    title: event.title,
    capacity: event.capacity,
    status: event.status,
  });

  return event;
}

export async function updateEventStatus(eventId: string, newStatus: string, actorId?: string) {
  const event = await prisma.event.update({
    where: { id: eventId },
    data: { status: newStatus },
  });

  await logAuditAction('EVENT_STATUS_UPDATED', 'Event', event.id, actorId, {
    newStatus,
  });

  return event;
}

export async function deleteEvent(eventId: string, actorId?: string) {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, capacity: true },
  });

  if (!existing) {
    throw new Error('Event not found');
  }

  // Delete event (all cascade relations configured in Prisma schema)
  await prisma.event.delete({ where: { id: eventId } });

  await logAuditAction('EVENT_DELETED', 'Event', eventId, actorId, {
    title: existing.title,
    capacity: existing.capacity,
  });

  return { success: true, message: `Event '${existing.title}' deleted successfully.` };
}
