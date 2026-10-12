import express, { Router } from 'express';
import { requireAuth } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './portfolio.controller.js';
import * as importController from '../import/import.controller.js';
import {
  createHoldingSchema,
  createTransactionSchema,
  transactionParamsSchema,
  createPortfolioSchema,
  holdingParamsSchema,
  performanceQuerySchema,
  portfolioParamsSchema,
  updateHoldingSchema,
  updatePortfolioSchema,
} from './portfolio.schema.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', validate({ body: createPortfolioSchema }), controller.create);

router.get('/:id', validate({ params: portfolioParamsSchema }), controller.detail);
router.patch(
  '/:id',
  validate({ params: portfolioParamsSchema, body: updatePortfolioSchema }),
  controller.update,
);
router.delete('/:id', validate({ params: portfolioParamsSchema }), controller.remove);

router.get('/:id/holdings', validate({ params: portfolioParamsSchema }), controller.holdings);
router.post(
  '/:id/holdings',
  validate({ params: portfolioParamsSchema, body: createHoldingSchema }),
  controller.addHolding,
);
router.patch(
  '/:id/holdings/:holdingId',
  validate({ params: holdingParamsSchema, body: updateHoldingSchema }),
  controller.updateHolding,
);
router.delete(
  '/:id/holdings/:holdingId',
  validate({ params: holdingParamsSchema }),
  controller.removeHolding,
);

router.get('/:id/transactions', validate({ params: portfolioParamsSchema }), controller.listTransactions);
router.post(
  '/:id/transactions',
  validate({ params: portfolioParamsSchema, body: createTransactionSchema }),
  controller.addTransaction,
);
router.delete(
  '/:id/transactions/:transactionId',
  validate({ params: transactionParamsSchema }),
  controller.removeTransaction,
);

router.post(
  '/:id/import/preview',
  validate({ params: portfolioParamsSchema }),
  importController.preview,
);
router.post(
  '/:id/import/statement',
  // Statement PDFs are far larger than the JSON this API otherwise accepts.
  express.json({ limit: '20mb' }),
  validate({ params: portfolioParamsSchema }),
  importController.previewStatement,
);
router.post(
  '/:id/import/commit',
  validate({ params: portfolioParamsSchema }),
  importController.commit,
);

router.get(
  '/:id/performance',
  validate({ params: portfolioParamsSchema, query: performanceQuerySchema }),
  controller.performance,
);

export default router;
