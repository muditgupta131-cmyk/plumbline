import { Router } from 'express';
import { z } from 'zod';
import { marketLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { MARKETS } from '../../types/market.js';
import { SORT_FIELDS, screen, type ScreenerFilters } from './screener.service.js';

const numeric = z.coerce.number().finite();

const querySchema = z.object({
  market: z.enum(MARKETS).optional(),
  sector: z.string().trim().max(60).optional(),
  minMarketCap: numeric.nonnegative().optional(),
  minPeRatio: numeric.optional(),
  maxPeRatio: numeric.optional(),
  minRoe: numeric.optional(),
  maxDebtToEquity: numeric.nonnegative().optional(),
  minRevenueGrowth: numeric.optional(),
  minDividendYield: numeric.nonnegative().optional(),
  minPrice: numeric.nonnegative().optional(),
  maxPrice: numeric.nonnegative().optional(),
  maxRangePosition: numeric.min(0).max(100).optional(),
  sortBy: z.enum(SORT_FIELDS).default('marketCap'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const router = Router();

router.get(
  '/',
  marketLimiter,
  validate({ query: querySchema }),
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    sendSuccess(res, await screen(req.query as unknown as ScreenerFilters));
  }),
);

export default router;
