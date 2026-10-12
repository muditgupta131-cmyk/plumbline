import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

let client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID) {
    throw ApiError.badRequest('Google sign-in is not configured on this server.');
  }
  client ??= new OAuth2Client(env.GOOGLE_CLIENT_ID);
  return client;
}

export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  let payload;

  // Resolved before the try: a server with no client id configured is a deployment problem, and
  // reporting it as "Google could not verify that sign-in" hides the one fact that explains it.
  const client = getClient();

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID as string,
    });
    payload = ticket.getPayload();
  } catch {
    throw ApiError.unauthorized('Google could not verify that sign-in. Try again.');
  }

  if (!payload?.sub || !payload.email) {
    throw ApiError.unauthorized('Google did not return an email for this account.');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name ?? payload.email.split('@')[0] ?? 'Investor',
    avatarUrl: payload.picture,
    emailVerified: payload.email_verified ?? false,
  };
}
