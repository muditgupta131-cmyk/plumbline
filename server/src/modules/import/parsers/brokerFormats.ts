export type ImportField =
  | 'symbol'
  | 'isin'
  | 'name'
  | 'quantity'
  | 'avgBuyPrice'
  | 'exchange'
  | 'buyDate'
  | 'folio'
  | 'transactionType'
  | 'amount';

const FIELD_ALIASES: Record<ImportField, string[]> = {
  symbol: ['symbol', 'tradingsymbol', 'trading symbol', 'ticker', 'scrip', 'scrip code', 'scrip name', 'instrument'],
  isin: ['isin', 'isin code', 'isin number'],
  name: [
    'scheme name',
    'fund name',
    'stock name',
    'company name',
    'security name',
    'name of the company',
    'scheme',
    'stock',
    'company',
    'security',
    'name',
  ],
  quantity: [
    'quantity',
    'qty',
    'quantity available',
    'holding quantity',
    'total qty',
    'free qty',
    'shares',
    'units',
    'demat free qty',
    'units',
    'unit balance',
    'closing balance',
    'balance units',
  ],
  avgBuyPrice: [
    'average buy price',
    'avg buy price',
    'average nav',
    'avg nav',
    'purchase nav',
    'buy nav',
    'nav at purchase',
    'trade price',
    'transaction price',
    'avg buy price',
    'average price',
    'avg price',
    'avg cost',
    'average cost',
    'buy price',
    'buy average',
    'buy avg',
    'cost price',
    'purchase price',
    'avg. cost',
    'price',
    'nav',
  ],
  exchange: ['exchange', 'exch', 'segment', 'listed on'],
  buyDate: ['buy date', 'purchase date', 'date of purchase', 'trade date', 'date'],
  folio: ['folio', 'folio number', 'folio no'],
  transactionType: [
    'transaction type',
    'order type',
    'txn type',
    'trade type',
    'type',
    'buy/sell',
    'transaction',
    'action',
  ],
  amount: ['amount', 'net amount', 'total amount', 'trade value', 'transaction amount'],
};

export interface BrokerSignature {
  id: string;
  label: string;
  hints: string[];
}

const SIGNATURES: BrokerSignature[] = [
  { id: 'groww-orders', label: 'Groww (order history)', hints: ['stock name', 'transaction type'] },
  { id: 'groww-mf-txn', label: 'Groww (fund transactions)', hints: ['scheme name', 'transaction type'] },
  { id: 'groww-mf', label: 'Groww (mutual funds)', hints: ['scheme name', 'units'] },
  { id: 'groww', label: 'Groww', hints: ['average buy price', 'closing price', 'unrealised p&l'] },
  { id: 'zerodha', label: 'Zerodha Console', hints: ['tradingsymbol', 'average price', 'previous closing'] },
  { id: 'upstox', label: 'Upstox', hints: ['instrument', 'quantity available', 'average price'] },
  { id: 'angelone', label: 'Angel One', hints: ['symbol', 'ltp', 'avg cost'] },
  { id: 'dhan', label: 'Dhan', hints: ['trading symbol', 'available qty', 'avg cost price'] },
  { id: 'icici', label: 'ICICI Direct', hints: ['stock symbol', 'demat free qty', 'average cost'] },
];

function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim();
}

export type ImportMode = 'positions' | 'transactions';

export interface HeaderMapping {
  columns: Partial<Record<ImportField, number>>;
  detected: string | null;
  headerRow: number;
  looksLikeFunds: boolean;
  mode: ImportMode;
}

export function mapHeaders(rows: string[][]): HeaderMapping | null {
  const limit = Math.min(rows.length, 12);

  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const headers = rows[rowIndex].map(normaliseHeader);
    const columns: Partial<Record<ImportField, number>> = {};

    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as Array<[ImportField, string[]]>) {
      let index = headers.findIndex((header) => aliases.includes(header));

      // Walk aliases in specificity order so "average buy price" wins over a bare "price".
      for (const alias of aliases) {
        if (index !== -1) break;
        index = headers.findIndex((header) => header.length > 2 && header.includes(alias));
      }

      if (index !== -1) columns[field] = index;
    }

    const hasIdentity = columns.symbol !== undefined || columns.isin !== undefined || columns.name !== undefined;
    if (hasIdentity && columns.quantity !== undefined) {
      const joined = headers.join(' ');
      const detected =
        SIGNATURES.find((signature) => signature.hints.filter((hint) => joined.includes(hint)).length >= 2)?.label ??
        null;

      const looksLikeFunds =
        /\bscheme\b|\bfolio\b|\bnav\b|\bunits\b/.test(joined) && !/tradingsymbol|closing price/.test(joined);

      // A ledger export names the action per row and dates it; a holdings export does neither.
      const mode: ImportMode =
        columns.transactionType !== undefined && columns.buyDate !== undefined ? 'transactions' : 'positions';

      return { columns, detected, headerRow: rowIndex, looksLikeFunds, mode };
    }
  }

  return null;
}

export const SUPPORTED_FORMATS = SIGNATURES.map((signature) => signature.label);

const EXACT_TYPES: Record<string, 'BUY' | 'SELL' | 'DIVIDEND'> = {
  b: 'BUY',
  buy: 'BUY',
  s: 'SELL',
  sell: 'SELL',
  d: 'DIVIDEND',
};

const BUY_WORDS = ['buy', 'purchase', 'sip', 'invest', 'bought', 'switch in', 'credit'];
const SELL_WORDS = ['sell', 'redeem', 'redemption', 'sold', 'withdraw', 'switch out', 'debit'];
const DIVIDEND_WORDS = ['dividend', 'idcw', 'payout'];

export function normaliseTransactionType(raw: string | undefined): 'BUY' | 'SELL' | 'DIVIDEND' | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  // Single-letter codes only ever match exactly: "SIP" and "Purchase" both contain an "s".
  if (EXACT_TYPES[value]) return EXACT_TYPES[value];

  if (DIVIDEND_WORDS.some((word) => value.includes(word))) return 'DIVIDEND';
  if (SELL_WORDS.some((word) => value.includes(word))) return 'SELL';
  if (BUY_WORDS.some((word) => value.includes(word))) return 'BUY';

  return null;
}
