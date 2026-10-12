import { z } from 'zod';
import { ASSET_TYPES, CURRENCIES, EXCHANGES } from '../../types/market.js';
import { CANDLE_RANGES } from '../market/providers/provider.types.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'That identifier is not valid.');

export const portfolioParamsSchema = z.object({ id: objectId });

export const holdingParamsSchema = z.object({ id: objectId, holdingId: objectId });

export const createPortfolioSchema = z.object({
  name: z.string().trim().min(1, 'Give the portfolio a name.').max(60),
  baseCurrency: z.enum(CURRENCIES).default('INR'),
});

export const updatePortfolioSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    baseCurrency: z.enum(CURRENCIES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to update.');

export const createHoldingSchema = z
  .object({
    assetType: z.enum(ASSET_TYPES).default('EQUITY'),
    symbol: z.string().trim().min(1).max(160).optional(),
    exchange: z.enum(EXCHANGES).optional(),
    schemeCode: z.string().regex(/^\d{4,8}$/, 'That is not a valid AMFI scheme code.').optional(),
    quantity: z.coerce.number().positive('Quantity must be greater than zero.').max(1_000_000_000),
    avgBuyPrice: z.coerce.number().nonnegative('Buy price cannot be negative.').max(10_000_000),
    buyDate: z.string().datetime().or(z.string().date()).optional(),
    notes: z.string().trim().max(280).optional(),
  })
  .refine(
    (value) => (value.assetType === 'MUTUAL_FUND' ? Boolean(value.schemeCode) : Boolean(value.symbol && value.exchange)),
    'A stock needs a symbol and exchange; a mutual fund needs its AMFI scheme code.',
  );

export const updateHoldingSchema = z
  .object({
    quantity: z.coerce.number().positive().max(1_000_000_000).optional(),
    avgBuyPrice: z.coerce.number().nonnegative().max(10_000_000).optional(),
    buyDate: z.string().datetime().or(z.string().date()).optional(),
    notes: z.string().trim().max(280).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to update.');

export const createTransactionSchema = z
  .object({
    assetType: z.enum(ASSET_TYPES).default('EQUITY'),
    symbol: z.string().trim().min(1).max(160).optional(),
    exchange: z.enum(EXCHANGES).optional(),
    schemeCode: z.string().regex(/^\d{4,8}$/).optional(),
    type: z.enum(['BUY', 'SELL', 'DIVIDEND']),
    quantity: z.coerce.number().nonnegative().max(1_000_000_000),
    price: z.coerce.number().nonnegative().max(10_000_000),
    fees: z.coerce.number().nonnegative().max(1_000_000).default(0),
    date: z.string().datetime().or(z.string().date()),
    notes: z.string().trim().max(280).optional(),
  })
  .refine(
    (value) => (value.assetType === 'MUTUAL_FUND' ? Boolean(value.schemeCode) : Boolean(value.symbol && value.exchange)),
    'A stock transaction needs a symbol and exchange; a fund transaction needs its AMFI scheme code.',
  )
  .refine((value) => value.type === 'DIVIDEND' || value.quantity > 0, 'Buys and sells need a quantity above zero.');

export const transactionParamsSchema = z.object({
  id: objectId,
  transactionId: objectId,
});

export const performanceQuerySchema = z.object({
  range: z.enum(CANDLE_RANGES).default('1Y'),
});
