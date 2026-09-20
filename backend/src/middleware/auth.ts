import type { NextFunction, Request, Response } from 'express';
import { AUTH_COOKIE_NAME, verifyToken } from '../services/authService.js';
import type { UserRole } from '../types/user.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: number; role: UserRole };
    }
  }
}

/** Reads the session cookie, if present and valid, and attaches the identity to the request. */
export function attachUser(request: Request, _response: Response, next: NextFunction): void {
  const token = request.cookies?.[AUTH_COOKIE_NAME];
  if (typeof token === 'string' && token) {
    try {
      const payload = verifyToken(token);
      request.auth = { userId: payload.sub, role: payload.role };
    } catch {
      // Invalid or expired token; the request continues unauthenticated.
    }
  }
  next();
}

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  if (!request.auth) {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } });
    return;
  }
  next();
}

export function requireAdmin(request: Request, response: Response, next: NextFunction): void {
  if (!request.auth) {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } });
    return;
  }
  if (request.auth.role !== 'admin') {
    response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access is required.' } });
    return;
  }
  next();
}
