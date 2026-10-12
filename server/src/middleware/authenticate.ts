import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { isSessionActive, verifyAccessToken } from '../modules/auth/token.service.js';
import type { Role } from '../modules/auth/user.model.js';

function extractToken(req: Request): string | null {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized();

    const payload = verifyAccessToken(token);

    if (!(await isSessionActive(payload.sid))) {
      throw ApiError.unauthorized('This session was signed out. Sign in again.');
    }

    req.auth = { userId: payload.sub, role: payload.role, sessionId: payload.sid };
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    if (await isSessionActive(payload.sid)) {
      req.auth = { userId: payload.sub, role: payload.role, sessionId: payload.sid };
    }
  } catch {
    /* anonymous request */
  }

  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(ApiError.unauthorized());
    if (!roles.includes(req.auth.role)) return next(ApiError.forbidden());
    next();
  };
}
