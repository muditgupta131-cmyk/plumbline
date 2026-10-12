export interface SectorBenchmark {
  pe: number;
  ps: number;
  grossMargin: number | null;
  netMargin: number;
  roe: number;
  debtToEquity: number;
  dividendYield: number;
  growth: number;
}

export const SECTOR_BENCHMARKS: Record<string, SectorBenchmark> = {
  Technology: { pe: 28, ps: 6.2, grossMargin: 58, netMargin: 19, roe: 25, debtToEquity: 0.3, dividendYield: 0.9, growth: 14 },
  Financials: { pe: 16, ps: 3.4, grossMargin: null, netMargin: 22, roe: 16, debtToEquity: 1.6, dividendYield: 1.4, growth: 12 },
  Healthcare: { pe: 24, ps: 4.5, grossMargin: 52, netMargin: 16, roe: 18, debtToEquity: 0.4, dividendYield: 1.1, growth: 10 },
  Energy: { pe: 12, ps: 1.1, grossMargin: 28, netMargin: 8, roe: 13, debtToEquity: 0.6, dividendYield: 3.2, growth: 6 },
  'Consumer Staples': { pe: 38, ps: 4.8, grossMargin: 45, netMargin: 13, roe: 28, debtToEquity: 0.3, dividendYield: 2.1, growth: 8 },
  'Consumer Discretionary': { pe: 30, ps: 3.2, grossMargin: 38, netMargin: 9, roe: 19, debtToEquity: 0.5, dividendYield: 0.8, growth: 13 },
  Industrials: { pe: 26, ps: 2.6, grossMargin: 32, netMargin: 10, roe: 17, debtToEquity: 0.5, dividendYield: 1.2, growth: 11 },
  Materials: { pe: 18, ps: 1.9, grossMargin: 26, netMargin: 9, roe: 14, debtToEquity: 0.7, dividendYield: 1.8, growth: 7 },
  Communication: { pe: 22, ps: 3.1, grossMargin: 48, netMargin: 14, roe: 15, debtToEquity: 0.8, dividendYield: 1.5, growth: 9 },
  Utilities: { pe: 17, ps: 2.2, grossMargin: 34, netMargin: 12, roe: 12, debtToEquity: 1.2, dividendYield: 3.4, growth: 5 },
  'Real Estate': { pe: 21, ps: 5.4, grossMargin: 42, netMargin: 18, roe: 11, debtToEquity: 0.9, dividendYield: 2.4, growth: 8 },
  Unclassified: { pe: 22, ps: 3.0, grossMargin: 36, netMargin: 12, roe: 15, debtToEquity: 0.6, dividendYield: 1.2, growth: 9 },
};

export function benchmarkFor(sector: string | null | undefined): SectorBenchmark {
  return SECTOR_BENCHMARKS[sector ?? 'Unclassified'] ?? SECTOR_BENCHMARKS.Unclassified;
}
