import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { parseDuration } from '../../utils/duration.js';
import { ApiError } from '../../utils/ApiError.js';
import { Session, type SessionDocument } from './session.model.js';
import type { Role } from './user.model.js';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  sid: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresAt: Date;
}

interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

const REFRESH_TTL_MS = parseDuration(env.JWT_REFRESH_TTL);
const ACCESS_TTL_MS = parseDuration(env.JWT_ACCESS_TTL);

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
    issuer: 'investiq',
    audience: 'investiq-client',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'investiq',
      audience: 'investiq-client',
    }) as AccessTokenPayload;
  } catch {
    throw ApiError.unauthorized('Your session expired. Sign in again.');
  }
}

async function createSession(
  userId: Types.ObjectId,
  role: Role,
  familyId: string,
  context: SessionContext,
): Promise<IssuedTokens> {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  const session = await Session.create({
    user: userId,
    familyId,
    tokenHash: hashToken(refreshToken),
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
    expiresAt: refreshExpiresAt,
  });

  return {
    accessToken: signAccessToken({ sub: userId.toString(), role, sid: session._id.toString() }),
    refreshToken,
    accessExpiresIn: Math.floor(ACCESS_TTL_MS / 1000),
    refreshExpiresAt,
  };
}

export function issueTokens(userId: Types.ObjectId, role: Role, context: SessionContext): Promise<IssuedTokens> {
  return createSession(userId, role, crypto.randomUUID(), context);
}

export async function rotateTokens(
  refreshToken: string,
  context: SessionContext,
): Promise<{ tokens: IssuedTokens; userId: Types.ObjectId }> {
  const session = await Session.findOne({ tokenHash: hashToken(refreshToken) }).populate<{
    user: { _id: Types.ObjectId; role: Role };
  }>('user', 'role');

  if (!session) {
    throw ApiError.unauthorized('Your session is no longer valid. Sign in again.');
  }

  if (session.revokedAt) {
    await Session.updateMany(
      { familyId: session.familyId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: 'reuse-detected' } },
    );
    throw ApiError.unauthorized('This session was already used. For safety, sign in again.');
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw ApiError.unauthorized('Your session expired. Sign in again.');
  }

  if (!session.user) {
    throw ApiError.unauthorized('That account no longer exists.');
  }

  session.revokedAt = new Date();
  session.revokedReason = 'rotated';
  await session.save();

  const tokens = await createSession(session.user._id, session.user.role, session.familyId, context);
  return { tokens, userId: session.user._id };
}

export async function revokeSession(refreshToken: string): Promise<void> {
  await Session.updateOne(
    { tokenHash: hashToken(refreshToken), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: 'logout' } },
  );
}

export async function revokeAllSessions(
  userId: Types.ObjectId,
  reason: NonNullable<SessionDocument['revokedReason']>,
): Promise<void> {
  await Session.updateMany(
    { user: userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

export async function isSessionActive(sessionId: string): Promise<boolean> {
  const session = await Session.findById(sessionId).select('revokedAt expiresAt').lean();
  if (!session) return false;
  if (session.revokedAt) return false;
  return session.expiresAt.getTime() > Date.now();
}

export const refreshTtlMs = REFRESH_TTL_MS;
