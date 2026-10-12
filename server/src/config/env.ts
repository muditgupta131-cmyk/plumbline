import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5050),
  CLIENT_URL: z.string().url().default('http://localhost:5273'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(32).default('development-only-access-secret-change-me!!'),
  JWT_REFRESH_SECRET: z.string().min(32).default('development-only-refresh-secret-change-me!'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  ENCRYPTION_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().regex(/^[0-9a-f]{64}$/i, 'ENCRYPTION_KEY must be 64 hex characters').optional(),
  ),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  FINNHUB_API_KEY: z.string().optional(),
  FMP_API_KEY: z.string().optional(),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  TWELVE_DATA_API_KEY: z.string().optional(),

  YAHOO_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  MARKET_DAILY_CALL_BUDGET: z.coerce.number().int().positive().default(220),

  MARKET_SAMPLE_FALLBACK: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';

const PLACEHOLDER_PATTERN = /replace|change-?me|example|your-|secret-here|xxx|development-only/i;

/**
 * A signing secret that ships in the repository is not a secret. Refuse to run with one in
 * production rather than quietly issuing forgeable tokens.
 */
const weakSecrets = (
  [
    ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
  ] as const
).filter(([, value]) => PLACEHOLDER_PATTERN.test(value));

if (weakSecrets.length) {
  const names = weakSecrets.map(([name]) => name).join(' and ');
  const help = `Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`;

  if (isProduction) {
    console.error(`${names} still hold a placeholder value. Anyone with the repository could forge tokens.\n${help}`);
    process.exit(1);
  }

  console.warn(`WARN ${names} still hold a placeholder value. Fine on localhost, unusable in production.\n${help}`);
}

if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
  const message = 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ, or a refresh token can be replayed as an access token.';
  if (isProduction) {
    console.error(message);
    process.exit(1);
  }
  console.warn(`WARN ${message}`);
}
