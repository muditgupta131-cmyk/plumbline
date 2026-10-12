import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function encryptionAvailable(): boolean {
  return Boolean(env.ENCRYPTION_KEY);
}

function key(): Buffer {
  if (!env.ENCRYPTION_KEY) {
    throw ApiError.badRequest(
      'Broker connections need ENCRYPTION_KEY in server/.env. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(env.ENCRYPTION_KEY, 'hex');
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptSecret(payload: string): string {
  const [iv, tag, encrypted] = payload.split('.');
  if (!iv || !tag || !encrypted) throw ApiError.internal('Stored credential is malformed.');

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
