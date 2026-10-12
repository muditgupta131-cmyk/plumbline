import { Router } from 'express';
import { z } from 'zod';
import { aiLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/authenticate.js';
import { securityParamsSchema } from '../market/market.schema.js';
import * as controller from './ai.controller.js';

const analysisQuerySchema = z.object({
  refresh: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

const router = Router();

router.get('/status', controller.status);
router.get(
  '/stock/:exchange/:symbol',
  aiLimiter,
  validate({ params: securityParamsSchema, query: analysisQuerySchema }),
  controller.stockAnalysis,
);

router.get(
  '/portfolio/:id',
  requireAuth,
  aiLimiter,
  validate({
    params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'That identifier is not valid.') }),
    query: analysisQuerySchema,
  }),
  controller.portfolioAnalysis,
);

export default router;
