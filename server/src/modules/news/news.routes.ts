import { Router } from 'express';
import { z } from 'zod';
import { marketLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { EXCHANGES, MARKETS, type Exchange, type Market } from '../../types/market.js';
import * as service from './news.service.js';

const router = Router();

router.use(marketLimiter);

router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, service.newsStatus());
  }),
);

router.get(
  '/',
  validate({
    query: z.object({
      market: z.enum(MARKETS).default('IN'),
      limit: z.coerce.number().int().min(1).max(40).default(20),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { market, limit } = req.query as unknown as { market: Market; limit: number };
    res.set('Cache-Control', 'public, max-age=300');
    sendSuccess(res, await service.getMarketNews(market, limit));
  }),
);

router.get(
  '/digest',
  validate({ query: z.object({ market: z.enum(MARKETS).default('IN') }) }),
  asyncHandler(async (req, res) => {
    const { market } = req.query as unknown as { market: Market };
    sendSuccess(res, await service.getMarketDigest(market));
  }),
);

router.get(
  '/symbol/:exchange/:symbol',
  validate({
    params: z.object({
      exchange: z.string().transform((value) => value.toUpperCase()).pipe(z.enum(EXCHANGES)),
      symbol: z.string().min(1).max(24).transform((value) => value.toUpperCase()),
    }),
    query: z.object({ limit: z.coerce.number().int().min(1).max(20).default(8) }),
  }),
  asyncHandler(async (req, res) => {
    const { exchange, symbol } = req.params as { exchange: Exchange; symbol: string };
    const { limit } = req.query as unknown as { limit: number };
    res.set('Cache-Control', 'public, max-age=300');
    sendSuccess(res, await service.getSymbolNews({ exchange, symbol }, limit));
  }),
);

export default router;
