import { createHash } from 'node:crypto';
import { isDatabaseConnected } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../utils/ApiError.js';
import { securityKey, type SecurityRef } from '../../types/market.js';
import { cachePeek, cacheSet } from '../market/market.cache.js';
import { getStockDetail } from '../market/market.service.js';
import { AiReport } from './analysis.model.js';
import { buildNarrative, type Narrative } from './analysis.narrative.js';
import { ANALYSIS_SCHEMA, buildAnalysisMessages } from './analysis.prompt.js';
import { evaluate } from './analysis.rules.js';
import { activeModel, completeStructured, isOpenAiConfigured } from './openai.client.js';
import type { AnalysisStatus, PortfolioAnalysis, StockAnalysis } from './ai.types.js';
import { getPortfolio, portfolioPerformance } from '../portfolio/portfolio.service.js';
import { getFundamentals } from '../market/market.service.js';
import { evaluatePortfolio } from './portfolio.rules.js';
import { buildPortfolioNarrative, type PortfolioNarrative } from './portfolio.narrative.js';
import { buildPortfolioMessages, PORTFOLIO_ANALYSIS_SCHEMA } from './portfolio.prompt.js';
import { PortfolioReport } from './portfolioReport.model.js';
import type { Types } from 'mongoose';
import { hasLiveProvider, type Fundamentals } from '../market/providers/index.js';

const REPORT_TTL_MS = 24 * 60 * 60 * 1000;
const MEMORY_TTL_MS = 30 * 60 * 1000;

const SIMULATED_CAVEAT =
  'These figures are simulated sample data, not filed financials. Connect a market data provider API key to analyse the real numbers.';

function hashInputs(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
}

function memoryKey(ref: SecurityRef, inputsHash: string): string {
  return `ai:${securityKey(ref)}:${inputsHash}`;
}

async function readCached(ref: SecurityRef, inputsHash: string): Promise<StockAnalysis | null> {
  const local = cachePeek<StockAnalysis>(memoryKey(ref, inputsHash));
  if (local) return local;

  if (!isDatabaseConnected()) return null;

  const stored = await AiReport.findOne({
    exchange: ref.exchange,
    symbol: ref.symbol.toUpperCase(),
    inputsHash,
    expiresAt: { $gt: new Date() },
  }).lean();

  return (stored?.analysis as StockAnalysis | undefined) ?? null;
}

async function persist(
  ref: SecurityRef,
  inputsHash: string,
  analysis: StockAnalysis,
  usage: { promptTokens: number; completionTokens: number },
): Promise<void> {
  cacheSet(memoryKey(ref, inputsHash), MEMORY_TTL_MS, analysis);

  if (!isDatabaseConnected()) return;

  await AiReport.updateOne(
    { exchange: ref.exchange, symbol: ref.symbol.toUpperCase(), inputsHash },
    {
      $set: {
        engine: analysis.engine,
        aiModel: analysis.model,
        analysis,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        expiresAt: new Date(Date.now() + REPORT_TTL_MS),
      },
    },
    { upsert: true },
  ).catch((error: Error) => logger.warn('Could not persist AI report', { error: error.message }));
}

export interface AnalysisOptions {
  refresh?: boolean;
}

// A configured key is not the same as a working one. Remember the last failure so the status
// endpoint stops advertising a model that is, in practice, never answering.
let lastFailure: { message: string; at: string } | null = null;

function recordAiFailure(error: unknown): void {
  lastFailure = {
    message: error instanceof Error ? error.message : 'Unknown error',
    at: new Date().toISOString(),
  };
}

function recordAiSuccess(): void {
  lastFailure = null;
}

export async function getStockAnalysis(ref: SecurityRef, options: AnalysisOptions = {}): Promise<StockAnalysis> {
  const detail = await getStockDetail(ref, '1M');
  const { quote, profile, fundamentals } = detail;

  const simulated = quote.source === 'sample' || fundamentals?.source === 'sample';
  const rules = evaluate({ quote, profile, fundamentals });

  const inputsHash = hashInputs({
    fundamentals: fundamentals
      ? { valuation: fundamentals.valuation, profitability: fundamentals.profitability, growth: fundamentals.growth }
      : null,
    breakdown: rules.breakdown,
    // The data source is part of the input: a report written from simulated figures must not be
    // served once a real provider can price the same company.
    sources: [quote.source, fundamentals?.source ?? 'none'],
    engine: isOpenAiConfigured() ? activeModel() : 'rules',
    day: new Date().toISOString().slice(0, 10),
  });

  if (!options.refresh) {
    const cached = await readCached(ref, inputsHash);
    if (cached) return cached;
  }

  const base = {
    symbol: quote.symbol,
    exchange: quote.exchange,
    companyName: profile?.name ?? quote.symbol,
    overallScore: rules.overallScore,
    scoreLabel: rules.scoreLabel,
    scoreBreakdown: rules.breakdown,
    signals: rules.signals,
    dataCaveat: simulated ? SIMULATED_CAVEAT : null,
    generatedAt: new Date().toISOString(),
  };

  if (isOpenAiConfigured()) {
    try {
      const completion = await completeStructured<Narrative>({
        messages: buildAnalysisMessages({ quote, profile, fundamentals, rules, simulated }),
        schemaName: 'stock_analysis',
        schema: ANALYSIS_SCHEMA,
      });

      recordAiSuccess();

      const analysis: StockAnalysis = {
        ...base,
        ...completion.data,
        engine: 'openai',
        model: completion.model,
      };

      await persist(ref, inputsHash, analysis, {
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
      });

      return analysis;
    } catch (error) {
      recordAiFailure(error);
      logger.warn('AI report fell back to the rule engine', {
        symbol: securityKey(ref),
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  const analysis: StockAnalysis = {
    ...base,
    ...buildNarrative({ quote, profile, fundamentals, rules }),
    engine: 'rules',
    model: null,
  };

  await persist(ref, inputsHash, analysis, { promptTokens: 0, completionTokens: 0 });
  return analysis;
}

export function getAnalysisStatus(): AnalysisStatus {
  const configured = isOpenAiConfigured();
  const healthy = configured && !lastFailure;

  const note = !configured
    ? 'OPENAI_API_KEY is not set, so reports come from the built-in rule engine instead of a language model.'
    : lastFailure
      ? `A key is set, but the last call to ${activeModel()} failed, so reports are coming from the rule engine: ${lastFailure.message}`
      : `Reports are written by ${activeModel()} from verified figures and cached for 24 hours.`;

  return {
    configured,
    healthy,
    model: configured ? activeModel() : null,
    engine: healthy ? 'openai' : 'rules',
    lastError: lastFailure?.message ?? null,
    lastErrorAt: lastFailure?.at ?? null,
    note,
  };
}

export async function clearAnalysis(ref: SecurityRef): Promise<void> {
  if (!isDatabaseConnected()) return;
  await AiReport.deleteMany({ exchange: ref.exchange, symbol: ref.symbol.toUpperCase() });
}

export function assertAiAvailable(): void {
  if (!isOpenAiConfigured()) throw ApiError.badRequest('OPENAI_API_KEY is not configured on this server.');
}


const PORTFOLIO_SIMULATED_CAVEAT =
  'The prices behind these figures are simulated sample data. Connect a market data provider API key to analyse live values.';

async function fundamentalsForHoldings(
  holdings: Array<{ assetType: string; symbol: string; exchange: string | null }>,
): Promise<Map<string, Fundamentals>> {
  const equities = holdings.filter((holding) => holding.assetType === 'EQUITY' && holding.exchange).slice(0, 25);
  const table = new Map<string, Fundamentals>();

  await Promise.all(
    equities.map(async (holding) => {
      try {
        const fundamentals = await getFundamentals({
          symbol: holding.symbol,
          exchange: holding.exchange as never,
        });
        table.set(`${holding.exchange}:${holding.symbol}`, fundamentals);
      } catch {
        /* a missing fundamentals record only weakens the classification */
      }
    }),
  );

  return table;
}

export async function getPortfolioAnalysis(
  userId: Types.ObjectId,
  portfolioId: string,
  options: AnalysisOptions = {},
): Promise<PortfolioAnalysis> {
  const valuation = await getPortfolio(userId, portfolioId);

  if (!valuation.holdings.length) {
    throw ApiError.badRequest('Add at least one holding before running a portfolio review.');
  }

  const [fundamentals, performance] = await Promise.all([
    fundamentalsForHoldings(valuation.holdings),
    portfolioPerformance(userId, portfolioId, '1Y').catch(() => []),
  ]);

  const rules = evaluatePortfolio(valuation, fundamentals, performance);
  const simulated = !hasLiveProvider('quote');

  const inputsHash = hashInputs({
    holdings: valuation.holdings.map((holding) => [holding.symbol, holding.weight]),
    scores: [rules.diversificationScore, rules.healthScore],
    engine: isOpenAiConfigured() ? activeModel() : 'rules',
    day: new Date().toISOString().slice(0, 10),
  });

  if (!options.refresh) {
    // Ownership is already proven by getPortfolio above; scoping the cache by user as well means
    // a future refactor cannot turn this into a cross-account read.
    const cached = await PortfolioReport.findOne({
      userId,
      portfolioId: valuation.id,
      inputsHash,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (cached?.analysis) return cached.analysis as PortfolioAnalysis;
  }

  const base = {
    portfolioId: valuation.id,
    portfolioName: valuation.name,
    diversificationScore: rules.diversificationScore,
    diversificationLabel: rules.diversificationLabel,
    healthScore: rules.healthScore,
    healthLabel: rules.healthLabel,
    breakdown: rules.breakdown,
    concentration: rules.concentration,
    drawdown: rules.drawdown,
    strongPositions: rules.strongPositions,
    weakPositions: rules.weakPositions,
    overvalued: rules.overvalued,
    undervalued: rules.undervalued,
    sectorImbalance: rules.sectorImbalance,
    signals: rules.signals,
    dataCaveat: simulated ? PORTFOLIO_SIMULATED_CAVEAT : null,
    generatedAt: new Date().toISOString(),
  };

  let analysis: PortfolioAnalysis;
  let usage = { promptTokens: 0, completionTokens: 0 };

  if (isOpenAiConfigured()) {
    try {
      const completion = await completeStructured<PortfolioNarrative>({
        messages: buildPortfolioMessages(valuation, rules, simulated),
        schemaName: 'portfolio_analysis',
        schema: PORTFOLIO_ANALYSIS_SCHEMA,
        maxTokens: 1400,
      });

      analysis = { ...base, ...completion.data, engine: 'openai', model: completion.model };
      usage = { promptTokens: completion.promptTokens, completionTokens: completion.completionTokens };
    } catch (error) {
      recordAiFailure(error);
      logger.warn('Portfolio review fell back to the rule engine', {
        portfolio: valuation.id,
        error: error instanceof Error ? error.message : 'unknown',
      });
      analysis = { ...base, ...buildPortfolioNarrative(valuation, rules), engine: 'rules', model: null };
    }
  } else {
    analysis = { ...base, ...buildPortfolioNarrative(valuation, rules), engine: 'rules', model: null };
  }

  if (isDatabaseConnected()) {
    await PortfolioReport.updateOne(
      { userId, portfolioId: valuation.id, inputsHash },
      {
        $set: {
          userId,
          engine: analysis.engine,
          aiModel: analysis.model,
          analysis,
          ...usage,
          expiresAt: new Date(Date.now() + REPORT_TTL_MS),
        },
      },
      { upsert: true },
    ).catch((error: Error) => logger.warn('Could not persist portfolio review', { error: error.message }));
  }

  return analysis;
}
