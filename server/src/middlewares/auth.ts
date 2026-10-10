import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export const readSessionToken = (req: Pick<Request, 'headers'>): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim() || null;
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map((part) => {
    const [name, ...rest] = part.trim().split('=');
    try { return [name, decodeURIComponent(rest.join('='))]; }
    catch { return [name, '']; }
  }).filter(([name]) => name));
  return cookies[config.cookieName] || null;
};

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const token = readSessionToken(req);

    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication token missing' });
      return;
    }

    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as {
      id: string;
      kind?: string;
      email: string;
      role: string;
      name: string;
      sessionVersion: number;
    };

    if (decoded.kind === 'customer' || typeof decoded.id !== 'string' || !Number.isInteger(decoded.sessionVersion)) throw new Error('Invalid staff session');
    res.setHeader('Cache-Control', 'no-store');
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true, status: true, sessionVersion: true },
    });

    if (!user || user.status !== 'ACTIVE' || user.sessionVersion !== decoded.sessionVersion) {
      res.status(403).json({ success: false, message: 'Account not active or invalid' });
      return;
    }

    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (req.user.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this operation',
      });
      return;
    }

    next();
  };
};
