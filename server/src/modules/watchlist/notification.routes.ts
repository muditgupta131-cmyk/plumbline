import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as alerts from './alerts.service.js';

const router = Router();

router.use(requireAuth);

const userId = (req: { auth?: { userId: string } }) => new Types.ObjectId(req.auth!.userId);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [rows, unread] = await Promise.all([
      alerts.listNotifications(userId(req)),
      alerts.unreadCount(userId(req)),
    ]);
    sendSuccess(res, { notifications: rows.map((row) => row.toJSON()), unread });
  }),
);

router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    sendSuccess(res, { updated: await alerts.markAllRead(userId(req)) }, 'Notifications marked read.');
  }),
);

router.patch(
  '/:id/read',
  validate({ params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }) }),
  asyncHandler(async (req, res) => {
    const notification = await alerts.markRead(userId(req), req.params.id);
    sendSuccess(res, notification.toJSON(), 'Marked read.');
  }),
);

export default router;
