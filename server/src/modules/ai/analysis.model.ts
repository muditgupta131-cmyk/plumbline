import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import { EXCHANGES, type Exchange } from '../../types/market.js';
import { ANALYSIS_ENGINES, type AnalysisEngine, type StockAnalysis } from './ai.types.js';

export interface AiReportDocument extends Document<Types.ObjectId> {
  symbol: string;
  exchange: Exchange;
  engine: AnalysisEngine;
  aiModel: string | null;
  inputsHash: string;
  analysis: StockAnalysis;
  promptTokens: number;
  completionTokens: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const aiReportSchema = new Schema<AiReportDocument, Model<AiReportDocument>>(
  {
    symbol: { type: String, required: true, uppercase: true },
    exchange: { type: String, required: true, enum: EXCHANGES },
    engine: { type: String, required: true, enum: ANALYSIS_ENGINES },
    aiModel: { type: String, default: null },
    inputsHash: { type: String, required: true },
    analysis: { type: Schema.Types.Mixed, required: true },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

aiReportSchema.index({ exchange: 1, symbol: 1, inputsHash: 1 }, { unique: true });
aiReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AiReport = model<AiReportDocument, Model<AiReportDocument>>('AiReport', aiReportSchema);
