import { Router } from 'express';
import { z } from 'zod';
import { marketLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './fund.service.js';
import { refreshFundUniverse } from './amfi.service.js';
import { exploreFunds, fundDetail } from './explorer.service.js';

const router = Router();

router.use(marketLimiter);

router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await service.fundUniverseStatus());
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, { schemes: await refreshFundUniverse(true) }, 'Fund universe refreshed.');
  }),
);

const exploreSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(120).optional(),
  fundHouse: z.string().trim().max(120).optional(),
  plan: z.enum(['Direct', 'Regular']).optional(),
  sort: z.enum(['return1y', 'return3y', 'return5y', 'nav', 'name']).default('return1y'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

// The whole AMFI universe, ranked on returns computed from AMFI's own historical NAV files.
router.get(
  '/explore',
  validate({ query: exploreSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await exploreFunds(req.query as unknown as Parameters<typeof exploreFunds>[0]));
  }),
);

router.get(
  '/search',
  validate({ query: z.object({ q: z.string().trim().min(2).max(80), limit: z.coerce.number().int().min(1).max(25).default(10) }) }),
  asyncHandler(async (req, res) => {
    const { q, limit } = req.query as unknown as { q: string; limit: number };
    sendSuccess(res, { results: await service.searchFunds(q, limit) });
  }),
);

router.get(
  '/:schemeCode',
  validate({ params: z.object({ schemeCode: z.string().regex(/^\d{4,8}$/) }) }),
  asyncHandler(async (req, res) => {
    const fund = await service.getFund(req.params.schemeCode);
    // Returns and the category ranking come from the explorer's cached dataset, so the detail view
    // and the list can never disagree about how a scheme has done.
    const detail = await fundDetail(req.params.schemeCode).catch(() => null);
    sendSuccess(res, { ...fund, ...(detail ?? {}) });
  }),
);

router.get(
  '/:schemeCode/history',
  validate({
    params: z.object({ schemeCode: z.string().regex(/^\d{4,8}$/) }),
    query: z.object({ days: z.coerce.number().int().min(30).max(3650).default(365) }),
  }),
  asyncHandler(async (req, res) => {
    const { days } = req.query as unknown as { days: number };
    sendSuccess(res, { schemeCode: req.params.schemeCode, points: await service.getNavHistory(req.params.schemeCode, days) });
  }),
);

export default router;
