import { logger } from '../../../config/logger.js';
import { EXCHANGE_MARKET, type SecurityRef } from '../../../types/market.js';
import type { Fundamentals, MarketProvider } from './provider.types.js';
import { fetchJson, UpstreamError } from './upstream.js';

const API_BASE = 'https://api.bseindia.com/BseIndiaAPI/api';
const SCRIP_MASTER = `${API_BASE}/ListofScripData/w`;
const MASTER_TTL_MS = 24 * 60 * 60_000;

// BSE's endpoints reject requests that do not look like they came from its own site.
const BSE_HEADERS = { Referer: 'https://www.bseindia.com/', Origin: 'https://www.bseindia.com' };

interface ScripRow {
  SCRIP_CD?: string;
  Scrip_Name?: string;
  scrip_id?: string;
  ISIN_NUMBER?: string;
  INDUSTRY?: string;
}

interface ComHeader {
  SecurityId?: string;
  EPS?: string;
  CEPS?: string;
  PE?: string;
  PB?: string;
  ROE?: string;
  OPM?: string;
  NPM?: string;
  Industry?: string;
  Sector?: string;
  FaceVal?: string;
}

interface StockTrading {
  MktCapFull?: string;
  MktCapFF?: string;
}

interface ScripIndex {
  byTicker: Map<string, string>;
  byName: Map<string, string>;
  loadedAt: number;
}

let index: ScripIndex | null = null;
let loading: Promise<ScripIndex> | null = null;

function normaliseName(value: string): string {
  return value
    .toLowerCase()
    // Our universe annotates renames, e.g. "Eternal Ltd (Zomato)"; BSE lists the current name only.
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9& ]/g, ' ')
    .replace(/\b(ltd|limited|india|corporation|corp|company|co)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

async function loadScripMaster(): Promise<ScripIndex> {
  const rows = await fetchJson<ScripRow[]>(SCRIP_MASTER, {
    provider: 'bse',
    timeoutMs: 30_000,
    headers: BSE_HEADERS,
    params: { Group: '', Scripcode: '', industry: '', segment: 'Equity', status: 'Active' },
  });

  if (!Array.isArray(rows) || !rows.length) throw new UpstreamError('bse', 'BSE returned an empty scrip master');

  const byTicker = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const row of rows) {
    if (!row.SCRIP_CD) continue;
    if (row.scrip_id) byTicker.set(row.scrip_id.trim().toUpperCase(), row.SCRIP_CD);
    if (row.Scrip_Name) byName.set(normaliseName(row.Scrip_Name), row.SCRIP_CD);
  }

  logger.info('BSE scrip master loaded', { scrips: byTicker.size });
  return { byTicker, byName, loadedAt: Date.now() };
}

async function scripIndex(): Promise<ScripIndex> {
  if (index && Date.now() - index.loadedAt < MASTER_TTL_MS) return index;
  if (loading) return loading;

  loading = loadScripMaster()
    .then((loaded) => {
      index = loaded;
      return loaded;
    })
    .finally(() => {
      loading = null;
    });

  return loading;
}

/**
 * BSE lists nearly every NSE-traded company, so an NSE ticker resolves here too. Tickers drift
 * (Zomato became Eternal, Tata Motors demerged), so the company name is the fallback.
 */
async function resolveScripCode(ref: SecurityRef, companyName?: string): Promise<string> {
  const { byTicker, byName } = await scripIndex();

  const direct = byTicker.get(ref.symbol.trim().toUpperCase());
  if (direct) return direct;

  if (companyName) {
    const named = byName.get(normaliseName(companyName));
    if (named) return named;
  }

  throw new UpstreamError('bse', `BSE does not list ${ref.symbol}`, 404);
}

export const bseProvider: MarketProvider = {
  id: 'bse',
  label: 'BSE India',
  capabilities: ['fundamentals'],
  // Keyless public endpoints, so there is nothing to configure.
  isConfigured: () => true,

  async fundamentals(ref: SecurityRef, companyName?: string): Promise<Fundamentals> {
    if (EXCHANGE_MARKET[ref.exchange] !== 'IN') {
      throw new UpstreamError('bse', 'BSE only covers Indian listings', 404);
    }

    const scripcode = await resolveScripCode(ref, companyName);
    const [header, trading] = await Promise.all([
      fetchJson<ComHeader>(`${API_BASE}/ComHeadernew/w`, {
        provider: 'bse',
        headers: BSE_HEADERS,
        params: { quotetype: 'EQ', scripcode, seriesid: '' },
      }),
      fetchJson<StockTrading>(`${API_BASE}/StockTrading/w`, {
        provider: 'bse',
        headers: BSE_HEADERS,
        params: { flag: '', quotetype: 'EQ', scripcode },
      }).catch(() => ({}) as StockTrading),
    ]);

    if (!header.SecurityId && !header.EPS) {
      throw new UpstreamError('bse', `BSE has no fundamentals for ${ref.symbol}`, 404);
    }

    // BSE reports market capitalisation in crore.
    const marketCapCrore = toNumber(trading.MktCapFull);

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: 'INR',
      valuation: {
        peRatio: toNumber(header.PE),
        pegRatio: null,
        priceToBook: toNumber(header.PB),
        priceToSales: null,
        evToEbitda: null,
      },
      profitability: {
        roe: toNumber(header.ROE),
        roa: null,
        grossMargin: null,
        operatingMargin: toNumber(header.OPM),
        netMargin: toNumber(header.NPM),
      },
      growth: { revenueGrowth: null, earningsGrowth: null },
      financials: {
        revenue: null,
        netIncome: null,
        ebitda: null,
        totalDebt: null,
        totalCash: null,
        freeCashFlow: null,
      },
      perShare: {
        eps: toNumber(header.EPS),
        bookValue: null,
        dividendPerShare: null,
      },
      dividend: { yield: null, payoutRatio: null },
      risk: { beta: null, debtToEquity: null, currentRatio: null, interestCoverage: null },
      annual: [],
      fiscalPeriod: 'TTM',
      // Reported in crore; the rest of the app works in rupees.
      marketCap: marketCapCrore === null ? null : marketCapCrore * 1_00_00_000,
    };
  },
};
