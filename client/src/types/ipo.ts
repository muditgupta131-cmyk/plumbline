export type IpoStatus = 'open' | 'upcoming' | 'closed' | 'listed';
export type IpoBoard = 'mainboard' | 'sme';

export interface IpoGmp {
  premium: number;
  premiumPercent: number | null;
  estimatedListing: number | null;
  trend: 'up' | 'down' | 'flat' | null;
  updatedAt: string | null;
  source: string;
}

export interface IpoSubscriptionCategory {
  label: string;
  key: 'qib' | 'nii' | 'rii' | 'employee' | 'other';
  times: number;
  offered: number | null;
  bid: number | null;
}

export interface IpoSubscription {
  total: number | null;
  categories: IpoSubscriptionCategory[];
  source: string;
}

export interface IpoSummary {
  symbol: string | null;
  slug: string;
  name: string;
  board: IpoBoard;
  status: IpoStatus;
  priceBand: { min: number | null; max: number | null; label: string | null };
  issueSize: number | null;
  openDate: string | null;
  closeDate: string | null;
  listingDate: string | null;
  dateLabel: string | null;
  gmp: IpoGmp | null;
  subscription: IpoSubscription | null;
}

export interface GmpBaseRate {
  band: string;
  sampleSize: number;
  medianActual: number;
  positiveRate: number;
  medianGmpError: number;
}

export interface IpoCalibration {
  sampleSize: number;
  directionalAccuracy: number;
  medianGmpError: number;
  bands: GmpBaseRate[];
  updatedAt: string;
}

export interface IpoSignal {
  label: string;
  verdict: 'strong' | 'fair' | 'weak' | 'unknown';
  detail: string;
}

export interface IpoAnalysis {
  score: number | null;
  stance: 'apply' | 'consider' | 'avoid' | 'insufficient';
  headline: string;
  signals: IpoSignal[];
  caveats: string[];
}

export interface IpoDetail extends IpoSummary {
  analysis: IpoAnalysis;
  calibration: IpoCalibration | null;
  sources: { listing: string; gmp: string | null; subscription: string | null };
}

export interface IpoList {
  ipos: IpoSummary[];
  calibration: IpoCalibration | null;
}
