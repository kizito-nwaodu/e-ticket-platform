import { Request, Response } from 'express';
import { getTicketDisplayData, revokeTicket, reissueTicket } from '../services/ticketService';
import { generateQrDataUrl } from '../services/qrService';
import prisma from '../config/db';

export async function getTicket(req: Request, res: Response) {
  try {
    const ticket = await getTicketDisplayData(req.params.id);
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message });
  }
}

export async function postRevokeTicket(req: any, res: Response) {
  try {
    const actorId = req.user?.userId;
    const { reason } = req.body;
    const ticket = await revokeTicket(req.params.id, reason, actorId);
    res.json({ success: true, message: 'Ticket revoked successfully', ticket });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function postReissueTicket(req: any, res: Response) {
  try {
    const actorId = req.user?.userId;
    const { reason } = req.body;
    const result = await reissueTicket(req.params.id, reason, actorId);
    const qrDataUrl = await generateQrDataUrl(result.plainToken);

    res.json({
      success: true,
      message: 'Ticket reissued successfully with new security token',
      ticket: result.newTicket,
      plainToken: result.plainToken,
      qrDataUrl,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function searchTickets(req: Request, res: Response) {
  try {
    const eventId = req.query.eventId as string;
    const query = (req.query.q as string || '').trim().toLowerCase();

    if (!eventId) {
      return res.status(400).json({ success: false, error: 'eventId query parameter is required' });
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        registration: {
          eventId,
          OR: [
            { reference: { contains: query } },
            { attendee: { fullName: { contains: query } } },
            { attendee: { email: { contains: query } } },
            { attendee: { phone: { contains: query } } },
          ],
        },
      },
      include: {
        registration: {
          include: { attendee: true, ticketType: true, event: true },
        },
        checkIn: true,
      },
      take: 20,
    });

    res.json({ success: true, tickets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
