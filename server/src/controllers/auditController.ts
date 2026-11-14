import { Request, Response } from 'express';
import prisma from '../config/db';

export async function getAuditLogs(req: Request, res: Response) {
  try {
    const parsedLimit = parseInt(req.query.limit as string, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;
    const action = req.query.action as string | undefined;

    const where: any = {};
    if (action) {
      where.action = action;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: { occurredAt: 'desc' },
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ success: true, logs, total });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
