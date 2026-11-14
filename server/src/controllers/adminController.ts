import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { logAuditAction } from '../services/auditService';

const ALLOWED_ROLES = [
  'admin',
  'organiser',
  'supervisor',
  'scanner_operator',
  'auditor',
  'attendee',
] as const;

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  createdAt: true,
  roleAssignments: {
    include: { event: { select: { id: true, title: true } } },
  },
  _count: {
    select: { checkIns: true, scanAttempts: true },
  },
};

export async function listAllUsers(req: Request, res: Response) {
  try {
    const users = await prisma.userAccount.findMany({
      select: USER_PUBLIC_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createUserWithRole(req: any, res: Response) {
  try {
    const actorId = req.user?.userId;
    const { displayName, email, password, role, eventId } = req.body;

    if (!displayName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'Full name, email, password, and assigned role are required',
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role '${role}'.`,
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existing = await prisma.userAccount.findUnique({
      where: { email: cleanEmail },
      select: { id: true },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `User account '${cleanEmail}' already exists. Use assign role instead.`,
      });
    }

    if (eventId) {
      const eventExists = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true },
      });
      if (!eventExists) {
        return res.status(404).json({ success: false, error: 'Selected event not found.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.userAccount.create({
      data: {
        email: cleanEmail,
        displayName: displayName.trim(),
        passwordHash,
        status: 'active',
        roleAssignments: {
          create: [
            {
              role,
              eventId: eventId || null,
            },
          ],
        },
      },
      select: USER_PUBLIC_SELECT,
    });

    await logAuditAction('USER_PROVISIONED', 'UserAccount', user.id, actorId, {
      assignedRole: role,
      eventId: eventId || 'global',
      email: user.email,
    });

    res.status(201).json({
      success: true,
      message: `User account '${user.displayName}' created with role '${role}'.`,
      user,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function assignUserRole(req: any, res: Response) {
  try {
    const actorId = req.user?.userId;
    const { userId, role, eventId } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ success: false, error: 'userId and role are required' });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, error: `Invalid role '${role}'.` });
    }

    const targetUser = await prisma.userAccount.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    const normalizedEventId = eventId || null;

    if (normalizedEventId) {
      const eventExists = await prisma.event.findUnique({
        where: { id: normalizedEventId },
        select: { id: true },
      });
      if (!eventExists) {
        return res.status(404).json({ success: false, error: 'Selected event not found.' });
      }
    }

    const duplicate = await prisma.roleAssignment.findFirst({
      where: {
        userId,
        role,
        eventId: normalizedEventId,
      },
      select: { id: true },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `User already has the '${role}' role for this scope.`,
      });
    }

    const assignment = await prisma.roleAssignment.create({
      data: {
        userId,
        role,
        eventId: normalizedEventId,
      },
      include: { event: { select: { id: true, title: true } } },
    });

    await logAuditAction('ROLE_ASSIGNED', 'RoleAssignment', assignment.id, actorId, {
      userId,
      role,
      eventId: normalizedEventId || 'global',
    });

    res.status(201).json({
      success: true,
      message: `Role '${role}' assigned successfully.`,
      assignment,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function addEventGate(req: any, res: Response) {
  try {
    const actorId = req.user?.userId;
    const eventId = req.params.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Gate name is required' });
    }

    const gate = await prisma.gate.create({
      data: {
        eventId,
        name: name.trim(),
        status: 'open',
      },
    });

    await logAuditAction('GATE_ADDED', 'Gate', gate.id, actorId, {
      eventId,
      gateName: gate.name,
    });

    res.status(201).json({
      success: true,
      message: `Gate '${gate.name}' added to event.`,
      gate,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteUserAccount(req: any, res: Response) {
  try {
    const actorId = req.user?.userId;
    const { id } = req.params;

    if (id === actorId) {
      return res.status(400).json({
        success: false,
        error: 'Administrators cannot delete their own active account session.',
      });
    }

    const existing = await prisma.userAccount.findUnique({
      where: { id },
      select: { id: true, email: true, displayName: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    // Delete role assignments and user account
    await prisma.$transaction([
      prisma.roleAssignment.deleteMany({ where: { userId: id } }),
      prisma.userAccount.delete({ where: { id } }),
    ]);

    await logAuditAction('USER_DELETED', 'UserAccount', id, actorId, {
      deletedEmail: existing.email,
      deletedDisplayName: existing.displayName,
      statutoryLegalBasis: 'NDPA_2023_DATA_SUBJECT_RIGHT_TO_ERASURE',
    });

    res.json({
      success: true,
      message: `User account '${existing.displayName}' (${existing.email}) successfully deleted.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
