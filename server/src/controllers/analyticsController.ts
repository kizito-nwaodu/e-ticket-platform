import { Request, Response } from 'express';
import { getEventAnalytics } from '../services/analyticsService';
import prisma from '../config/db';
import { logAuditAction } from '../services/auditService';

export async function getDashboardAnalytics(req: Request, res: Response) {
  try {
    const analytics = await getEventAnalytics(req.params.id);
    res.json({ success: true, data: analytics });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message });
  }
}

export async function exportAttendanceReport(req: any, res: Response) {
  try {
    const eventId = req.params.id;
    const actorId = req.user?.userId;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const checkIns = await prisma.checkIn.findMany({
      where: { eventId },
      include: {
        ticket: {
          include: {
            registration: {
              include: {
                attendee: true,
                ticketType: true,
              },
            },
          },
        },
        gate: true,
        operator: { select: { displayName: true } },
      },
      orderBy: { checkedInAt: 'asc' },
    });

    // Generate CSV data
    const headers = [
      'Ticket Number',
      'Attendee Full Name',
      'Email',
      'Phone',
      'Ticket Type',
      'Checked-In Timestamp (UTC)',
      'Gate',
      'Admitted By Operator',
      'Admission Method',
      'Override Reason',
    ];

    const rows = checkIns.map((ci) => {
      const reg = ci.ticket.registration;
      return [
        `"${ci.ticket.ticketNumber}"`,
        `"${reg.attendee.fullName.replace(/"/g, '""')}"`,
        `"${reg.attendee.email}"`,
        `"${reg.attendee.phone || 'N/A'}"`,
        `"${reg.ticketType.name}"`,
        `"${ci.checkedInAt.toISOString()}"`,
        `"${ci.gate ? ci.gate.name : 'Default Gate'}"`,
        `"${ci.operator ? ci.operator.displayName : 'Scanner Station'}"`,
        `"${ci.isManualOverride ? 'Manual Supervisor Override' : 'QR Scan'}"`,
        `"${ci.overrideReason ? ci.overrideReason.replace(/"/g, '""') : 'N/A'}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    await logAuditAction('REPORT_EXPORTED', 'Event', eventId, actorId, {
      recordCount: checkIns.length,
      eventTitle: event.title,
      format: 'CSV',
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance_report_${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv"`
    );
    res.status(200).send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
