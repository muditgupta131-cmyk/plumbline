import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parseSecurityKey, type Currency, type Exchange, type Market, type SecurityRef } from '../../types/market.js';
import type { CandleRange } from './providers/provider.types.js';
import * as marketService from './market.service.js';

function refFromParams(req: Request): SecurityRef {
  const { exchange, symbol } = req.params as { exchange: Exchange; symbol: string };
  return { exchange, symbol };
}

export const search = asyncHandler(async (req: Request, res: Response) => {
  const { q, limit } = req.query as unknown as { q: string; limit: number };
  sendSuccess(res, await marketService.searchSymbols(q, limit));
});

export const quote = asyncHandler(async (req: Request, res: Response) => {
  const payload = await marketService.getQuote(refFromParams(req));
  res.set('Cache-Control', 'public, max-age=15');
  sendSuccess(res, payload);
});

export const quotes = asyncHandler(async (req: Request, res: Response) => {
  const { symbols } = req.query as unknown as { symbols: string };

  const refs: SecurityRef[] = [];
  for (const entry of symbols.split(',')) {
    const ref = parseSecurityKey(entry.trim());
    if (!ref) throw ApiError.badRequest(`"${entry.trim()}" is not a valid EXCHANGE:SYMBOL pair.`);
    refs.push(ref);
  }

  res.set('Cache-Control', 'public, max-age=15');
  sendSuccess(res, await marketService.getQuotes(refs));
});

export const profile = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await marketService.getProfile(refFromParams(req)));
});

export const fundamentals = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await marketService.getFundamentals(refFromParams(req)));
});

export const stock = asyncHandler(async (req: Request, res: Response) => {
  const { range } = req.query as unknown as { range: CandleRange };
  res.set('Cache-Control', 'public, max-age=15');
  sendSuccess(res, await marketService.getStockDetail(refFromParams(req), range));
});

export const candles = asyncHandler(async (req: Request, res: Response) => {
  const { range } = req.query as unknown as { range: CandleRange };
  sendSuccess(res, await marketService.getCandles(refFromParams(req), range));
});

export const trending = asyncHandler(async (req: Request, res: Response) => {
  const { market, limit } = req.query as unknown as { market?: Market; limit: number };
  const results = await marketService.getTrending(market, limit);
  sendSuccess(res, { market: market ?? 'ALL', results });
});

export const indices = asyncHandler(async (req: Request, res: Response) => {
  const { market } = req.query as unknown as { market?: Market };
  res.set('Cache-Control', 'public, max-age=15');
  sendSuccess(res, { indices: await marketService.getIndices(market) });
});

export const movers = asyncHandler(async (req: Request, res: Response) => {
  const { market, limit } = req.query as unknown as { market: Market; limit: number };
  res.set('Cache-Control', 'public, max-age=30');
  sendSuccess(res, await marketService.getMovers(market, limit));
});

export const sectors = asyncHandler(async (req: Request, res: Response) => {
  const { market } = req.query as unknown as { market: Market };
  res.set('Cache-Control', 'public, max-age=30');
  sendSuccess(res, { market, sectors: await marketService.getSectors(market) });
});

export const sessions = asyncHandler(async (req: Request, res: Response) => {
  const { market } = req.query as unknown as { market?: Market };
  sendSuccess(res, { sessions: marketService.getSessions(market) });
});

export const overview = asyncHandler(async (req: Request, res: Response) => {
  const { market, limit } = req.query as unknown as { market: Market; limit: number };
  res.set('Cache-Control', 'public, max-age=30');
  sendSuccess(res, await marketService.getOverview(market, limit));
});

export const compare = asyncHandler(async (req: Request, res: Response) => {
  const { symbols } = req.query as unknown as { symbols: string };

  const refs: SecurityRef[] = [];
  for (const entry of symbols.split(',')) {
    const ref = parseSecurityKey(entry.trim());
    if (!ref) throw ApiError.badRequest(`"${entry.trim()}" is not a valid EXCHANGE:SYMBOL pair.`);
    refs.push(ref);
  }

  res.set('Cache-Control', 'public, max-age=30');
  sendSuccess(res, await marketService.compareSecurities(refs));
});

export const fx = asyncHandler(async (req: Request, res: Response) => {
  const { base, quote } = req.query as unknown as { base: Currency; quote: Currency };
  res.set('Cache-Control', 'public, max-age=300');
  sendSuccess(res, await marketService.getFxRate(base, quote));
});

export const status = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, marketService.getMarketStatus());
});
