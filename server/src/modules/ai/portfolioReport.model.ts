import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import { ANALYSIS_ENGINES, type AnalysisEngine, type PortfolioAnalysis } from './ai.types.js';

export interface PortfolioReportDocument extends Document<Types.ObjectId> {
  userId: Types.ObjectId;
  portfolioId: Types.ObjectId;
  engine: AnalysisEngine;
  aiModel: string | null;
  inputsHash: string;
  analysis: PortfolioAnalysis;
  promptTokens: number;
  completionTokens: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const portfolioReportSchema = new Schema<PortfolioReportDocument, Model<PortfolioReportDocument>>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    portfolioId: { type: Schema.Types.ObjectId, ref: 'Portfolio', required: true },
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

portfolioReportSchema.index({ userId: 1, portfolioId: 1, inputsHash: 1 }, { unique: true });
portfolioReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PortfolioReport = model<PortfolioReportDocument, Model<PortfolioReportDocument>>(
  'PortfolioReport',
  portfolioReportSchema,
);
