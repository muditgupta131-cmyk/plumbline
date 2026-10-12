import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ASSET_TYPES, EXCHANGES } from '../../types/market.js';
import { ALERT_TYPES } from './watchlist.model.js';
import * as service from './watchlist.service.js';
import * as alerts from './alerts.service.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'That identifier is not valid.');

const addSchema = z
  .object({
    assetType: z.enum(ASSET_TYPES).default('EQUITY'),
    symbol: z.string().trim().min(1).max(160).optional(),
    exchange: z.enum(EXCHANGES).optional(),
    schemeCode: z.string().regex(/^\d{4,8}$/).optional(),
    notes: z.string().trim().max(280).optional(),
  })
  .refine(
    (value) => (value.assetType === 'MUTUAL_FUND' ? Boolean(value.schemeCode) : Boolean(value.symbol && value.exchange)),
    'A stock needs a symbol and exchange; a fund needs its AMFI scheme code.',
  );

const alertSchema = z.object({
  itemId: objectId,
  type: z.enum(ALERT_TYPES),
  threshold: z.coerce.number().positive().max(100_000_000),
  note: z.string().trim().max(280).optional(),
});

const router = Router();

router.use(requireAuth);

const userId = (req: { auth?: { userId: string } }) => new Types.ObjectId(req.auth!.userId);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    sendSuccess(res, { items: await service.listWatchlist(userId(req)) });
  }),
);

router.post(
  '/',
  validate({ body: addSchema }),
  asyncHandler(async (req, res) => {
    const item = await service.addToWatchlist(userId(req), req.body as service.WatchlistInput);
    sendSuccess(res, item.toJSON(), 'Added to your watchlist.', 201);
  }),
);

router.delete(
  '/:id',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    await service.removeFromWatchlist(userId(req), req.params.id);
    sendSuccess(res, null, 'Removed from your watchlist.');
  }),
);

router.get(
  '/alerts',
  asyncHandler(async (req, res) => {
    const rows = await service.listAlerts(userId(req));
    sendSuccess(res, { alerts: rows.map((row) => row.toJSON()) });
  }),
);

router.post(
  '/alerts',
  validate({ body: alertSchema }),
  asyncHandler(async (req, res) => {
    const alert = await service.createAlert(userId(req), req.body as service.AlertInput);
    sendSuccess(res, alert.toJSON(), 'Alert set.', 201);
  }),
);

router.patch(
  '/alerts/:id',
  validate({ params: z.object({ id: objectId }), body: z.object({ active: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const alert = await service.setAlertActive(userId(req), req.params.id, (req.body as { active: boolean }).active);
    sendSuccess(res, alert.toJSON(), 'Alert updated.');
  }),
);

router.delete(
  '/alerts/:id',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    await service.removeAlert(userId(req), req.params.id);
    sendSuccess(res, null, 'Alert removed.');
  }),
);

router.post(
  '/alerts/evaluate',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await alerts.evaluateAlerts(userId(req)), 'Alerts checked.');
  }),
);

export default router;
