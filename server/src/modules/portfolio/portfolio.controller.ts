import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import type { Currency } from '../../types/market.js';
import type { CandleRange } from '../market/providers/index.js';
import { Holding } from './portfolio.model.js';
import * as ledger from './ledger.service.js';
import * as service from './portfolio.service.js';
import type { HoldingInput } from './portfolio.types.js';

function userId(req: Request): Types.ObjectId {
  return new Types.ObjectId(req.auth!.userId);
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, { portfolios: await service.listPortfolios(userId(req)) });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const portfolio = await service.createPortfolio(userId(req), req.body as { name: string; baseCurrency: Currency });
  sendSuccess(res, portfolio.toJSON(), 'Portfolio created.', 201);
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getPortfolio(userId(req), req.params.id));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const portfolio = await service.updatePortfolio(userId(req), req.params.id, req.body as { name?: string });
  sendSuccess(res, portfolio.toJSON(), 'Portfolio updated.');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const removed = await service.deletePortfolio(userId(req), req.params.id);
  sendSuccess(
    res,
    removed,
    `Portfolio deleted, along with ${removed.holdings} holding${removed.holdings === 1 ? '' : 's'} and ${removed.transactions} transaction${removed.transactions === 1 ? '' : 's'}.`,
  );
});

export const addHolding = asyncHandler(async (req: Request, res: Response) => {
  const holding = await service.addHolding(userId(req), req.params.id, req.body as HoldingInput);
  sendSuccess(res, holding.toJSON(), 'Holding added.', 201);
});

export const updateHolding = asyncHandler(async (req: Request, res: Response) => {
  const holding = await service.updateHolding(userId(req), req.params.id, req.params.holdingId, req.body);
  sendSuccess(res, holding.toJSON(), 'Holding updated.');
});

export const removeHolding = asyncHandler(async (req: Request, res: Response) => {
  const removed = await service.removeHolding(userId(req), req.params.id, req.params.holdingId);
  sendSuccess(
    res,
    removed,
    removed.transactions
      ? `Holding removed, along with ${removed.transactions} transaction${removed.transactions === 1 ? '' : 's'}.`
      : 'Holding removed.',
  );
});

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  const portfolio = await service.requirePortfolio(userId(req), req.params.id);
  const transactions = await ledger.listTransactions(portfolio._id);
  sendSuccess(res, { transactions: transactions.map((entry) => entry.toJSON()) });
});

export const addTransaction = asyncHandler(async (req: Request, res: Response) => {
  const portfolio = await service.requirePortfolio(userId(req), req.params.id);
  const result = await ledger.addTransaction(userId(req), portfolio._id, req.body as ledger.TransactionInput);

  sendSuccess(
    res,
    { transaction: result.transaction.toJSON(), position: result.position },
    'Transaction recorded.',
    201,
  );
});

export const removeTransaction = asyncHandler(async (req: Request, res: Response) => {
  const portfolio = await service.requirePortfolio(userId(req), req.params.id);
  await ledger.removeTransaction(userId(req), portfolio._id, req.params.transactionId);
  sendSuccess(res, null, 'Transaction removed.');
});

export const performance = asyncHandler(async (req: Request, res: Response) => {
  const { range } = req.query as unknown as { range: CandleRange };
  const points = await service.portfolioPerformance(userId(req), req.params.id, range);
  sendSuccess(res, { range, points });
});

export const holdings = asyncHandler(async (req: Request, res: Response) => {
  await service.requirePortfolio(userId(req), req.params.id);
  const rows = await Holding.find({ portfolioId: req.params.id }).sort({ createdAt: 1 });
  sendSuccess(res, { holdings: rows.map((row) => row.toJSON()) });
});
