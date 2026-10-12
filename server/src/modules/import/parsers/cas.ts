import type { ParsedRow } from '../import.service.js';
import type { ImportMode } from './brokerFormats.js';
import { isoDayMonthYear } from '../../../utils/dates.js';

/**
 * Parser for the CAMS / KFintech Consolidated Account Statement (CAS) — the one PDF that lists a
 * person's mutual fund holdings across every AMC, whichever app they were bought through.
 */

const ISIN_PATTERN = /\b(INF[A-Z0-9]{9})\b/;

/**
 * A PDF text layer breaks an ISIN into separate glyph runs, so it reaches us as "INF 179 KC 1 GI 5".
 * Closing those gaps up front is what lets a statement match a scheme exactly instead of falling back
 * to its name — and a name alone cannot tell a Direct plan from a Regular one.
 */
function normaliseIsinSpacing(text: string): string {
  return text.replace(/\bINF(?:\s*[A-Z0-9]){9}/g, (match) => match.replace(/\s+/g, ''));
}
const DATE_ROW = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+)$/;
const FOLIO = /Folio\s*No[.:]?\s*([A-Z0-9/\s-]+?)(?:\s{2,}|\s+PAN|\s+KYC|$)/i;
const CLOSING_UNITS = /Closing\s+Unit\s+Balance[:\s]+([\d,]+\.?\d*)/i;
const COST_VALUE = /Total\s+Cost\s+Value[:\s]+([\d,]+\.?\d*)/i;
const NAV_ON = /NAV\s+on\s+\d{2}-[A-Za-z]{3}-\d{4}[:\s]+(?:INR\s*)?([\d,]+\.?\d*)/i;
const OPENING_UNITS = /Opening\s+Unit\s+Balance[:\s]*([\d,]+\.?\d*)/i;

/** CAS prints negatives in parentheses, and every number is grouped with commas. */
function casNumber(value: string | undefined): number | null {
  if (!value) return null;
  const negative = /^\(.*\)$/.test(value.trim());
  const cleaned = value.replace(/[(),]/g, '').trim();
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

/** 'SKIP' is a row we deliberately ignore; null is one we simply did not recognise. */
type CasClassification = 'BUY' | 'SELL' | 'DIVIDEND' | 'SKIP' | null;

/**
 * Registrars describe the same handful of events in many ways. Anything that does not move units or
 * pay cash (stamp duty, STT, TDS, address changes) has to be dropped rather than guessed at.
 */
function classify(description: string): CasClassification {
  const text = description.toLowerCase();

  if (/stamp\s*duty|\bstt\b|\btds\b|tax\s*deducted|transaction\s*charge|\*{3}/.test(text)) return 'SKIP';
  if (/reversal|rejected|cancell?ed/.test(text)) return 'SKIP';

  // Reinvestment adds units and must be treated as a purchase, so it is tested before the payout rule.
  if (/re-?invest/.test(text)) return 'BUY';
  // A redemption is often described by how the money was sent ("Redemption - NEFT PAYOUT"), so it has
  // to be settled before the payout rule — otherwise a sale books as a dividend and the units stay put.
  if (/redemption|redeem|switch\s*out|transfer\s*out|swio|sell|\bswp\b|sys\.?\s*withdrawal/.test(text)) return 'SELL';
  if (/dividend|idcw|payout/.test(text)) return 'DIVIDEND';
  // "Sys. Investment" is how KFintech abbreviates a SIP instalment.
  if (/purchase|systematic|sys\.?\s*investment|sip|switch\s*in|transfer\s*in|swin|instal|buy|subscription/.test(text)) {
    return 'BUY';
  }

  return null;
}

export function looksLikeCas(text: string): boolean {
  const sample = normaliseIsinSpacing(text.slice(0, 20_000)).toLowerCase();
  const markers = [
    sample.includes('consolidated account statement'),
    sample.includes('folio no'),
    /isin\s*:?\s*inf/i.test(sample),
    sample.includes('cams') || sample.includes('kfintech') || sample.includes('karvy'),
    sample.includes('closing unit balance'),
  ].filter(Boolean).length;

  return markers >= 2;
}

interface CasScheme {
  name: string;
  isin: string | null;
  folio: string | null;
  openingUnits: number;
  closingUnits: number | null;
  costValue: number | null;
  nav: number | null;
  transactions: Array<{ line: number; date: string; type: 'BUY' | 'SELL' | 'DIVIDEND'; units: number | null; nav: number | null; amount: number | null }>;
}

export interface CasParseResult {
  rows: ParsedRow[];
  mode: ImportMode;
  detectedFormat: string;
  schemes: number;
  /** True when every scheme starts from zero, so replaying the ledger reproduces the holding exactly. */
  completeHistory: boolean;
  /** Ledger rows are only trusted when they add back up to the balance the statement itself prints. */
  reconciliation: { verified: number; unverified: number; failed: string[] };
  /** Set when the reader had to change its approach, so the person importing is told why. */
  notice: string | null;
  /** Per-scheme working, so a statement that reads wrongly can be diagnosed without guesswork. */
  detail: Array<{
    name: string;
    isin: string | null;
    openingUnits: number;
    closingUnits: number | null;
    costValue: number | null;
    transactions: number;
    replayed: number;
  }>;
}

/**
 * A scheme header is the line that names the fund. Registrars prefix it with an internal scheme code
 * ("B151G-HDFC Balanced Advantage Fund") and suffix it with advisor and registrar notes.
 */
function readSchemeName(line: string, carriesIsin = false): string | null {
  if (!/[A-Za-z]{4}/.test(line)) return null;
  if (/^(folio|isin|opening|closing|total|date|nav\s+on|market\s+value|pan\b|kyc\b)/i.test(line)) return null;
  if (/^page\s+\d+\s+of\s+\d+/i.test(line)) return null;

  let name = line
    .replace(/\(\s*Advisor\s*:.*?\)/gi, ' ')
    .replace(/Registrar\s*:.*$/i, ' ')
    .replace(/\bISIN\s*:?\s*INF[A-Z0-9]{9}\b/gi, ' ')
    // Demat-held schemes are tagged as such; it is a holding mode, not part of the name.
    .replace(/\(\s*Demat\s*\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–:]\s*$/, '')
    .trim();

  // Registrars prefix the scheme with an internal code ("B151G-", "P 9777 -", "127 FMGDG -"). Only a
  // prefix carrying a digit is stripped, so a fund house ("NIPPON INDIA - ...") is never mistaken for one.
  // A single code-like token is always the registrar's ("HHDDGR-", "B151G-"). A two-word prefix is
  // only a code when it carries a digit ("P 9777 -"), which keeps "NIPPON INDIA - ..." intact.
  const prefixed = /^([A-Z0-9]{1,10}(?:\s+[A-Z0-9]{1,8})?)\s*-\s*(.+)$/.exec(name);
  if (prefixed && (!/\s/.test(prefixed[1]) || /\d/.test(prefixed[1]))) name = prefixed[2].trim();

  if (name.length < 8 || name.length > 160) return null;
  // Real scheme names usually say what kind of fund they are — but "FoF" is abbreviated often enough
  // that the word test alone loses whole positions. A line carrying an ISIN is a scheme header
  // outright, so it needs no such corroboration.
  if (!carriesIsin && !/fund|scheme|plan|etf|fof|yojana/i.test(name)) return null;

  // Registrars print the fund house as a banner above each block and again on continuation pages.
  // "HDFC Mutual Fund" is a heading, not a scheme; treating it as one lets it swallow the rows that
  // follow, which then import under the wrong scheme entirely.
  if (/^[A-Za-z0-9&.'\- ]+?\s+(mutual\s+fund|asset\s+management(\s+(company|company\s+limited|limited|ltd\.?))?|amc)$/i.test(name)) {
    return null;
  }

  return name;
}

export function parseCasText(rawText: string): CasParseResult {
  const text = normaliseIsinSpacing(rawText);
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const schemes: CasScheme[] = [];

  let current: CasScheme | null = null;
  // Folio lines are printed above the scheme they belong to, so the last one seen carries forward.
  let lastFolio: string | null = null;
  let inPortfolioSummary = false;

  // A scheme block can be broken across pages, with its folio and header reprinted each time. Keyed
  // by folio and name, a continuation resumes the same scheme instead of forking a second, partial one.
  const byKey = new Map<string, CasScheme>();
  const schemeKey = (name: string, folio: string | null) => `${folio ?? ''}|${name.toLowerCase()}`;

  const startScheme = (name: string): CasScheme => {
    const key = schemeKey(name, lastFolio);
    const existing = byKey.get(key);
    if (existing) return existing;

    const scheme: CasScheme = {
      name,
      isin: null,
      folio: lastFolio,
      openingUnits: 0,
      closingUnits: null,
      costValue: null,
      nav: null,
      transactions: [],
    };
    schemes.push(scheme);
    byKey.set(key, scheme);
    return scheme;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;

    // The opening summary repeats every fund house with values; parsing it would double-count.
    if (/^portfolio\s+summary/i.test(line)) {
      inPortfolioSummary = true;
      continue;
    }
    if (inPortfolioSummary) {
      if (/folio\s*no/i.test(line) || ISIN_PATTERN.test(line)) inPortfolioSummary = false;
      else continue;
    }

    const folio = FOLIO.exec(line)?.[1]?.trim().replace(/\s+/g, '') ?? null;
    if (folio) {
      lastFolio = folio;
      // A new folio block means the scheme that follows is a fresh position.
      current = null;
      continue;
    }

    const isin = ISIN_PATTERN.exec(line)?.[1] ?? null;

    if (isin) {
      const named = readSchemeName(line, true);
      // The ISIN sometimes shares the scheme's line and sometimes sits on its own underneath it.
      if (named && (!current || current.isin)) current = startScheme(named);
      if (current && !current.isin) current.isin = isin;
      continue;
    }

    if (!DATE_ROW.test(line)) {
      const named = readSchemeName(line);
      if (named) {
        current = startScheme(named);
        continue;
      }
    }

    if (!current) continue;

    const opening = OPENING_UNITS.exec(line);
    if (opening) {
      current.openingUnits = casNumber(opening[1]) ?? 0;
      continue;
    }

    const closing = CLOSING_UNITS.exec(line);
    if (closing) {
      current.closingUnits = casNumber(closing[1]);
      current.nav = casNumber(NAV_ON.exec(line)?.[1]) ?? current.nav;
      // Most registrars print the balance, the NAV and the total cost as one footer line, so the cost
      // has to be taken here too — moving on would leave the position with no basis to average from.
      const inlineCost = COST_VALUE.exec(line);
      if (inlineCost) current.costValue = casNumber(inlineCost[1]);
      continue;
    }

    const cost = COST_VALUE.exec(line);
    if (cost) {
      current.costValue = casNumber(cost[1]);
      continue;
    }

    const dated = DATE_ROW.exec(line);
    if (dated) {
      const date = isoDayMonthYear(dated[1]);
      const rest = dated[2];
      const numbers = rest.match(/\(?-?[\d,]+\.\d+\)?/g) ?? [];
      const leading = numbers[0];
      const firstNumber = leading ? rest.indexOf(leading) : -1;
      const description = (firstNumber > 0 ? rest.slice(0, firstNumber) : rest).trim();
      const classified = classify(description);
      if (!date || classified === 'SKIP') continue;

      let type: 'BUY' | 'SELL' | 'DIVIDEND';

      if (classified) {
        type = classified;
      } else {
        // Registrars keep inventing wordings, and an unrecognised one used to drop the row silently.
        // A row carrying the full shape — amount, units, NAV and a running balance — is a real
        // movement whatever it is called, and the sign of its units says which way it went.
        const inferred = numbers.length >= 4 ? casNumber(numbers[1]) : null;
        if (inferred === null || inferred === 0) continue;
        type = inferred < 0 ? 'SELL' : 'BUY';
      }

      // Columns run: amount, units, NAV, running balance. Dividend rows carry the amount alone.
      current.transactions.push({
        line: index + 1,
        date,
        type,
        units: numbers.length >= 2 ? casNumber(numbers[1]) : null,
        nav: numbers.length >= 3 ? casNumber(numbers[2]) : null,
        amount: casNumber(numbers[0]),
      });
    }
  }

  return finalise(schemes);
}

/** Units the parsed ledger implies, which must match what the statement prints as its closing balance. */
function replayedUnits(scheme: CasScheme): number {
  // The opening balance is units the person already held before this statement's window.
  return scheme.transactions.reduce((total, transaction) => {
    if (transaction.units === null) return total;
    const units = Math.abs(transaction.units);
    if (transaction.type === 'BUY') return total + units;
    if (transaction.type === 'SELL') return total - units;
    return total;
  }, scheme.openingUnits);
}

function finalise(schemes: CasScheme[]): CasParseResult {
  const usable = schemes.filter((scheme) => (scheme.closingUnits ?? 0) > 0 || scheme.transactions.length);
  const startsFromZero =
    usable.length > 0 &&
    usable.every((scheme) => scheme.openingUnits === 0) &&
    usable.some((scheme) => scheme.transactions.length > 0);

  // Check the ledger against the statement's own arithmetic before trusting it. A transaction row
  // that was misread — or a page the text layer dropped — shows up here as a balance that no longer
  // adds up, and importing it would silently understate the holding.
  const failed: string[] = [];
  let verified = 0;
  let unverified = 0;

  for (const scheme of usable) {
    if (!scheme.transactions.length) continue;

    if (scheme.closingUnits === null) {
      // No printed balance to check the rows against. That is exactly the shape a half-read block
      // has, so it counts against trusting the ledger rather than passing silently.
      unverified += 1;
      failed.push(scheme.name);
      continue;
    }

    const replayed = replayedUnits(scheme);
    const tolerance = Math.max(0.01, Math.abs(scheme.closingUnits) * 0.0005);
    if (Math.abs(replayed - scheme.closingUnits) <= tolerance) verified += 1;
    else failed.push(scheme.name);
  }

  // Only import a ledger that reproduces the statement. Otherwise fall back to the closing units and
  // total cost the registrar printed, which are authoritative even when the rows above them are not.
  const completeHistory = startsFromZero && failed.length === 0;

  const notice =
    failed.length > 0
      ? `The transaction rows for some schemes did not add up to the balance the statement prints, so holdings were taken from the registrar's own closing balance and total cost instead. Affected: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ` and ${failed.length - 3} more` : ''}.`
      : null;

  const rows: ParsedRow[] = [];

  if (completeHistory) {
    for (const scheme of usable) {
      for (const transaction of scheme.transactions) {
        const units = transaction.units === null ? null : Math.abs(transaction.units);
        const price =
          transaction.nav ??
          (units && transaction.amount ? Math.abs(transaction.amount) / units : null);

        rows.push({
          line: transaction.line,
          assetType: 'MUTUAL_FUND',
          transactionType: transaction.type,
          amount: transaction.amount,
          symbol: null,
          name: scheme.name,
          isin: scheme.isin,
          quantity: transaction.type === 'DIVIDEND' ? 0 : units,
          avgBuyPrice: transaction.type === 'DIVIDEND' ? 0 : price,
          exchange: null,
          buyDate: transaction.date,
          statementNav: scheme.nav,
        });
      }
    }
  } else {
    for (const scheme of usable) {
      // Fall back to what the rows add up to, so a scheme whose balance line was missed still lands.
      const units = scheme.closingUnits ?? (scheme.transactions.length ? replayedUnits(scheme) : null);
      if (!units || units <= 0) continue;

      rows.push({
        line: 0,
        assetType: 'MUTUAL_FUND',
        transactionType: null,
        amount: scheme.costValue,
        symbol: null,
        name: scheme.name,
        isin: scheme.isin,
        quantity: units,
        // The statement gives total cost, which is the only honest basis for an average price.
        avgBuyPrice: scheme.costValue ? Math.round((scheme.costValue / units) * 10_000) / 10_000 : null,
        exchange: null,
        buyDate: null,
        statementNav: scheme.nav,
      });
    }
  }

  return {
    rows,
    detail: usable.map((scheme) => ({
      name: scheme.name,
      isin: scheme.isin,
      openingUnits: scheme.openingUnits,
      closingUnits: scheme.closingUnits,
      costValue: scheme.costValue,
      transactions: scheme.transactions.length,
      replayed: replayedUnits(scheme),
    })),
    mode: completeHistory ? 'transactions' : 'positions',
    detectedFormat: 'CAMS / KFintech consolidated statement (CAS)',
    schemes: usable.length,
    completeHistory,
    reconciliation: { verified, unverified, failed },
    notice,
  };
}
