import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import { ASSET_TYPES, CURRENCIES, EXCHANGES, type AssetType, type Currency, type Exchange } from '../../types/market.js';

export const TRANSACTION_TYPES = ['BUY', 'SELL', 'DIVIDEND'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface TransactionDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  portfolioId: Types.ObjectId;
  assetType: AssetType;
  symbol: string;
  exchange: Exchange | null;
  schemeCode: string | null;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number;
  currency: Currency;
  date: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<TransactionDocument, Model<TransactionDocument>>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    portfolioId: { type: Schema.Types.ObjectId, ref: 'Portfolio', required: true, index: true },
    assetType: { type: String, required: true, enum: ASSET_TYPES, default: 'EQUITY' },
    symbol: { type: String, required: true, trim: true },
    exchange: { type: String, enum: [...EXCHANGES, null], default: null },
    schemeCode: { type: String, default: null },
    type: { type: String, required: true, enum: TRANSACTION_TYPES },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    fees: { type: Number, default: 0, min: 0 },
    currency: { type: String, required: true, enum: CURRENCIES },
    date: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 280 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

transactionSchema.index({ portfolioId: 1, date: -1 });
transactionSchema.index({ portfolioId: 1, exchange: 1, symbol: 1 });
transactionSchema.index({ portfolioId: 1, schemeCode: 1 });

export const Transaction = model<TransactionDocument, Model<TransactionDocument>>('Transaction', transactionSchema);
