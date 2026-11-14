import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { logAuditAction } from '../services/auditService';

const JWT_SECRET = process.env.JWT_SECRET || 'etickets_pgdi720_jwt_secret_key_super_secure_2026';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email address format' });
    }

    const user = await prisma.userAccount.findUnique({
      where: { email: cleanEmail },
      include: { roleAssignments: { include: { event: true } } },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAuditAction('USER_LOGIN', 'UserAccount', user.id, user.id, {
      email: user.email,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: user.roleAssignments.map((ra) => ({
          role: ra.role,
          eventId: ra.eventId,
          eventTitle: ra.event ? ra.event.title : null,
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getCurrentUser(req: any, res: Response) {
  try {
    const user = await prisma.userAccount.findUnique({
      where: { id: req.user.userId },
      include: { roleAssignments: { include: { event: true } } },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: user.roleAssignments.map((ra) => ({
          role: ra.role,
          eventId: ra.eventId,
          eventTitle: ra.event ? ra.event.title : null,
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function registerAttendeeAccount(req: Request, res: Response) {
  try {
    const { displayName, email, password, phone } = req.body;
    if (!displayName || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    // Check if user already exists
    const existing = await prisma.userAccount.findUnique({
      where: { email: cleanEmail },
    });
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists. Please sign in.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.userAccount.create({
      data: {
        email: cleanEmail,
        displayName: displayName.trim(),
        passwordHash,
        status: 'active',
        roleAssignments: {
          create: [{ role: 'attendee' }],
        },
      },
      include: { roleAssignments: true },
    });

    // Also ensure Attendee entity exists so existing tickets link up seamlessly
    const existingAttendee = await prisma.attendee.findFirst({
      where: { email: cleanEmail },
    });
    if (!existingAttendee) {
      await prisma.attendee.create({
        data: {
          fullName: displayName.trim(),
          email: cleanEmail,
          phone: phone ? phone.trim() : null,
          privacyConsent: true,
        },
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAuditAction('ATTENDEE_ACCOUNT_CREATED', 'UserAccount', user.id, user.id, {
      email: user.email,
      role: 'attendee',
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: [{ role: 'attendee' }],
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
