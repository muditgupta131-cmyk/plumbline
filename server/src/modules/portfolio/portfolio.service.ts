import type { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import {
  currencyForExchange,
  CURRENCIES,
  EXCHANGE_MARKET,
  type Exchange,
  securityKey,
  type Currency,
  type Market,
  type SecurityRef,
} from '../../types/market.js';
import { getFund, getFunds, getNavHistory } from '../funds/fund.service.js';
import { cached } from '../market/market.cache.js';
import { getCandles, getFundamentals, getFxRate, getQuotes } from '../market/market.service.js';
import { lookupSymbols } from '../market/symbol.service.js';
import type { CandleRange } from '../market/providers/index.js';
import { hasLiveProvider } from '../market/providers/index.js';
import { Holding, Portfolio, type HoldingDocument, type PortfolioDocument } from './portfolio.model.js';
import { ledgerByPosition, ledgerCashFlows, positionXirr, replayLedger } from './ledger.service.js';
import { Transaction } from './transaction.model.js';
import { annualisedPercent, xirr, type CashFlow } from '../../utils/xirr.js';
import type {
  AllocationSlice,
  HoldingInput,
  PerformancePoint,
  PortfolioSummary,
  PortfolioTotals,
  PortfolioValuation,
  ValuedHolding,
} from './portfolio.types.js';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

const RANGE_HISTORY_DAYS: Record<CandleRange, number> = {
  '1D': 30,
  '1W': 30,
  '1M': 40,
  '6M': 200,
  '1Y': 380,
  '5Y': 1850,
};
const DIVIDEND_LOOKUP_LIMIT = 25;
const PERFORMANCE_TTL = 15 * 60_000;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function fxTable(currencies: Set<Currency>, base: Currency): Promise<Map<Currency, number>> {
  const rates = new Map<Currency, number>();

  await Promise.all(
    [...currencies].map(async (currency) => {
      const { rate } = await getFxRate(currency, base);
      rates.set(currency, rate);
    }),
  );

  return rates;
}

async function dividendTable(refs: SecurityRef[]): Promise<Map<string, number>> {
  const table = new Map<string, number>();

  await Promise.all(
    refs.slice(0, DIVIDEND_LOOKUP_LIMIT).map(async (ref) => {
      try {
        const fundamentals = await getFundamentals(ref);
        const perShare = fundamentals.perShare.dividendPerShare;
        if (perShare) table.set(securityKey(ref), perShare);
      } catch {
        /* dividends are optional */
      }
    }),
  );

  return table;
}

function toSlices(
  rows: Array<{ key: string; label: string; value: number; pnl: number }>,
  total: number,
): AllocationSlice[] {
  const grouped = new Map<string, AllocationSlice>();

  for (const row of rows) {
    const existing = grouped.get(row.key);
    if (existing) {
      existing.value += row.value;
      existing.pnl += row.pnl;
    } else {
      grouped.set(row.key, { key: row.key, label: row.label, value: row.value, weight: 0, pnl: row.pnl });
    }
  }

  return [...grouped.values()]
    .map((slice) => ({
      ...slice,
      value: round(slice.value),
      pnl: round(slice.pnl),
      weight: total > 0 ? round((slice.value / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function holdingKey(holding: { assetType: string; schemeCode: string | null; symbol: string; exchange: string | null }): string {
  return holding.assetType === 'MUTUAL_FUND' ? `MF:${holding.schemeCode}` : `${holding.exchange}:${holding.symbol.toUpperCase()}`;
}

export async function valuePortfolio(
  portfolio: PortfolioDocument,
  holdings: HoldingDocument[],
): Promise<PortfolioValuation> {
  // Asked once per valuation rather than per holding: it only depends on what is configured.
  const liveQuotesAvailable = hasLiveProvider('quote');
  const base = portfolio.baseCurrency;

  const equities = holdings.filter((holding) => holding.assetType !== 'MUTUAL_FUND' && holding.exchange);
  const funds = holdings.filter((holding) => holding.assetType === 'MUTUAL_FUND' && holding.schemeCode);

  const refs: SecurityRef[] = equities.map((holding) => ({
    symbol: holding.symbol,
    exchange: holding.exchange!,
  }));

  const [{ quotes }, metadata, rates, dividends, schemes, ledger] = await Promise.all([
    refs.length ? getQuotes(refs) : Promise.resolve({ quotes: [], failed: [] }),
    lookupSymbols(refs),
    fxTable(new Set<Currency>([...CURRENCIES, base]), base),
    refs.length ? dividendTable(refs) : Promise.resolve(new Map<string, number>()),
    funds.length ? getFunds(funds.map((holding) => holding.schemeCode!)) : Promise.resolve(new Map()),
    ledgerByPosition(portfolio._id),
  ]);

  const quoteMap = new Map(quotes.map((quote) => [securityKey(quote), quote]));
  const now = Date.now();

  const valued: ValuedHolding[] = holdings.map((holding) => {
    const isFund = holding.assetType === 'MUTUAL_FUND';
    const key = holdingKey(holding);
    const fxRate = rates.get(holding.currency) ?? 1;

    const scheme = isFund ? schemes.get(holding.schemeCode!) : undefined;
    const meta = isFund ? undefined : metadata.get(key);

    // With no market provider configured the sample generator is the intended source, and the portfolio
    // runs on it end to end. But once real providers are connected and every one of them refuses a
    // symbol, that refusal is the finding: the security is not trading. An IPO allotment carries no
    // market price until it lists, and generating one reported a 38% gain on a share that had never
    // traded. So a generated price is only trusted where nothing better could exist.
    const upstreamQuote = isFund ? undefined : quoteMap.get(key);
    const quote = upstreamQuote?.source === 'sample' && liveQuotesAvailable ? undefined : upstreamQuote;

    const price = isFund ? (scheme?.nav ?? null) : (quote?.price ?? null);
    const priced = price !== null;

    const investedLocal = holding.quantity * holding.avgBuyPrice;
    const valueLocal = price === null ? null : holding.quantity * price;
    const invested = investedLocal * fxRate;
    const value = valueLocal === null ? null : valueLocal * fxRate;
    const pnl = value === null ? null : value - invested;

    const holdingPeriodYears = Math.max(0, (now - holding.buyDate.getTime()) / MS_PER_YEAR);
    const cagr =
      value !== null && invested > 0 && holdingPeriodYears >= 0.25
        ? round(((value / invested) ** (1 / holdingPeriodYears) - 1) * 100)
        : null;

    const dividendPerShare = isFund ? null : (dividends.get(key) ?? null);
    const market: Market = isFund ? 'IN' : EXCHANGE_MARKET[holding.exchange!];

    const entries = ledger.get(key) ?? [];
    const replay = entries.length ? replayLedger(entries) : null;

    return {
      id: holding._id.toString(),
      assetType: isFund ? 'MUTUAL_FUND' : 'EQUITY',
      symbol: holding.symbol,
      exchange: isFund ? null : holding.exchange,
      schemeCode: holding.schemeCode,
      fundHouse: scheme?.fundHouse ?? null,
      navDate: scheme?.navDate ?? null,
      market,
      name: isFund ? (scheme?.name ?? holding.symbol) : (meta?.name ?? holding.symbol),
      sector: isFund ? (scheme?.category ?? 'Mutual fund') : (meta?.sector ?? 'Unclassified'),
      currency: holding.currency,
      quantity: holding.quantity,
      avgBuyPrice: holding.avgBuyPrice,
      buyDate: holding.buyDate.toISOString(),
      ...(holding.notes ? { notes: holding.notes } : {}),
      price,
      dayChangePercent: quote?.changePercent ?? null,
      investedLocal: round(investedLocal),
      valueLocal: valueLocal === null ? null : round(valueLocal),
      invested: round(invested),
      value: value === null ? null : round(value),
      pnl: pnl === null ? null : round(pnl),
      pnlPercent: pnl === null || invested === 0 ? null : round((pnl / invested) * 100),
      dayPnl:
        quote && value !== null && quote.changePercent !== null
          ? round(value - value / (1 + quote.changePercent / 100))
          : null,
      weight: 0,
      holdingPeriodYears: round(holdingPeriodYears, 2),
      cagr,
      annualDividend: dividendPerShare === null ? null : round(dividendPerShare * holding.quantity * fxRate),
      fxRate: round(fxRate, 4),
      priced,
      priceSource: isFund ? (scheme ? 'amfi' : null) : (quote?.source ?? null),
      xirr: entries.length && valueLocal !== null ? positionXirr(entries, valueLocal) : null,
      realisedGain: replay ? round(replay.realisedGain * fxRate) : null,
      dividendsReceived: replay ? round(replay.dividends * fxRate) : null,
      transactionCount: entries.length,
    };
  });

  const totalValue = valued.reduce((sum, holding) => sum + (holding.value ?? 0), 0);
  const totalInvested = valued.reduce((sum, holding) => sum + holding.invested, 0);
  const pricedInvested = valued
    .filter((holding) => holding.priced)
    .reduce((sum, holding) => sum + holding.invested, 0);
  const totalDayPnl = valued.reduce((sum, holding) => sum + (holding.dayPnl ?? 0), 0);
  const annualDividend = valued.reduce((sum, holding) => sum + (holding.annualDividend ?? 0), 0);

  for (const holding of valued) {
    holding.weight = totalValue > 0 ? round(((holding.value ?? 0) / totalValue) * 100) : 0;
  }

  const cagrContributors = valued.filter((holding) => holding.cagr !== null && holding.invested > 0);
  const cagrBase = cagrContributors.reduce((sum, holding) => sum + holding.invested, 0);
  const portfolioCagr = cagrBase
    ? round(cagrContributors.reduce((sum, holding) => sum + holding.cagr! * holding.invested, 0) / cagrBase)
    : null;

  const baseRateFor = (currency: Currency) => rates.get(currency) ?? 1;

  const portfolioFlows: CashFlow[] = [];
  let realisedTotal = 0;
  let dividendsTotal = 0;

  // Only positions with a recorded ledger can contribute to a money-weighted return: pairing
  // ledger cash flows against the whole portfolio value would count holdings that have no flows.
  const ledgerValue = valued
    .filter((holding) => ledger.has(holdingKey(holding)))
    .reduce((sum, holding) => sum + (holding.value ?? 0), 0);

  for (const entries of ledger.values()) {
    const rate = baseRateFor(entries[0].currency);
    const replay = replayLedger(entries);

    realisedTotal += replay.realisedGain * rate;
    dividendsTotal += replay.dividends * rate;

    for (const flow of ledgerCashFlows(entries)) {
      portfolioFlows.push({ date: flow.date, amount: flow.amount * rate });
    }
  }

  if (ledgerValue > 0 && portfolioFlows.length) portfolioFlows.push({ date: new Date(), amount: ledgerValue });

  const totals: PortfolioTotals = {
    invested: round(totalInvested),
    value: round(totalValue),
    pnl: round(totalValue - pricedInvested),
    pnlPercent: pricedInvested > 0 ? round(((totalValue - pricedInvested) / pricedInvested) * 100) : 0,
    dayPnl: round(totalDayPnl),
    dayPnlPercent: totalValue > 0 && totalValue !== totalDayPnl ? round((totalDayPnl / (totalValue - totalDayPnl)) * 100) : 0,
    annualDividend: round(annualDividend),
    dividendYield: totalValue > 0 ? round((annualDividend / totalValue) * 100) : 0,
    cagr: portfolioCagr,
    xirr: portfolioFlows.length ? annualisedPercent(xirr(portfolioFlows)) : null,
    realisedGain: round(realisedTotal),
    dividendsReceived: round(dividendsTotal),
    ledgerPositions: ledger.size,
    holdings: valued.length,
    pricedHoldings: valued.filter((holding) => holding.priced).length,
    equityValue: round(valued.filter((h) => h.assetType === 'EQUITY').reduce((sum, h) => sum + (h.value ?? 0), 0)),
    fundValue: round(valued.filter((h) => h.assetType === 'MUTUAL_FUND').reduce((sum, h) => sum + (h.value ?? 0), 0)),
  };

  const rows = valued.map((holding) => ({
    value: holding.value ?? 0,
    pnl: holding.pnl ?? 0,
    holding,
  }));

  return {
    id: portfolio._id.toString(),
    name: portfolio.name,
    baseCurrency: base,
    isDefault: portfolio.isDefault,
    totals,
    updatedAt: portfolio.updatedAt.toISOString(),
    holdings: valued.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    allocation: {
      byHolding: toSlices(
        rows.map((row) => ({ key: holdingKey(row.holding), label: row.holding.symbol, ...row })),
        totalValue,
      ),
      bySector: toSlices(
        rows.map((row) => ({ key: row.holding.sector, label: row.holding.sector, ...row })),
        totalValue,
      ),
      byMarket: toSlices(
        rows.map((row) => ({
          key: row.holding.market,
          label: row.holding.market === 'IN' ? 'India' : 'United States',
          ...row,
        })),
        totalValue,
      ),
      byExchange: toSlices(
        rows.map((row) => ({
          key: row.holding.exchange ?? 'Mutual fund',
          label: row.holding.exchange ?? 'Mutual fund',
          ...row,
        })),
        totalValue,
      ),
      byAssetClass: toSlices(
        rows.map((row) => ({
          key: row.holding.assetType,
          label: row.holding.assetType === 'MUTUAL_FUND' ? 'Mutual funds' : 'Stocks',
          ...row,
        })),
        totalValue,
      ),
    },
    unpricedSymbols: valued
      .filter((holding) => !holding.priced)
      .map((holding) => (holding.assetType === 'MUTUAL_FUND' ? holding.name : `${holding.exchange}:${holding.symbol}`)),
    asOf: new Date().toISOString(),
  };
}

export async function listPortfolios(userId: Types.ObjectId): Promise<PortfolioSummary[]> {
  const portfolios = await Portfolio.find({ userId }).sort({ isDefault: -1, createdAt: 1 });

  return Promise.all(
    portfolios.map(async (portfolio) => {
      const holdings = await Holding.find({ portfolioId: portfolio._id });
      const valuation = await valuePortfolio(portfolio, holdings);
      const { holdings: _holdings, allocation: _allocation, ...summary } = valuation;
      return summary;
    }),
  );
}

export async function requirePortfolio(userId: Types.ObjectId, portfolioId: string): Promise<PortfolioDocument> {
  const portfolio = await Portfolio.findOne({ _id: portfolioId, userId });
  if (!portfolio) throw ApiError.notFound('That portfolio does not exist.');
  return portfolio;
}

export async function getPortfolio(userId: Types.ObjectId, portfolioId: string): Promise<PortfolioValuation> {
  const portfolio = await requirePortfolio(userId, portfolioId);
  const holdings = await Holding.find({ portfolioId: portfolio._id }).sort({ createdAt: 1 });
  return valuePortfolio(portfolio, holdings);
}

export async function createPortfolio(
  userId: Types.ObjectId,
  input: { name: string; baseCurrency: Currency },
): Promise<PortfolioDocument> {
  const count = await Portfolio.countDocuments({ userId });
  if (count >= 10) throw ApiError.badRequest('You can keep up to 10 portfolios.');

  // The unique index enforces this too, but only once it exists. Checking here gives a clear
  // message instead of a duplicate-key error, and keeps the data clean enough to index.
  const clash = await Portfolio.findOne({ userId, name: input.name });
  if (clash) throw ApiError.conflict(`You already have a portfolio called "${input.name}".`);

  return Portfolio.create({ ...input, userId, isDefault: count === 0 });
}

export async function updatePortfolio(
  userId: Types.ObjectId,
  portfolioId: string,
  input: { name?: string; baseCurrency?: Currency },
): Promise<PortfolioDocument> {
  const portfolio = await requirePortfolio(userId, portfolioId);

  if (input.name !== undefined && input.name !== portfolio.name) {
    const clash = await Portfolio.findOne({ userId, name: input.name, _id: { $ne: portfolio._id } });
    if (clash) throw ApiError.conflict(`You already have a portfolio called "${input.name}".`);
  }

  if (input.name !== undefined) portfolio.name = input.name;
  if (input.baseCurrency !== undefined) portfolio.baseCurrency = input.baseCurrency;
  await portfolio.save();
  return portfolio;
}

export interface DeletedPortfolio {
  holdings: number;
  transactions: number;
}

export async function deletePortfolio(
  userId: Types.ObjectId,
  portfolioId: string,
): Promise<DeletedPortfolio> {
  const portfolio = await requirePortfolio(userId, portfolioId);

  // The ledger lives in its own collection, so deleting the portfolio alone orphaned every
  // transaction attached to it.
  const [holdings, transactions] = await Promise.all([
    Holding.deleteMany({ portfolioId: portfolio._id }),
    Transaction.deleteMany({ portfolioId: portfolio._id }),
  ]);

  await portfolio.deleteOne();

  return { holdings: holdings.deletedCount ?? 0, transactions: transactions.deletedCount ?? 0 };
}

/**
 * 'add' treats the row as a further purchase and averages it in. 'replace' treats it as the position
 * itself — which is what a statement or broker snapshot reports, where the number printed is the
 * balance held, not an amount bought. Adding a balance to an existing one silently doubles it.
 */
export type HoldingWriteStrategy = 'add' | 'replace';

export async function addHolding(
  userId: Types.ObjectId,
  portfolioId: string,
  input: HoldingInput,
  strategy: HoldingWriteStrategy = 'add',
): Promise<HoldingDocument> {
  const portfolio = await requirePortfolio(userId, portfolioId);

  const count = await Holding.countDocuments({ portfolioId: portfolio._id });
  if (count >= 100) throw ApiError.badRequest('A portfolio can hold up to 100 positions.');

  const assetType = input.assetType ?? 'EQUITY';
  const isFund = assetType === 'MUTUAL_FUND';

  if (isFund && !input.schemeCode) throw ApiError.badRequest('A mutual fund holding needs its AMFI scheme code.');
  if (!isFund && (!input.symbol || !input.exchange)) {
    throw ApiError.badRequest('A stock holding needs a symbol and an exchange.');
  }

  const scheme = isFund ? await getFund(input.schemeCode!) : null;
  const symbol = isFund ? scheme!.name : input.symbol!.toUpperCase();

  const filter = isFund
    ? { portfolioId: portfolio._id, schemeCode: input.schemeCode }
    : { portfolioId: portfolio._id, symbol, exchange: input.exchange };

  const existing = await Holding.findOne(filter);

  if (existing) {
    if (strategy === 'replace') {
      existing.quantity = input.quantity;
      existing.avgBuyPrice = input.avgBuyPrice;
      existing.origin = 'statement';
      if (input.buyDate && new Date(input.buyDate) < existing.buyDate) existing.buyDate = new Date(input.buyDate);
      await existing.save();
      return existing;
    }

    const totalQuantity = existing.quantity + input.quantity;
    existing.avgBuyPrice =
      (existing.quantity * existing.avgBuyPrice + input.quantity * input.avgBuyPrice) / totalQuantity;
    existing.quantity = totalQuantity;
    if (input.buyDate && new Date(input.buyDate) < existing.buyDate) existing.buyDate = new Date(input.buyDate);
    await existing.save();
    return existing;
  }

  return Holding.create({
    portfolioId: portfolio._id,
    userId,
    origin: strategy === 'replace' ? 'statement' : 'manual',
    assetType,
    symbol,
    exchange: isFund ? null : input.exchange,
    schemeCode: isFund ? input.schemeCode : null,
    quantity: input.quantity,
    avgBuyPrice: input.avgBuyPrice,
    currency: isFund ? 'INR' : currencyForExchange(input.exchange!),
    buyDate: input.buyDate ? new Date(input.buyDate) : new Date(),
    notes: input.notes,
  });
}

export interface BrokerSnapshotRow {
  assetType?: 'EQUITY' | 'MUTUAL_FUND';
  symbol?: string;
  exchange?: Exchange;
  schemeCode?: string;
  quantity: number;
  avgBuyPrice: number;
}

export interface ReconcileResult {
  added: number;
  updated: number;
  removed: number;
  skipped: Array<{ symbol: string; reason: string }>;
}

/**
 * A broker sync is a snapshot of what an account holds right now, not a list of new purchases.
 * It therefore *sets* each position rather than adding to it — syncing twice must leave the
 * portfolio unchanged. It only ever touches rows it owns: manual positions and any position with
 * a transaction ledger are left alone, because those carry history a snapshot cannot express.
 */
export async function reconcileBrokerHoldings(
  userId: Types.ObjectId,
  portfolioId: string,
  brokerId: string,
  rows: BrokerSnapshotRow[],
): Promise<ReconcileResult> {
  const portfolio = await requirePortfolio(userId, portfolioId);
  const ledger = await ledgerByPosition(portfolio._id);

  const existing = await Holding.find({ portfolioId: portfolio._id });
  const existingByKey = new Map(existing.map((holding) => [holdingKey(holding), holding]));

  const result: ReconcileResult = { added: 0, updated: 0, removed: 0, skipped: [] };
  const seen = new Set<string>();

  for (const row of rows) {
    const assetType = row.assetType ?? 'EQUITY';
    const isFund = assetType === 'MUTUAL_FUND';

    if (isFund ? !row.schemeCode : !(row.symbol && row.exchange)) {
      result.skipped.push({ symbol: row.symbol ?? row.schemeCode ?? 'unknown', reason: 'incomplete identity' });
      continue;
    }

    const scheme = isFund ? await getFund(row.schemeCode!).catch(() => null) : null;
    if (isFund && !scheme) {
      result.skipped.push({ symbol: row.schemeCode!, reason: 'scheme not found in the AMFI list' });
      continue;
    }

    const symbol = isFund ? scheme!.name : row.symbol!.toUpperCase();
    const key = isFund ? `MF:${row.schemeCode}` : `${row.exchange}:${symbol}`;
    seen.add(key);

    if (ledger.has(key)) {
      result.skipped.push({ symbol, reason: 'has a transaction ledger, which takes precedence' });
      continue;
    }

    const current = existingByKey.get(key);

    if (current) {
      const unchanged = current.quantity === row.quantity && current.avgBuyPrice === row.avgBuyPrice;
      current.quantity = row.quantity;
      current.avgBuyPrice = row.avgBuyPrice;
      current.origin = 'broker';
      current.brokerId = brokerId;
      await current.save();
      if (!unchanged) result.updated += 1;
      continue;
    }

    await Holding.create({
      portfolioId: portfolio._id,
      userId,
      assetType,
      origin: 'broker',
      brokerId,
      symbol,
      exchange: isFund ? null : row.exchange,
      schemeCode: isFund ? row.schemeCode : null,
      quantity: row.quantity,
      avgBuyPrice: row.avgBuyPrice,
      currency: isFund ? 'INR' : currencyForExchange(row.exchange!),
      buyDate: new Date(),
    });
    result.added += 1;
  }

  // Anything this broker put here that it no longer reports has been sold outside Plumbline.
  for (const holding of existing) {
    const key = holdingKey(holding);
    if (holding.origin !== 'broker' || holding.brokerId !== brokerId || seen.has(key)) continue;

    await holding.deleteOne();
    result.removed += 1;
  }

  return result;
}

export async function updateHolding(
  userId: Types.ObjectId,
  portfolioId: string,
  holdingId: string,
  input: Partial<Pick<HoldingInput, 'quantity' | 'avgBuyPrice' | 'buyDate' | 'notes'>>,
): Promise<HoldingDocument> {
  const portfolio = await requirePortfolio(userId, portfolioId);
  const holding = await Holding.findOne({ _id: holdingId, portfolioId: portfolio._id });
  if (!holding) throw ApiError.notFound('That holding does not exist.');

  if (input.quantity !== undefined) holding.quantity = input.quantity;
  if (input.avgBuyPrice !== undefined) holding.avgBuyPrice = input.avgBuyPrice;
  if (input.buyDate !== undefined) holding.buyDate = new Date(input.buyDate);
  if (input.notes !== undefined) holding.notes = input.notes;

  await holding.save();
  return holding;
}

export async function removeHolding(
  userId: Types.ObjectId,
  portfolioId: string,
  holdingId: string,
): Promise<{ transactions: number }> {
  const portfolio = await requirePortfolio(userId, portfolioId);

  const holding = await Holding.findOne({ _id: holdingId, portfolioId: portfolio._id });
  if (!holding) throw ApiError.notFound('That holding does not exist.');

  // Transactions live in their own collection. Left behind they would keep counting towards
  // realised gains and XIRR, and the next transaction for this symbol would resurrect the position.
  const filter =
    holding.assetType === 'MUTUAL_FUND'
      ? { portfolioId: portfolio._id, schemeCode: holding.schemeCode }
      : { portfolioId: portfolio._id, symbol: holding.symbol, exchange: holding.exchange };

  const removed = await Transaction.deleteMany(filter);
  await holding.deleteOne();

  return { transactions: removed.deletedCount ?? 0 };
}

export async function portfolioPerformance(
  userId: Types.ObjectId,
  portfolioId: string,
  range: CandleRange,
): Promise<PerformancePoint[]> {
  const portfolio = await requirePortfolio(userId, portfolioId);
  const holdings = await Holding.find({ portfolioId: portfolio._id });
  if (!holdings.length) return [];

  return cached(`portfolio-performance:${portfolio._id.toString()}:${range}`, PERFORMANCE_TTL, async () => {
    const rates = await fxTable(new Set(holdings.map((holding) => holding.currency)), portfolio.baseCurrency);

    const currentNavs = await getFunds(
      holdings.filter((holding) => holding.schemeCode).map((holding) => holding.schemeCode!),
    );

    const series = await Promise.all(
      holdings.map(async (holding) => {
        if (holding.assetType === 'MUTUAL_FUND' || !holding.exchange) {
          const fallbackNav = currentNavs.get(holding.schemeCode ?? '')?.nav;

          try {
            const history = await getNavHistory(holding.schemeCode!, RANGE_HISTORY_DAYS[range]);
            if (history.length) {
              return { holding, candles: history.map((point) => ({ t: point.t, c: point.nav })) };
            }
          } catch {
            /* fall back to the latest NAV */
          }

          return {
            holding,
            candles: fallbackNav ? [{ t: new Date().toISOString(), c: fallbackNav }] : [],
          };
        }

        try {
          const candles = await getCandles({ symbol: holding.symbol, exchange: holding.exchange }, range);
          return { holding, candles: candles.candles as Array<{ t: string; c: number }> };
        } catch {
          return { holding, candles: [] as Array<{ t: string; c: number }> };
        }
      }),
    );

    const timeline = series.reduce<string[]>(
      (longest, entry) => (entry.candles.length > longest.length ? entry.candles.map((c) => c.t) : longest),
      [],
    );

    return timeline.map((stamp) => {
      const at = new Date(stamp).getTime();
      let value = 0;
      let invested = 0;

      for (const entry of series) {
        if (entry.holding.buyDate.getTime() > at) continue;

        const fxRate = rates.get(entry.holding.currency) ?? 1;
        invested += entry.holding.quantity * entry.holding.avgBuyPrice * fxRate;

        const candle =
          entry.candles.reduce<{ t: string; c: number } | null>(
            (closest, item) => (new Date(item.t).getTime() <= at ? item : closest),
            null,
          ) ?? entry.candles[0];

        if (candle) value += entry.holding.quantity * candle.c * fxRate;
      }

      return { t: stamp, value: round(value), invested: round(invested) };
    });
  });
}
