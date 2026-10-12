import { Router } from 'express';
import { marketLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './market.controller.js';
import {
  candlesQuerySchema,
  compareQuerySchema,
  fxQuerySchema,
  indicesQuerySchema,
  marketQuerySchema,
  overviewQuerySchema,
  quotesQuerySchema,
  searchQuerySchema,
  securityParamsSchema,
  trendingQuerySchema,
} from './market.schema.js';

const router = Router();

router.use(marketLimiter);

router.get('/status', controller.status);
router.get('/overview', validate({ query: overviewQuerySchema }), controller.overview);
router.get('/indices', validate({ query: indicesQuerySchema }), controller.indices);
router.get('/movers', validate({ query: overviewQuerySchema }), controller.movers);
router.get('/sectors', validate({ query: marketQuerySchema }), controller.sectors);
router.get('/sessions', validate({ query: indicesQuerySchema }), controller.sessions);
router.get('/fx', validate({ query: fxQuerySchema }), controller.fx);
router.get('/compare', validate({ query: compareQuerySchema }), controller.compare);
router.get('/search', validate({ query: searchQuerySchema }), controller.search);
router.get('/trending', validate({ query: trendingQuerySchema }), controller.trending);
router.get('/quotes', validate({ query: quotesQuerySchema }), controller.quotes);
router.get('/quote/:exchange/:symbol', validate({ params: securityParamsSchema }), controller.quote);
router.get('/profile/:exchange/:symbol', validate({ params: securityParamsSchema }), controller.profile);
router.get('/fundamentals/:exchange/:symbol', validate({ params: securityParamsSchema }), controller.fundamentals);
router.get(
  '/stock/:exchange/:symbol',
  validate({ params: securityParamsSchema, query: candlesQuerySchema }),
  controller.stock,
);
router.get(
  '/candles/:exchange/:symbol',
  validate({ params: securityParamsSchema, query: candlesQuerySchema }),
  controller.candles,
);

export default router;
