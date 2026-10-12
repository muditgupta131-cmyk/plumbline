import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { Types } from 'mongoose';
import type { Exchange, SecurityRef } from '../../types/market.js';
import * as aiService from './ai.service.js';

function refFromParams(req: Request): SecurityRef {
  const { exchange, symbol } = req.params as { exchange: Exchange; symbol: string };
  return { exchange, symbol };
}

export const stockAnalysis = asyncHandler(async (req: Request, res: Response) => {
  const { refresh } = req.query as unknown as { refresh?: boolean };
  sendSuccess(res, await aiService.getStockAnalysis(refFromParams(req), { refresh: refresh === true }));
});

export const portfolioAnalysis = asyncHandler(async (req: Request, res: Response) => {
  const { refresh } = req.query as unknown as { refresh?: boolean };
  const analysis = await aiService.getPortfolioAnalysis(new Types.ObjectId(req.auth!.userId), req.params.id, {
    refresh: refresh === true,
  });
  sendSuccess(res, analysis);
});

export const status = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, aiService.getAnalysisStatus());
});
