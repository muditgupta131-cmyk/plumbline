import type { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { normaliseExchange } from '../market/providers/symbolMapping.js';
import type { SymbolMatch } from '../market/providers/index.js';
import { searchSymbols } from '../market/market.service.js';
import { addHolding, requirePortfolio, type HoldingWriteStrategy } from '../portfolio/portfolio.service.js';
import { addTransaction, ledgerByPosition } from '../portfolio/ledger.service.js';
import { Transaction } from '../portfolio/transaction.model.js';
import { Holding } from '../portfolio/portfolio.model.js';
import { parseDelimited, toNumber } from './parsers/csv.js';
import { mapHeaders, normaliseTransactionType, type ImportField, type ImportMode } from './parsers/brokerFormats.js';
import { looksLikeCas, parseCasText } from './parsers/cas.js';
import type { AssetType, Exchange } from '../../types/market.js';
import { findFundByIsin, searchFunds, type FundMatch } from '../funds/fund.service.js';

export type MatchConfidence = 'exact' | 'symbol' | 'name' | 'none';

export type LedgerType = 'BUY' | 'SELL' | 'DIVIDEND';

export interface ParsedRow {
  line: number;
  assetType: AssetType;
  transactionType: LedgerType | null;
  amount: number | null;
  symbol: string | null;
  name: string | null;
  isin: string | null;
  quantity: number | null;
  avgBuyPrice: number | null;
  exchange: Exchange | null;
  buyDate: string | null;
  /**
   * The NAV the statement itself printed for the scheme. A matched scheme's own NAV has to agree with it,
   * which is the one check that catches a wrong scheme whose name happens to look right.
   */
  statementNav?: number | null;
}

/** What committing this row would actually do to the portfolio. */
export type RowEffect = 'new' | 'update' | 'unchanged' | 'ledger';

export interface PreviewRow extends ParsedRow {
  match: SymbolMatch | null;
  fund: FundMatch | null;
  confidence: MatchConfidence;
  issues: string[];
  suggestions: SymbolMatch[];
  fundSuggestions: FundMatch[];
  /** The position this row would land on, when one already exists. */
  existing: { quantity: number; avgBuyPrice: number } | null;
  effect: RowEffect;
}

export interface ImportPreview {
  mode: ImportMode;
  detectedFormat: string | null;
  totalRows: number;
  importable: number;
  rows: PreviewRow[];
  /** Set when the reader changed approach — the person importing has to be told, not left guessing. */
  notice: string | null;
  /**
   * Balances describe a position as it stands, so importing them again should correct the holding
   * rather than stack a second copy on top of it. Transaction files are additive by nature.
   */
  suggestedStrategy: 'add' | 'replace';
}

export interface CommitTransactionRow {
  assetType?: AssetType;
  symbol?: string;
  exchange?: Exchange;
  schemeCode?: string;
  type: LedgerType;
  quantity: number;
  price: number;
  fees?: number;
  date: string;
}

export interface CommitRow {
  assetType?: AssetType;
  symbol?: string;
  exchange?: Exchange;
  schemeCode?: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate?: string;
}

const MAX_ROWS = 200;

function transactionKey(row: {
  schemeCode?: string | null;
  symbol?: string | null;
  exchange?: string | null;
  type: string;
  quantity: number;
  price: number;
  date: Date | string;
}): string {
  const when = new Date(row.date).toISOString().slice(0, 10);
  const units = Math.round(row.quantity * 10_000) / 10_000;
  const at = Math.round(row.price * 10_000) / 10_000;
  const position = row.schemeCode ? `MF:${row.schemeCode}` : `${row.exchange}:${row.symbol?.toUpperCase()}`;
  return `${position}|${row.type}|${when}|${units}|${at}`;
}

/** Matches the key holdings and ledgers are grouped by elsewhere, so the three agree on identity. */
function positionKey(row: { schemeCode?: string; symbol?: string; exchange?: string }): string {
  return row.schemeCode ? `MF:${row.schemeCode}` : `${row.exchange}:${row.symbol?.toUpperCase()}`;
}

function readDate(value: string | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(trimmed);

  if (dmy) {
    const [, day, month, yearRaw] = dmy;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function cleanSymbol(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length > 24) return null;
  if (/^[A-Z0-9&.-]+$/.test(cleaned)) return cleaned.replace(/\.(NS|BO|BSE|NSE)$/i, '');
  return null;
}

export function parseHoldingsFile(content: string): {
  rows: ParsedRow[];
  detectedFormat: string | null;
  looksLikeFunds: boolean;
  mode: ImportMode;
  notice: string | null;
} {
  // A consolidated statement is a report, not a table, so it never survives the CSV reader.
  if (looksLikeCas(content)) {
    const cas = parseCasText(content);
    if (!cas.rows.length) {
      throw ApiError.badRequest(
        'That looks like a consolidated statement, but no scheme holdings could be read from it. Ask CAMS or KFintech for the detailed statement rather than the summary one.',
      );
    }
    return { rows: cas.rows, detectedFormat: cas.detectedFormat, looksLikeFunds: true, mode: cas.mode, notice: cas.notice };
  }

  const grid = parseDelimited(content);
  if (grid.length < 2) throw ApiError.badRequest('That file has no rows to read.');

  const mapping = mapHeaders(grid);
  if (!mapping) {
    throw ApiError.badRequest(
      'Could not find a holdings table in that file. It needs a header row with a company or symbol column and a quantity column.',
    );
  }

  const column = (row: string[], field: ImportField): string | undefined => {
    const index = mapping.columns[field];
    return index === undefined ? undefined : row[index];
  };

  const rows: ParsedRow[] = [];

  for (let index = mapping.headerRow + 1; index < grid.length && rows.length < MAX_ROWS; index += 1) {
    const raw = grid[index];
    const rawSymbol = column(raw, 'symbol') ?? null;
    const rawName = column(raw, 'name') ?? null;
    const quantity = toNumber(column(raw, 'quantity'));
    const transactionType = normaliseTransactionType(column(raw, 'transactionType'));
    const amount = toNumber(column(raw, 'amount'));

    if (!rawSymbol && !rawName) continue;
    if (quantity === null && !rawSymbol && !rawName) continue;
    if (mapping.mode === 'transactions' && !transactionType) continue;

    rows.push({
      line: index + 1,
      assetType: mapping.looksLikeFunds ? 'MUTUAL_FUND' : 'EQUITY',
      transactionType,
      amount,
      symbol: cleanSymbol(rawSymbol) ?? cleanSymbol(rawName),
      name: rawName?.trim() || null,
      isin: column(raw, 'isin')?.trim().toUpperCase() || null,
      quantity,
      avgBuyPrice: toNumber(column(raw, 'avgBuyPrice')),
      exchange: normaliseExchange(column(raw, 'exchange')),
      buyDate: readDate(column(raw, 'buyDate')),
    });
  }

  if (!rows.length) throw ApiError.badRequest('No holdings rows were found under the header.');

  return {
    rows,
    detectedFormat: mapping.detected,
    looksLikeFunds: mapping.looksLikeFunds,
    mode: mapping.mode,
    notice: null,
  };
}

async function resolveRow(row: ParsedRow): Promise<{ match: SymbolMatch | null; confidence: MatchConfidence; suggestions: SymbolMatch[] }> {
  const term = row.symbol ?? row.name;
  if (!term) return { match: null, confidence: 'none', suggestions: [] };

  const { results } = await searchSymbols(term, 6);
  if (!results.length) return { match: null, confidence: 'none', suggestions: [] };

  const preferred = (candidates: SymbolMatch[]) =>
    candidates.find((candidate) => !row.exchange || candidate.exchange === row.exchange) ?? candidates[0];

  const symbolMatches = row.symbol
    ? results.filter((result) => result.symbol.toUpperCase() === row.symbol!.toUpperCase())
    : [];

  if (symbolMatches.length) {
    const match = preferred(symbolMatches);
    return {
      match,
      confidence: row.exchange && match.exchange === row.exchange ? 'exact' : 'symbol',
      suggestions: results.filter((result) => result !== match).slice(0, 4),
    };
  }

  if (row.name) {
    const needle = row.name.toLowerCase().replace(/\s+(ltd|limited|inc|corp|corporation|plc)\.?$/i, '').trim();

    // Short names like "ITC" must still resolve, but only on a whole-word or ticker match —
    // a bare substring test would attach them to any company containing those letters.
    const nameMatches = results.filter((result) => {
      const name = result.name.toLowerCase();
      if (needle.length > 3) return name.includes(needle);
      if (!needle) return false;
      return name === needle || name.startsWith(`${needle} `) || result.symbol.toLowerCase() === needle;
    });

    if (nameMatches.length) {
      const match = preferred(nameMatches);
      return { match, confidence: 'name', suggestions: results.filter((r) => r !== match).slice(0, 4) };
    }
  }

  return { match: null, confidence: 'none', suggestions: results.slice(0, 4) };
}

const NAME_NOISE = /\b(fund|scheme|plan|option|growth|regular|direct|payout|reinvestment|idcw|dividend|the|of|and|ltd|limited)\b/g;

/** Do the statement's scheme name and AMFI's name describe the same fund, allowing for renames? */
function namesAgree(statementName: string, amfiName: string): boolean {
  const tokens = (value: string) =>
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(NAME_NOISE, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2),
    );

  const left = tokens(statementName);
  const right = tokens(amfiName);
  if (!left.size || !right.size) return true;

  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;

  return shared / Math.min(left.size, right.size) >= 0.5;
}

/** How far a matched scheme's NAV may sit from the statement's before the match is not believed. */
const NAV_AGREEMENT_TOLERANCE = 0.15;

function navsAgree(statementNav: number | null | undefined, schemeNav: number): boolean {
  if (!statementNav || statementNav <= 0 || !schemeNav || schemeNav <= 0) return true;
  // Statements lag AMFI by a few days, so allow ordinary movement — but not a different fund's price.
  return Math.abs(schemeNav - statementNav) / statementNav <= NAV_AGREEMENT_TOLERANCE;
}

type FundResolution = {
  fund: FundMatch | null;
  confidence: MatchConfidence;
  fundSuggestions: FundMatch[];
  /** Why no scheme was chosen, when that is something the person importing needs to know. */
  unresolvedReason?: 'isin-not-listed' | 'nav-mismatch';
};

async function resolveFundRow(row: ParsedRow): Promise<FundResolution> {
  const term = row.name ?? row.symbol;
  const suggest = async () => (term ? (await searchFunds(term, 5)).slice(0, 4) : []);

  // An ISIN names one plan and one option outright, so it settles the match before any name search.
  if (row.isin) {
    const byIsin = await findFundByIsin(row.isin);
    if (byIsin) return { fund: byIsin, confidence: 'exact', fundSuggestions: [] };

    // The statement named a specific scheme and AMFI does not list it — most often a new fund whose NFO
    // has been allotted but which has not started publishing a daily NAV. Guessing by name here is how a
    // "Passive FOF" bought at ₹10 became an "Active FOF" priced at ₹136: the ISIN was a precise claim,
    // and the right answer to a precise claim we cannot verify is to say so, not to substitute a lookalike.
    return { fund: null, confidence: 'none', fundSuggestions: await suggest(), unresolvedReason: 'isin-not-listed' };
  }

  if (!term) return { fund: null, confidence: 'none', fundSuggestions: [] };

  const results = await searchFunds(term, 5);
  if (!results.length) return { fund: null, confidence: 'none', fundSuggestions: [] };

  const needle = term.toLowerCase();
  const exact = results.find((result) => result.name.toLowerCase() === needle);
  const best = exact ?? results[0];

  // A name can look right while the price says it is another fund entirely.
  if (!navsAgree(row.statementNav, best.nav)) {
    return { fund: null, confidence: 'none', fundSuggestions: results.slice(0, 4), unresolvedReason: 'nav-mismatch' };
  }

  return {
    fund: best,
    confidence: exact ? 'exact' : 'name',
    fundSuggestions: results.filter((result) => result !== best).slice(0, 4),
  };
}

export async function buildPreview(
  content: string,
  context?: { userId: Types.ObjectId; portfolioId: string },
): Promise<ImportPreview> {
  const { rows, detectedFormat, looksLikeFunds, mode, notice } = parseHoldingsFile(content);

  // Reading the portfolio up front lets every row say whether it creates, corrects or repeats a
  // position — the question someone actually has when re-importing a statement.
  const existingByKey = new Map<string, { quantity: number; avgBuyPrice: number }>();
  const ledgerKeys = new Set<string>();

  if (context) {
    const portfolio = await requirePortfolio(context.userId, context.portfolioId);
    for (const holding of await Holding.find({ portfolioId: portfolio._id }).lean()) {
      const key = holding.schemeCode ? `MF:${holding.schemeCode}` : `${holding.exchange}:${holding.symbol}`;
      existingByKey.set(key, { quantity: holding.quantity, avgBuyPrice: holding.avgBuyPrice });
    }
    for (const key of (await ledgerByPosition(portfolio._id)).keys()) ledgerKeys.add(key);
  }

  const describe = (
    key: string | null,
    quantity: number | null,
    avgBuyPrice: number | null,
  ): { existing: { quantity: number; avgBuyPrice: number } | null; effect: RowEffect } => {
    if (!key) return { existing: null, effect: 'new' };
    if (ledgerKeys.has(key)) return { existing: existingByKey.get(key) ?? null, effect: 'ledger' };

    const existing = existingByKey.get(key) ?? null;
    if (!existing) return { existing: null, effect: 'new' };

    const same =
      quantity !== null &&
      avgBuyPrice !== null &&
      Math.abs(existing.quantity - quantity) < 0.0005 &&
      Math.abs(existing.avgBuyPrice - avgBuyPrice) < 0.0005;

    return { existing, effect: same ? 'unchanged' : 'update' };
  };

  const previews: PreviewRow[] = [];

  for (const row of rows) {
    const issues: string[] = [];
    const isLedger = mode === 'transactions';

    // A ledger row can carry the total instead of the unit price; derive one from the other.
    if (isLedger && row.avgBuyPrice === null && row.amount !== null && row.quantity) {
      row.avgBuyPrice = Math.round((Math.abs(row.amount) / row.quantity) * 10000) / 10000;
    }

    if (row.quantity === null || row.quantity <= 0) {
      if (!(isLedger && row.transactionType === 'DIVIDEND')) {
        issues.push('Quantity is missing or not a positive number.');
      }
    }

    if (row.avgBuyPrice === null) {
      issues.push(isLedger ? 'No price or amount on this row.' : 'No average cost in the file — enter it before importing.');
    }

    if (isLedger && !row.buyDate) issues.push('No date on this transaction.');

    if (looksLikeFunds) {
      const { fund, confidence, fundSuggestions, unresolvedReason } = await resolveFundRow(row);
      if (unresolvedReason === 'isin-not-listed') {
        issues.push(
          `AMFI does not list ISIN ${row.isin} yet. This is usually a new fund whose units have been allotted but which has not begun publishing a daily NAV — import this statement again once it does. The suggestions below are similarly named schemes, not this one.`,
        );
      } else if (unresolvedReason === 'nav-mismatch') {
        issues.push(
          `The closest name match is priced far from the ₹${row.statementNav} NAV on the statement, so it is a different scheme. Pick the right one or skip this row.`,
        );
      } else if (!fund) {
        issues.push('No AMFI scheme matched — pick one or skip this row.');
      } else if (confidence !== 'exact') {
        issues.push('Matched on scheme name. Check the plan and option are right.');
      }

      // An ISIN is authoritative, but funds get renamed and merged, so say so when the names diverge.
      if (fund && row.isin && fund.isin === row.isin && row.name && !namesAgree(row.name, fund.name)) {
        issues.push(`Matched by ISIN — AMFI now lists this scheme as “${fund.name}”.`);
      }

      previews.push({
        ...row,
        match: null,
        fund,
        confidence,
        issues,
        suggestions: [],
        fundSuggestions,
        ...describe(fund ? `MF:${fund.schemeCode}` : null, row.quantity, row.avgBuyPrice),
      });
      continue;
    }

    const { match, confidence, suggestions } = await resolveRow(row);
    if (!match) issues.push('No listing matched — pick one or skip this row.');
    if (confidence === 'name') issues.push('Matched on company name rather than ticker. Check it is the right listing.');

    previews.push({
      ...row,
      match,
      fund: null,
      confidence,
      issues,
      suggestions,
      fundSuggestions: [],
      ...describe(match ? `${match.exchange}:${match.symbol.toUpperCase()}` : null, row.quantity, row.avgBuyPrice),
    });
  }

  return {
    mode,
    detectedFormat,
    totalRows: previews.length,
    importable: previews.filter(
      (row) =>
        (row.match ?? row.fund) &&
        row.avgBuyPrice !== null &&
        (mode === 'transactions' ? Boolean(row.buyDate && row.transactionType) : (row.quantity ?? 0) > 0),
    ).length,
    rows: previews,
    notice,
    // A balances file restates the position; a transactions file adds to it.
    suggestedStrategy: mode === 'positions' ? 'replace' : 'add',
  };
}

export async function commitTransactions(
  userId: Types.ObjectId,
  portfolioId: string,
  rows: CommitTransactionRow[],
): Promise<CommitResult> {
  if (!rows.length) throw ApiError.badRequest('Nothing to import.');
  if (rows.length > MAX_ROWS) throw ApiError.badRequest(`Import at most ${MAX_ROWS} transactions at a time.`);

  const portfolio = await requirePortfolio(userId, portfolioId);
  const ordered = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Every statement reprints the whole period, so a second import mostly repeats what is already
  // recorded. Recognising those keeps a re-import additive only in the part that is actually new.
  const seen = new Set(
    (await Transaction.find({ portfolioId: portfolio._id }).lean()).map((existing) => transactionKey(existing)),
  );

  const failed: CommitResult['failed'] = [];
  let added = 0;
  let skipped = 0;

  for (const row of ordered) {
    const key = transactionKey(row);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }

    try {
      await addTransaction(userId, portfolio._id, row);
      seen.add(key);
      added += 1;
    } catch (error) {
      failed.push({
        symbol: row.schemeCode ? `MF:${row.schemeCode}` : `${row.exchange}:${row.symbol}`,
        reason: error instanceof Error ? error.message : 'Could not record this transaction.',
      });
    }
  }

  return { added, skipped, failed };
}

export interface CommitResult {
  added: number;
  /** Rows recognised as already recorded, so re-importing an overlapping statement is safe. */
  skipped: number;
  failed: Array<{ symbol: string; reason: string }>;
}

export async function commitRows(
  userId: Types.ObjectId,
  portfolioId: string,
  rows: CommitRow[],
  strategy: HoldingWriteStrategy = 'add',
): Promise<CommitResult> {
  if (!rows.length) throw ApiError.badRequest('Nothing to import.');
  if (rows.length > MAX_ROWS) throw ApiError.badRequest(`Import at most ${MAX_ROWS} rows at a time.`);

  const portfolio = await requirePortfolio(userId, portfolioId);
  const ledger = await ledgerByPosition(portfolio._id);
  const current = new Map(
    (await Holding.find({ portfolioId: portfolio._id }).lean()).map((holding) => [
      holding.schemeCode ? `MF:${holding.schemeCode}` : `${holding.exchange}:${holding.symbol}`,
      holding,
    ]),
  );

  const failed: CommitResult['failed'] = [];
  let added = 0;
  let skipped = 0;

  for (const row of rows) {
    const key = positionKey(row);

    // A position built from transactions is derived from them. Writing a balance over it would be
    // undone by the next ledger sync, so the ledger keeps precedence — the same rule broker syncs use.
    if (strategy === 'replace' && ledger.has(key)) {
      skipped += 1;
      continue;
    }

    // Re-importing the same statement should be a no-op, not a second write.
    const existing = current.get(key);
    if (
      strategy === 'replace' &&
      existing &&
      Math.abs(existing.quantity - row.quantity) < 0.0005 &&
      Math.abs(existing.avgBuyPrice - row.avgBuyPrice) < 0.0005
    ) {
      skipped += 1;
      continue;
    }

    try {
      await addHolding(userId, portfolioId, row, strategy);
      added += 1;
    } catch (error) {
      failed.push({
        symbol: key,
        reason: error instanceof Error ? error.message : 'Could not add this holding.',
      });
    }
  }

  return { added, skipped, failed };
}
