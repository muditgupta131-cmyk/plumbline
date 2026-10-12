import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import { ASSET_TYPES, EXCHANGES, type AssetType, type Exchange } from '../../types/market.js';

export const ALERT_TYPES = ['PRICE_ABOVE', 'PRICE_BELOW', 'PERCENT_MOVE'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export interface WatchlistItemDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  assetType: AssetType;
  symbol: string;
  exchange: Exchange | null;
  schemeCode: string | null;
  name: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  assetType: AssetType;
  symbol: string;
  exchange: Exchange | null;
  schemeCode: string | null;
  name: string;
  type: AlertType;
  threshold: number;
  active: boolean;
  lastTriggeredAt?: Date;
  lastValue?: number;
  triggerCount: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const transform = (_doc: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const watchlistItemSchema = new Schema<WatchlistItemDocument, Model<WatchlistItemDocument>>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assetType: { type: String, required: true, enum: ASSET_TYPES, default: 'EQUITY' },
    symbol: { type: String, required: true, trim: true },
    exchange: { type: String, enum: [...EXCHANGES, null], default: null },
    schemeCode: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, maxlength: 280 },
  },
  { timestamps: true, toJSON: { transform } },
);

watchlistItemSchema.index({ userId: 1, exchange: 1, symbol: 1 });
watchlistItemSchema.index({ userId: 1, schemeCode: 1 });

const alertSchema = new Schema<AlertDocument, Model<AlertDocument>>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assetType: { type: String, required: true, enum: ASSET_TYPES, default: 'EQUITY' },
    symbol: { type: String, required: true, trim: true },
    exchange: { type: String, enum: [...EXCHANGES, null], default: null },
    schemeCode: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ALERT_TYPES },
    threshold: { type: Number, required: true },
    active: { type: Boolean, default: true, index: true },
    lastTriggeredAt: { type: Date },
    lastValue: { type: Number },
    triggerCount: { type: Number, default: 0 },
    note: { type: String, trim: true, maxlength: 280 },
  },
  { timestamps: true, toJSON: { transform } },
);

export const WatchlistItem = model<WatchlistItemDocument, Model<WatchlistItemDocument>>(
  'WatchlistItem',
  watchlistItemSchema,
);

export const Alert = model<AlertDocument, Model<AlertDocument>>('Alert', alertSchema);
