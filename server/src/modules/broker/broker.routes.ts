import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { BROKER_IDS } from './adapters/types.js';
import * as service from './broker.service.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'That identifier is not valid.');

const connectSchema = z.object({
  broker: z.enum(BROKER_IDS),
  credentials: z.record(z.string().trim().min(1).max(4096)),
});

const syncSchema = z.object({ portfolioId: objectId });

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, service.brokerCatalogue());
  }),
);

router.use(requireAuth);

router.get(
  '/connections',
  asyncHandler(async (req, res) => {
    sendSuccess(res, { connections: await service.listConnections(new Types.ObjectId(req.auth!.userId)) });
  }),
);

router.post(
  '/connections',
  validate({ body: connectSchema }),
  asyncHandler(async (req, res) => {
    const { broker, credentials } = req.body as { broker: (typeof BROKER_IDS)[number]; credentials: Record<string, string> };
    const result = await service.connectBroker(new Types.ObjectId(req.auth!.userId), broker, credentials);
    sendSuccess(res, result, `Connected. ${result.holdings} holdings visible.`, 201);
  }),
);

router.delete(
  '/connections/:id',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    await service.disconnectBroker(new Types.ObjectId(req.auth!.userId), req.params.id);
    sendSuccess(res, null, 'Broker disconnected.');
  }),
);

router.post(
  '/connections/:id/sync',
  validate({ params: z.object({ id: objectId }), body: syncSchema }),
  asyncHandler(async (req, res) => {
    const { portfolioId } = req.body as { portfolioId: string };
    const result = await service.syncBroker(new Types.ObjectId(req.auth!.userId), req.params.id, portfolioId);
    sendSuccess(res, result, `Synced ${result.added + result.updated} holdings${result.removed ? `, removed ${result.removed} no longer held` : ''}.`);
  }),
);

export default router;
