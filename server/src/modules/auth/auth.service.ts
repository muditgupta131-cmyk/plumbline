import type { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { MARKET_CURRENCY } from '../../types/market.js';
import { User, toPublicUser, type PublicUser, type UserDocument } from './user.model.js';
import { verifyGoogleCredential } from './google.service.js';
import { issueTokens, revokeAllSessions, rotateTokens, type IssuedTokens } from './token.service.js';
import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from './auth.schema.js';

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: IssuedTokens;
}

async function loadUser(userId: string | Types.ObjectId): Promise<UserDocument> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized('That account no longer exists.');
  return user;
}

export async function register(input: RegisterInput, context: SessionContext): Promise<AuthResult> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists. Sign in instead.');
  }

  const defaultMarket = input.defaultMarket ?? 'IN';

  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: input.password,
    providers: ['email'],
    lastLoginAt: new Date(),
    preferences: {
      defaultMarket,
      baseCurrency: input.baseCurrency ?? MARKET_CURRENCY[defaultMarket],
    },
  });

  const tokens = await issueTokens(user._id, user.role, context);
  return { user: toPublicUser(user), tokens };
}

export async function login(input: LoginInput, context: SessionContext): Promise<AuthResult> {
  const user = await User.findByEmail(input.email);
  const valid = user ? await user.comparePassword(input.password) : false;

  if (!user || !valid) {
    throw ApiError.unauthorized('That email and password combination does not match an account.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokens(user._id, user.role, context);
  return { user: toPublicUser(user), tokens };
}

export async function loginWithGoogle(credential: string, context: SessionContext): Promise<AuthResult> {
  const profile = await verifyGoogleCredential(credential);

  // Match on the Google subject first: it is the only identifier Google guarantees is stable and
  // unique. Email is a claim about an address, and Google only stands behind it once verified.
  let user = await User.findOne({ googleId: profile.googleId });

  if (!user) {
    const byEmail = await User.findOne({ email: profile.email });

    // Linking on email alone lets someone who controls an unverified Google address take over the
    // password account that already owns it. An unverified address may never claim one.
    if (byEmail && !profile.emailVerified) {
      throw ApiError.unauthorized(
        'Google has not verified this email address, so it cannot be linked to an existing Plumbline account. Sign in with your password instead.',
      );
    }

    user = byEmail;
  }

  if (!user) {
    user = await User.create({
      name: profile.name,
      email: profile.email,
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
      emailVerified: profile.emailVerified,
      providers: ['google'],
      lastLoginAt: new Date(),
    });
  } else {
    user.googleId ??= profile.googleId;
    user.avatarUrl ??= profile.avatarUrl;
    if (!user.providers.includes('google')) user.providers.push('google');
    if (profile.emailVerified) user.emailVerified = true;
    user.lastLoginAt = new Date();
    await user.save();
  }

  const tokens = await issueTokens(user._id, user.role, context);
  return { user: toPublicUser(user), tokens };
}

export async function refresh(refreshToken: string, context: SessionContext): Promise<AuthResult> {
  const { tokens, userId } = await rotateTokens(refreshToken, context);
  const user = await loadUser(userId);
  return { user: toPublicUser(user), tokens };
}

export async function getProfile(userId: string): Promise<PublicUser> {
  return toPublicUser(await loadUser(userId));
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
  const user = await loadUser(userId);

  if (input.name !== undefined) user.name = input.name;
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;
  if (input.preferences) {
    user.preferences = { ...user.preferences, ...input.preferences };
  }

  await user.save();
  return toPublicUser(user);
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('That account no longer exists.');

  if (!user.passwordHash) {
    throw ApiError.badRequest('This account signs in with Google. Set a password from your profile first.');
  }

  const valid = await user.comparePassword(input.currentPassword);
  if (!valid) throw ApiError.badRequest('Your current password is incorrect.');

  user.passwordHash = input.newPassword;
  if (!user.providers.includes('email')) user.providers.push('email');
  await user.save();

  await revokeAllSessions(user._id, 'password-change');
}
