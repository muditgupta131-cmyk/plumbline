import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../config/env.js';

const shared: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Wait a minute and try again.',
    code: 'RATE_LIMITED',
  },
};

export const globalLimiter = rateLimit({
  ...shared,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
});

export const authLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many sign-in attempts. Try again in 15 minutes.',
    code: 'RATE_LIMITED',
  },
});

export const marketLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  limit: 120,
  message: {
    success: false,
    message: 'Slow down — too many market data requests. Try again shortly.',
    code: 'RATE_LIMITED',
  },
});

export const aiLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 30,
  message: {
    success: false,
    message: 'You have used your AI report quota for this hour.',
    code: 'RATE_LIMITED',
  },
});
