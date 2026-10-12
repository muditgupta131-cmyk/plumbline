import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getIpo, listIpos } from './ipo.service.js';

const slugSchema = z.object({ slug: z.string().trim().min(1).max(80) });

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const { ipos, calibration } = await listIpos();
  sendSuccess(res, { ipos, calibration });
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = slugSchema.parse(req.params);
  sendSuccess(res, await getIpo(slug));
});
