import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import { BROKER_IDS, type BrokerId } from './adapters/types.js';

export interface BrokerConnectionDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  broker: BrokerId;
  label: string;
  credentials: string;
  hint: string;
  lastSyncedAt?: Date;
  lastError?: string;
  holdingsSynced: number;
  createdAt: Date;
  updatedAt: Date;
}

const brokerConnectionSchema = new Schema<BrokerConnectionDocument, Model<BrokerConnectionDocument>>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    broker: { type: String, required: true, enum: BROKER_IDS },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    credentials: { type: String, required: true, select: false },
    hint: { type: String, required: true },
    lastSyncedAt: { type: Date },
    lastError: { type: String },
    holdingsSynced: { type: Number, default: 0 },
  },
  { timestamps: true },
);

brokerConnectionSchema.index({ userId: 1, broker: 1 }, { unique: true });

export const BrokerConnection = model<BrokerConnectionDocument, Model<BrokerConnectionDocument>>(
  'BrokerConnection',
  brokerConnectionSchema,
);
