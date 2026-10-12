import { z } from 'zod';
import { CURRENCIES, EXCHANGES, MARKETS } from '../../types/market.js';
import { CANDLE_RANGES } from './providers/provider.types.js';

export const securityParamsSchema = z.object({
  exchange: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(EXCHANGES)),
  symbol: z
    .string()
    .min(1)
    .max(24)
    .transform((value) => value.toUpperCase()),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Type at least one character to search.').max(64),
  limit: z.coerce.number().int().min(1).max(25).default(8),
});

export const quotesQuerySchema = z.object({
  symbols: z
    .string()
    .min(1, 'Pass at least one symbol as EXCHANGE:SYMBOL.')
    .max(600)
    .refine((value) => value.split(',').filter(Boolean).length <= 25, 'Request at most 25 symbols at a time.'),
});

export const candlesQuerySchema = z.object({
  range: z.enum(CANDLE_RANGES).default('1M'),
});

export const marketQuerySchema = z.object({
  market: z.enum(MARKETS).default('IN'),
});

export const overviewQuerySchema = z.object({
  market: z.enum(MARKETS).default('IN'),
  limit: z.coerce.number().int().min(3).max(20).default(6),
});

export const indicesQuerySchema = z.object({
  market: z.enum(MARKETS).optional(),
});

export const compareQuerySchema = z.object({
  symbols: z
    .string()
    .min(1, 'Pass at least one symbol as EXCHANGE:SYMBOL.')
    .max(200)
    .refine((value) => {
      const count = value.split(',').filter(Boolean).length;
      return count >= 1 && count <= 4;
    }, 'Compare between one and four companies.'),
});

export const fxQuerySchema = z.object({
  base: z.enum(CURRENCIES).default('USD'),
  quote: z.enum(CURRENCIES).default('INR'),
});

export const trendingQuerySchema = z.object({
  market: z.enum(MARKETS).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
