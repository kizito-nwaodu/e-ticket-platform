import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'etickets_pgdi720_jwt_secret_key_super_secure_2026';

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  roles: {
    role: string;
    eventId?: string | null;
    organizationId?: string | null;
  }[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication token required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    const user = await prisma.userAccount.findUnique({
      where: { id: payload.userId },
      include: { roleAssignments: true }
    });

    if (!user || user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'User account inactive or not found' });
    }

    req.user = {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roleAssignments.map(ra => ({
        role: ra.role,
        eventId: ra.eventId,
        organizationId: ra.organizationId
      }))
    };

    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
}

export async function optionalAuthenticateToken(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    const user = await prisma.userAccount.findUnique({
      where: { id: payload.userId },
      include: { roleAssignments: true }
    });

    if (user && user.status === 'active') {
      req.user = {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: user.roleAssignments.map(ra => ({
          role: ra.role,
          eventId: ra.eventId,
          organizationId: ra.organizationId
        }))
      };
    }
  } catch {
    // Ignore invalid optional token and treat as unauthenticated
  }
  next();
}

export function requireRole(allowedRoles: string[], targetEventIdParam?: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Admin has global access
    const isAdmin = req.user.roles.some(r => r.role === 'admin');
    if (isAdmin) {
      return next();
    }

    const eventId = targetEventIdParam ? req.params[targetEventIdParam] || req.body.eventId : null;

    const hasRole = req.user.roles.some(r => {
      if (!allowedRoles.includes(r.role)) return false;
      // If event scope is specified, ensure user is assigned to this event or is global
      if (eventId && r.eventId && r.eventId !== eventId) {
        return false;
      }
      return true;
    });

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}
