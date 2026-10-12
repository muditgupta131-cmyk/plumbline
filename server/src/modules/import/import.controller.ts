import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ASSET_TYPES, EXCHANGES } from '../../types/market.js';
import { requirePortfolio } from '../portfolio/portfolio.service.js';
import { buildPreview, commitRows, commitTransactions } from './import.service.js';
import { extractPdfText } from './parsers/pdfText.js';
import { looksLikeCas } from './parsers/cas.js';

const previewSchema = z.object({
  content: z.string().min(10, 'Paste or upload a holdings file first.').max(500_000),
});

const statementSchema = z.object({
  // Base64 keeps the upload on the existing JSON pipeline; a 15 MB cap covers a decade-long CAS.
  file: z.string().min(100, 'Upload a statement PDF first.').max(20_000_000),
  password: z.string().max(200).optional(),
});

const commitTransactionsSchema = z.object({
  mode: z.literal('transactions'),
  rows: z
    .array(
      z
        .object({
          assetType: z.enum(ASSET_TYPES).default('EQUITY'),
          symbol: z.string().trim().min(1).max(160).optional(),
          exchange: z.enum(EXCHANGES).optional(),
          schemeCode: z.string().regex(/^\d{4,8}$/).optional(),
          type: z.enum(['BUY', 'SELL', 'DIVIDEND']),
          quantity: z.coerce.number().nonnegative(),
          price: z.coerce.number().nonnegative(),
          fees: z.coerce.number().nonnegative().default(0),
          date: z.string(),
        })
        .refine(
          (row) => (row.assetType === 'MUTUAL_FUND' ? Boolean(row.schemeCode) : Boolean(row.symbol && row.exchange)),
          'Each row needs either a symbol and exchange, or an AMFI scheme code.',
        ),
    )
    .min(1)
    .max(200),
});

const commitSchema = z.object({
  // Balances restate a position; transactions add to one. The client sends what the preview advised,
  // and the person importing can override it.
  strategy: z.enum(['add', 'replace']).default('add'),
  rows: z
    .array(
      z
        .object({
          assetType: z.enum(ASSET_TYPES).default('EQUITY'),
          symbol: z.string().trim().min(1).max(160).optional(),
          exchange: z.enum(EXCHANGES).optional(),
          schemeCode: z.string().regex(/^\d{4,8}$/).optional(),
          quantity: z.coerce.number().positive(),
          avgBuyPrice: z.coerce.number().nonnegative(),
          buyDate: z.string().optional(),
        })
        .refine(
          (row) => (row.assetType === 'MUTUAL_FUND' ? Boolean(row.schemeCode) : Boolean(row.symbol && row.exchange)),
          'Each row needs either a symbol and exchange, or an AMFI scheme code.',
        ),
    )
    .min(1, 'Pick at least one row to import.')
    .max(200),
});

/** Says what actually happened, so re-importing a statement reads as a correction, not a mystery. */
function summarise(result: { added: number; skipped: number }, noun: string): string {
  const parts = [`${result.added} ${noun}${result.added === 1 ? '' : 's'} imported`];
  if (result.skipped) parts.push(`${result.skipped} already up to date`);
  return `${parts.join(', ')}.`;
}

export const preview = asyncHandler(async (req: Request, res: Response) => {
  const userId = new Types.ObjectId(req.auth!.userId);
  await requirePortfolio(userId, req.params.id);

  const { content } = previewSchema.parse(req.body);
  sendSuccess(res, await buildPreview(content, { userId, portfolioId: req.params.id }));
});

export const commit = asyncHandler(async (req: Request, res: Response) => {
  const userId = new Types.ObjectId(req.auth!.userId);

  if ((req.body as { mode?: string }).mode === 'transactions') {
    const { rows } = commitTransactionsSchema.parse(req.body);
    const result = await commitTransactions(userId, req.params.id, rows);
    sendSuccess(res, result, summarise(result, 'transaction'));
    return;
  }

  const { rows, strategy } = commitSchema.parse(req.body);
  const result = await commitRows(userId, req.params.id, rows, strategy);
  sendSuccess(res, result, summarise(result, 'holding'));
});

function decodePdf(value: string): Uint8Array {
  const base64 = value.includes(',') && value.startsWith('data:') ? value.slice(value.indexOf(',') + 1) : value;
  const bytes = Buffer.from(base64, 'base64');

  if (bytes.length < 100) throw ApiError.badRequest('That upload was empty or unreadable.');
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw ApiError.badRequest('That is not a PDF. Upload the statement exactly as the registrar emailed it.');
  }

  return new Uint8Array(bytes);
}

/**
 * Reads a CAMS/KFintech consolidated account statement. It is the one file that carries a person's
 * mutual funds across every AMC, so it works no matter which app the units were bought through.
 */
export const previewStatement = asyncHandler(async (req: Request, res: Response) => {
  const userId = new Types.ObjectId(req.auth!.userId);
  await requirePortfolio(userId, req.params.id);

  const { file, password } = statementSchema.parse(req.body);
  const { text, pages } = await extractPdfText(decodePdf(file), password?.trim() || undefined);

  if (!looksLikeCas(text)) {
    throw ApiError.badRequest(
      text.trim().length < 40
        ? 'That PDF has no readable text — it is probably a scan. Ask CAMS or KFintech to email the statement again.'
        : 'That PDF does not look like a consolidated account statement. Use the CAS from CAMS or KFintech, or import a CSV instead.',
    );
  }

  const preview = await buildPreview(text, { userId, portfolioId: req.params.id });
  sendSuccess(res, { ...preview, pages });
});
