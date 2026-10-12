import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import {
  CURRENCIES,
  EXCHANGES,
  MARKETS,
  type Currency,
  type Exchange,
  type Market,
} from '../../types/market.js';

export interface StockSymbolDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  symbol: string;
  exchange: Exchange;
  market: Market;
  currency: Currency;
  name: string;
  searchName: string;
  sector?: string;
  industry?: string;
  logoUrl?: string;
  popular: boolean;
  hitCount: number;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

type StockSymbolModel = Model<StockSymbolDocument>;

const stockSymbolSchema = new Schema<StockSymbolDocument, StockSymbolModel>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true },
    exchange: { type: String, required: true, enum: EXCHANGES },
    market: { type: String, required: true, enum: MARKETS, index: true },
    currency: { type: String, required: true, enum: CURRENCIES },
    name: { type: String, required: true, trim: true },
    searchName: { type: String, required: true, lowercase: true, trim: true },
    sector: { type: String, trim: true },
    industry: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    popular: { type: Boolean, default: false, index: true },
    hitCount: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: () => new Date() },
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

stockSymbolSchema.index({ exchange: 1, symbol: 1 }, { unique: true });
stockSymbolSchema.index({ searchName: 1 });
stockSymbolSchema.index({ name: 'text', symbol: 'text' }, { weights: { symbol: 10, name: 5 }, name: 'symbol_text' });

export const StockSymbol = model<StockSymbolDocument, StockSymbolModel>('StockSymbol', stockSymbolSchema);
