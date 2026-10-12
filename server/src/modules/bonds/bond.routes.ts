import { Router } from 'express';
import { z } from 'zod';
import { marketLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listBonds } from './bond.service.js';

const router = Router();

router.use(marketLimiter);

const listSchema = z.object({
  q: z.string().trim().max(40).optional(),
  segment: z.enum(['corporate', 'gsec']).optional(),
  rating: z.string().trim().max(5).optional(),
  maturity: z.enum(['under1', '1to3', '3to5', '5to10', 'over10']).optional(),
  tradedOnly: z.coerce.boolean().optional(),
  sort: z.enum(['yieldToMaturity', 'currentYield', 'couponRate', 'yearsToMaturity', 'symbol']).default('yieldToMaturity'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

router.get(
  '/',
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await listBonds(req.query as unknown as Parameters<typeof listBonds>[0]));
  }),
);

export default router;
