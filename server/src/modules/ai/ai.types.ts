import type { Exchange } from '../../types/market.js';

export const ANALYSIS_ENGINES = ['openai', 'rules'] as const;
export type AnalysisEngine = (typeof ANALYSIS_ENGINES)[number];

export type SignalVerdict = 'strong' | 'neutral' | 'weak';

export interface Signal {
  id: string;
  label: string;
  verdict: SignalVerdict;
  detail: string;
  value: number | null;
  benchmark: number | null;
}

export interface ScoreBreakdown {
  valuation: number;
  profitability: number;
  growth: number;
  balanceSheet: number;
  momentum: number;
}

export interface StockAnalysis {
  symbol: string;
  exchange: Exchange;
  companyName: string;
  engine: AnalysisEngine;
  model: string | null;
  businessSummary: string;
  strengths: string[];
  weaknesses: string[];
  growthPotential: string;
  financialHealth: string;
  valuation: string;
  risks: string[];
  competitors: string[];
  shortTermOutlook: string;
  longTermOutlook: string;
  investorFit: string;
  overallScore: number;
  scoreLabel: string;
  scoreBreakdown: ScoreBreakdown;
  signals: Signal[];
  dataCaveat: string | null;
  generatedAt: string;
}

export interface AnalysisStatus {
  healthy: boolean;
  lastError: string | null;
  lastErrorAt: string | null;
  configured: boolean;
  model: string | null;
  engine: AnalysisEngine;
  note: string;
}

export interface HoldingVerdictSummary {
  symbol: string;
  name: string;
  weight: number;
  assetType: 'EQUITY' | 'MUTUAL_FUND';
  valuation: 'expensive' | 'fair' | 'cheap' | 'unknown';
  quality: 'strong' | 'average' | 'weak' | 'unknown';
  reason: string;
}

export interface PortfolioAnalysis {
  portfolioId: string;
  portfolioName: string;
  engine: AnalysisEngine;
  model: string | null;
  summary: string;
  riskAnalysis: string;
  diversificationComment: string;
  suggestions: string[];
  strengths: string[];
  concerns: string[];
  diversificationScore: number;
  diversificationLabel: string;
  healthScore: number;
  healthLabel: string;
  breakdown: {
    concentration: number;
    sectors: number;
    assetClasses: number;
    geography: number;
    positionCount: number;
  };
  concentration: {
    herfindahl: number;
    topWeight: number;
    topThreeWeight: number;
    topHolding: string | null;
  };
  drawdown: { maxDrawdownPercent: number | null; peakToTroughDays: number | null };
  strongPositions: HoldingVerdictSummary[];
  weakPositions: HoldingVerdictSummary[];
  overvalued: HoldingVerdictSummary[];
  undervalued: HoldingVerdictSummary[];
  sectorImbalance: { sector: string; weight: number } | null;
  signals: Signal[];
  dataCaveat: string | null;
  generatedAt: string;
}
