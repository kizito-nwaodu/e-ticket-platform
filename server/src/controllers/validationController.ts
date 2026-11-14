import { Request, Response } from 'express';
import { validateAndCheckIn, manualOverrideCheckIn } from '../services/validationService';
import prisma from '../config/db';

export async function postCheckIn(req: any, res: Response) {
  try {
    const { token, eventId, gateId, deviceInfo } = req.body;
    const operatorId = req.user?.userId;

    if (!token || !eventId) {
      return res.status(400).json({
        success: false,
        error: 'Both token and eventId are required for validation',
      });
    }

    // Sometimes the QR code contains JSON payload: { "type": "ETKT_V1", "token": "..." }
    let rawToken = token;
    try {
      const parsed = JSON.parse(token);
      if (parsed && parsed.token) {
        rawToken = parsed.token;
      }
    } catch {
      // plain string token
    }

    const result = await validateAndCheckIn({
      token: rawToken,
      eventId,
      gateId,
      operatorId,
      deviceInfo,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function postManualOverride(req: any, res: Response) {
  try {
    const { ticketId, eventId, gateId, reason } = req.body;
    const supervisorId = req.user?.userId;

    if (!ticketId || !eventId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'ticketId, eventId, and an explicit override reason are required',
      });
    }

    const result = await manualOverrideCheckIn({
      ticketId,
      eventId,
      supervisorId,
      gateId,
      reason,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function getRecentScans(req: Request, res: Response) {
  try {
    const eventId = req.query.eventId as string;
    const limit = parseInt(req.query.limit as string) || 15;

    const where: any = {};
    if (eventId) {
      where.eventId = eventId;
    }

    const scans = await prisma.scanAttempt.findMany({
      where,
      include: {
        ticket: {
          include: {
            registration: {
              include: { attendee: true },
            },
          },
        },
        gate: true,
        operator: {
          select: { displayName: true },
        },
      },
      orderBy: { scannedAt: 'desc' },
      take: limit,
    });

    res.json({ success: true, scans });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
