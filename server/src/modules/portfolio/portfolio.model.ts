import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import { ASSET_TYPES, CURRENCIES, EXCHANGES, type AssetType, type Currency, type Exchange } from '../../types/market.js';

export interface PortfolioDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  baseCurrency: Currency;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HoldingDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  userId: Types.ObjectId;
  assetType: AssetType;
  origin: 'manual' | 'broker' | 'statement';
  brokerId: string | null;
  symbol: string;
  exchange: Exchange | null;
  schemeCode: string | null;
  quantity: number;
  avgBuyPrice: number;
  currency: Currency;
  buyDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const transform = (_doc: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const portfolioSchema = new Schema<PortfolioDocument, Model<PortfolioDocument>>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    baseCurrency: { type: String, required: true, enum: CURRENCIES, default: 'INR' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { transform } },
);

portfolioSchema.index({ userId: 1, name: 1 }, { unique: true });

const holdingSchema = new Schema<HoldingDocument, Model<HoldingDocument>>(
  {
    portfolioId: { type: Schema.Types.ObjectId, ref: 'Portfolio', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assetType: { type: String, required: true, enum: ASSET_TYPES, default: 'EQUITY' },
    // A broker sync reconciles only the rows it owns, so manual positions are never touched by it.
    origin: { type: String, enum: ['manual', 'broker', 'statement'], default: 'manual', index: true },
    brokerId: { type: String, default: null },
    symbol: { type: String, required: true, trim: true },
    exchange: {
      type: String,
      enum: [...EXCHANGES, null],
      default: null,
      required: function (this: { assetType: AssetType }) {
        return this.assetType === 'EQUITY';
      },
    },
    schemeCode: {
      type: String,
      default: null,
      required: function (this: { assetType: AssetType }) {
        return this.assetType === 'MUTUAL_FUND';
      },
    },
    quantity: { type: Number, required: true, min: [0.000001, 'Quantity must be greater than zero'] },
    avgBuyPrice: { type: Number, required: true, min: [0, 'Buy price cannot be negative'] },
    currency: { type: String, required: true, enum: CURRENCIES },
    buyDate: { type: Date, required: true, default: () => new Date() },
    notes: { type: String, trim: true, maxlength: 280 },
  },
  { timestamps: true, toJSON: { transform } },
);

holdingSchema.index({ portfolioId: 1, exchange: 1, symbol: 1 });
holdingSchema.index({ portfolioId: 1, schemeCode: 1 });

export const Portfolio = model<PortfolioDocument, Model<PortfolioDocument>>('Portfolio', portfolioSchema);
export const Holding = model<HoldingDocument, Model<HoldingDocument>>('Holding', holdingSchema);
