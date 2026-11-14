import prisma from '../config/db';

export async function getEventAnalytics(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      gates: true,
      ticketTypes: true,
    },
  });

  if (!event) {
    throw new Error('Event not found');
  }

  // 1. Registration counts
  const totalRegistrations = await prisma.registration.count({ where: { eventId } });
  const approvedRegistrations = await prisma.registration.count({
    where: { eventId, status: 'approved' },
  });
  const pendingRegistrations = await prisma.registration.count({
    where: { eventId, status: 'pending' },
  });
  const cancelledRegistrations = await prisma.registration.count({
    where: { eventId, status: 'cancelled' },
  });

  // 2. Ticket breakdown
  const tickets = await prisma.ticket.findMany({
    where: {
      registration: { eventId },
    },
    select: { status: true },
  });

  const ticketsIssued = tickets.length;
  const activeTickets = tickets.filter((t) => t.status === 'active').length;
  const usedTickets = tickets.filter((t) => t.status === 'used').length;
  const revokedTickets = tickets.filter((t) => t.status === 'revoked').length;
  const expiredTickets = tickets.filter((t) => t.status === 'expired').length;

  // 3. Check-in counts (authoritative unique admissions)
  const checkedInAttendees = await prisma.checkIn.count({ where: { eventId } });
  const manualOverrides = await prisma.checkIn.count({
    where: { eventId, isManualOverride: true },
  });

  // 4. Calculations (lines 617-620 in report)
  const attendanceRate =
    approvedRegistrations > 0
      ? Number(((checkedInAttendees / approvedRegistrations) * 100).toFixed(1))
      : 0;

  const noShowCount = Math.max(0, approvedRegistrations - checkedInAttendees);
  const noShowRate =
    approvedRegistrations > 0
      ? Number(((noShowCount / approvedRegistrations) * 100).toFixed(1))
      : 0;

  // 5. Scan attempts & Outcomes breakdown
  const scanAttempts = await prisma.scanAttempt.findMany({
    where: { eventId },
    include: { gate: true },
  });

  const totalScans = scanAttempts.length;
  const outcomeCounts: Record<string, number> = {
    admit: 0,
    already_used: 0,
    wrong_event: 0,
    revoked: 0,
    expired: 0,
    not_found: 0,
    review: 0,
  };

  scanAttempts.forEach((s) => {
    if (outcomeCounts[s.outcome] !== undefined) {
      outcomeCounts[s.outcome]++;
    } else {
      outcomeCounts[s.outcome] = 1;
    }
  });

  // 6. Gate Activity breakdown
  const gateStats = event.gates.map((gate) => {
    const gateScans = scanAttempts.filter((s) => s.gateId === gate.id);
    const admits = gateScans.filter((s) => s.outcome === 'admit').length;
    const rejects = gateScans.filter((s) => s.outcome !== 'admit').length;
    return {
      gateId: gate.id,
      gateName: gate.name,
      status: gate.status,
      totalScans: gateScans.length,
      admitted: admits,
      rejected: rejects,
    };
  });

  // Include unassigned gate scans if any
  const unassignedScans = scanAttempts.filter((s) => !s.gateId);
  if (unassignedScans.length > 0) {
    gateStats.push({
      gateId: 'unassigned',
      gateName: 'Default / Mobile App Gate',
      status: 'open',
      totalScans: unassignedScans.length,
      admitted: unassignedScans.filter((s) => s.outcome === 'admit').length,
      rejected: unassignedScans.filter((s) => s.outcome !== 'admit').length,
    });
  }

  // 7. Arrival Velocity / Check-ins by time interval
  const allCheckIns = await prisma.checkIn.findMany({
    where: { eventId },
    select: { checkedInAt: true },
    orderBy: { checkedInAt: 'asc' },
  });

  // Bucket check-ins by 15-minute intervals
  const intervalMap: Record<string, number> = {};
  allCheckIns.forEach((ci) => {
    const date = new Date(ci.checkedInAt);
    const minutes = Math.floor(date.getMinutes() / 15) * 15;
    date.setMinutes(minutes, 0, 0);
    const timeKey = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    intervalMap[timeKey] = (intervalMap[timeKey] || 0) + 1;
  });

  const arrivalVelocity = Object.entries(intervalMap).map(([time, count]) => ({
    time,
    checkIns: count,
  }));

  return {
    eventId: event.id,
    eventTitle: event.title,
    venue: event.venue,
    capacity: event.capacity,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    summary: {
      totalRegistrations,
      approvedRegistrations,
      pendingRegistrations,
      cancelledRegistrations,
      ticketsIssued,
      activeTickets,
      usedTickets,
      revokedTickets,
      expiredTickets,
      checkedInAttendees,
      attendanceRate,
      noShowCount,
      noShowRate,
      manualOverrides,
      repeatScanAttempts: outcomeCounts.already_used || 0,
      totalScans,
    },
    outcomes: outcomeCounts,
    gateStats,
    arrivalVelocity,
  };
}
