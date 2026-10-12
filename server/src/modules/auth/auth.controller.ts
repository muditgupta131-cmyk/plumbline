import type { CookieOptions, Request, Response } from 'express';
import { isProduction } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import * as authService from './auth.service.js';
import { revokeSession, type IssuedTokens } from './token.service.js';

const REFRESH_COOKIE = 'iq_rt';

function cookieOptions(expires: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/auth',
    expires,
  };
}

function sessionContext(req: Request): authService.SessionContext {
  return {
    userAgent: req.get('user-agent') ?? undefined,
    ipAddress: req.ip,
  };
}

function setRefreshCookie(res: Response, tokens: IssuedTokens): void {
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(tokens.refreshExpiresAt));
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(new Date(0)), expires: undefined });
}

function respondWithSession(res: Response, result: authService.AuthResult, message: string, status = 200): void {
  setRefreshCookie(res, result.tokens);
  sendSuccess(
    res,
    {
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.accessExpiresIn,
    },
    message,
    status,
  );
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body, sessionContext(req));
  respondWithSession(res, result, 'Account created', 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body, sessionContext(req));
  respondWithSession(res, result, 'Signed in');
});

export const google = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.loginWithGoogle(req.body.credential, sessionContext(req));
  respondWithSession(res, result, 'Signed in with Google');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('No active session.');

  try {
    const result = await authService.refresh(token, sessionContext(req));
    respondWithSession(res, result, 'Session refreshed');
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) await revokeSession(token);
  clearRefreshCookie(res);
  sendSuccess(res, null, 'Signed out');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getProfile(req.auth!.userId);
  sendSuccess(res, user);
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.updateProfile(req.auth!.userId, req.body);
  sendSuccess(res, user, 'Profile updated');
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(req.auth!.userId, req.body);
  clearRefreshCookie(res);
  sendSuccess(res, null, 'Password changed. Sign in again on your other devices.');
});
