import prisma from '../config/db';

export async function logAuditAction(
  action: string,
  targetType: string,
  targetId: string,
  actorId?: string | null,
  metadata?: Record<string, any>
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        targetType,
        targetId,
        actorId: actorId || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (err) {
    console.error('Failed to create audit log entry:', err);
  }
}
