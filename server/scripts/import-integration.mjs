import 'dotenv/config';

if (!process.env.MONGODB_URI) {
  console.error('Set MONGODB_URI in server/.env before running this script.');
  process.exit(1);
}
if (/\/(investiq|prod)(\?|$)/.test(process.env.MONGODB_URI) && !process.env.ALLOW_NON_TEST_DB) {
  console.error('Point MONGODB_URI at a throwaway database (e.g. .../investiq_test) — this script writes and deletes data.');
  process.exit(1);
}

process.env.NODE_ENV = 'development';
const ROOT = new URL('../dist', import.meta.url).href;
const { connectDatabase } = await import(`${ROOT}/config/database.js`);
const mongoose = (await import('mongoose')).default;
const { commitRows, commitTransactions, buildPreview } = await import(`${ROOT}/modules/import/import.service.js`);
const { FundScheme } = await import(`${ROOT}/modules/funds/fund.model.js`);
const { Holding } = await import(`${ROOT}/modules/portfolio/portfolio.model.js`);

await connectDatabase();
const db = mongoose.connection.db;

let failures = 0;
const check = (label, cond, extra = '') => {
  if (!cond) failures += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

const EMAIL = 'import-suite@plumbline.local';
await db.collection('users').deleteMany({ email: EMAIL });
const userId = new mongoose.Types.ObjectId();
await db.collection('users').insertOne({
  _id: userId, name: 'Import Suite', email: EMAIL, password: 'x', role: 'user',
  providers: ['email'], emailVerified: true, createdAt: new Date(), updatedAt: new Date(),
});
const portfolioId = new mongoose.Types.ObjectId();
await db.collection('portfolios').insertOne({
  _id: portfolioId, userId, name: 'Suite portfolio', baseCurrency: 'INR', createdAt: new Date(), updatedAt: new Date(),
});
const pid = String(portfolioId);

const equity = (quantity, avgBuyPrice) => [{ assetType: 'EQUITY', symbol: 'RELIANCE', exchange: 'NSE', quantity, avgBuyPrice }];
const qtyOf = async () => (await Holding.findOne({ portfolioId, symbol: 'RELIANCE' }))?.quantity ?? 0;

// --- a balances file imported twice must not double the position --------------------------------
await commitRows(userId, pid, equity(40, 1180), 'replace');
check('a statement balance creates the position', (await qtyOf()) === 40, `qty=${await qtyOf()}`);

let r = await commitRows(userId, pid, equity(40, 1180), 'replace');
check('re-importing the same balance leaves the quantity alone', (await qtyOf()) === 40, `qty=${await qtyOf()}`);
check('and reports it as already up to date', r.skipped === 1 && r.added === 0, `added=${r.added} skipped=${r.skipped}`);

// --- a later statement corrects the position rather than stacking on it --------------------------
r = await commitRows(userId, pid, equity(55, 1200), 'replace');
check('a newer balance updates the position', (await qtyOf()) === 55, `qty=${await qtyOf()}`);
check('and counts as written, not skipped', r.added === 1 && r.skipped === 0, `added=${r.added} skipped=${r.skipped}`);

// --- "add" still means add, for order-history style files ----------------------------------------
await commitRows(userId, pid, equity(5, 1300), 'add');
check('the add strategy still accumulates', (await qtyOf()) === 60, `qty=${await qtyOf()}`);

// --- transactions imported twice must not double the ledger -------------------------------------
await db.collection('holdings').deleteMany({ portfolioId });
await db.collection('transactions').deleteMany({ portfolioId });

const txns = [
  { assetType: 'EQUITY', symbol: 'INFY', exchange: 'NSE', type: 'BUY', quantity: 10, price: 1500, fees: 0, date: '2026-01-05T00:00:00.000Z' },
  { assetType: 'EQUITY', symbol: 'INFY', exchange: 'NSE', type: 'BUY', quantity: 5, price: 1600, fees: 0, date: '2026-02-05T00:00:00.000Z' },
];

r = await commitTransactions(userId, pid, txns);
check('transactions import first time', r.added === 2 && r.skipped === 0, `added=${r.added} skipped=${r.skipped}`);

r = await commitTransactions(userId, pid, txns);
check('re-importing the same transactions adds nothing', r.added === 0 && r.skipped === 2, `added=${r.added} skipped=${r.skipped}`);
check('and the ledger still holds one copy', (await db.collection('transactions').countDocuments({ portfolioId })) === 2);

// An overlapping statement: the two above plus one genuinely new row.
r = await commitTransactions(userId, pid, [
  ...txns,
  { assetType: 'EQUITY', symbol: 'INFY', exchange: 'NSE', type: 'BUY', quantity: 3, price: 1700, fees: 0, date: '2026-03-05T00:00:00.000Z' },
]);
check('an overlapping statement adds only what is new', r.added === 1 && r.skipped === 2, `added=${r.added} skipped=${r.skipped}`);

// --- a ledger-backed position is never overwritten by a stated balance ---------------------------
const before = (await Holding.findOne({ portfolioId, symbol: 'INFY' }))?.quantity;
r = await commitRows(userId, pid, [{ assetType: 'EQUITY', symbol: 'INFY', exchange: 'NSE', quantity: 999, avgBuyPrice: 1, }], 'replace');
const after = (await Holding.findOne({ portfolioId, symbol: 'INFY' }))?.quantity;
check('a balance does not overwrite a position built from transactions', before === after, `${before} -> ${after}`);
check('and the row is reported as skipped', r.skipped === 1 && r.added === 0, `added=${r.added} skipped=${r.skipped}`);

// --- a new fund AMFI does not list yet must not be matched to a lookalike ----------------------------
// ICICI runs a Dynamic Asset Allocation "Active FOF" (priced ~₹136) and launched a "Passive FOF" at ₹10.
// Until AMFI publishes the new one, a statement row for it must stay unmatched rather than borrow the
// older fund's price and turn a ₹3,000 purchase into a ₹41,000 holding.
const SEEDED = ['99120679', '99120680'];
await FundScheme.deleteMany({ schemeCode: { $in: SEEDED } });
await FundScheme.create([
  { schemeCode: '99120679', name: 'ICICI Prudential Dynamic Asset Allocation Active FOF Direct Plan Growth',
    searchName: 'icici prudential dynamic asset allocation active fof direct plan growth',
    plan: 'Direct Plan', option: 'Growth', fundHouse: 'ICICI Prudential Mutual Fund',
    category: 'Other Scheme - FoF Domestic', isin: 'INF109K01X16', nav: 136.5547, navDate: new Date() },
  { schemeCode: '99120680', name: 'ICICI Prudential Dynamic Asset Allocation Active FOF Direct Plan IDCW',
    searchName: 'icici prudential dynamic asset allocation active fof direct plan idcw',
    plan: 'Direct Plan', option: 'IDCW', fundHouse: 'ICICI Prudential Mutual Fund',
    category: 'Other Scheme - FoF Domestic', isin: 'INF109K01W90', nav: 107.0857, navDate: new Date() },
]);

const casFor = (isinLine) => [
  'Consolidated Account Statement',
  'Folio No: 22222222 / 39',
  `P 9784 - ICICI Prudential Dynamic Asset Allocation Passive FOF - Direct Plan - Growth ( Demat ) ${isinLine}`,
  'Opening Unit Balance: 500.000',
  '15-Sep-2026 NFO-Purchase - INZ000000000 3,000.00 300.000 10.0000 800.000',
  'Closing Unit Balance: 800.000 NAV on 15-Sep-2026: INR 10.0000 Total Cost Value: 8,000.00 Market Value on 15-Sep-2026: INR 8,000.00',
].join('\n');

let preview = await buildPreview(casFor('- ISIN : INF 109 K 1 A 641 ( Advisor : INZ 000000000 )'));
let nfo = preview.rows.find((row) => /Passive FOF/i.test(row.name ?? ''));
check('an ISIN AMFI does not list is not matched to a lookalike', nfo && nfo.fund === null, nfo?.fund?.name ?? 'unmatched');
check('and the preview says why', nfo?.issues.some((issue) => /does not list ISIN/i.test(issue)));
check('and it is not counted as importable', preview.importable === 0, `importable=${preview.importable}`);

// Without an ISIN the name matcher runs, and "Passive" must not resolve to "Active".
preview = await buildPreview(casFor(''));
nfo = preview.rows.find((row) => /Passive FOF/i.test(row.name ?? ''));
check('a Passive scheme name does not match an Active scheme', !nfo?.fund || !/\bactive\b/i.test(nfo.fund.name),
  nfo?.fund?.name ?? 'unmatched');

await FundScheme.deleteMany({ schemeCode: { $in: SEEDED } });

await db.collection('users').deleteMany({ email: EMAIL });
await db.collection('portfolios').deleteMany({ _id: portfolioId });
await db.collection('holdings').deleteMany({ portfolioId });
await db.collection('transactions').deleteMany({ portfolioId });
console.log('\nTest data cleaned up.');

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
await mongoose.connection.close();
process.exit(failures ? 1 : 0);
