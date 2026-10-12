import 'dotenv/config';
process.env.NODE_ENV = 'development';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/investiq_bonds_test';

const ROOT = new URL('../dist', import.meta.url).href;
const { yieldToMaturity, ratingGrade } = await import(`${ROOT}/modules/bonds/bond.service.js`);
const { parseBonds, fetchBonds } = await import(`${ROOT}/modules/bonds/nse.bonds.js`);

let failures = 0;
const check = (label, cond, extra = '') => {
  if (!cond) failures += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

const today = new Date(Date.UTC(2026, 0, 1));
const inYears = (y) => new Date(Date.UTC(2026 + y, 0, 1));

// --- redemption yield ------------------------------------------------------------------------------
check('a bond at par yields its coupon', yieldToMaturity(1000, 1000, 8, inYears(5), today) === 8,
  `${yieldToMaturity(1000, 1000, 8, inYears(5), today)}%`);
check('a discount yields more than the coupon', (yieldToMaturity(900, 1000, 8, inYears(5), today) ?? 0) > 8);
check('a premium yields less than the coupon', (yieldToMaturity(1100, 1000, 8, inYears(5), today) ?? 99) < 8);
check('a zero-coupon bond is priced off the pull to par',
  Math.abs((yieldToMaturity(700, 1000, 0, inYears(5), today) ?? 0) - 7.39) < 0.05,
  `${yieldToMaturity(700, 1000, 0, inYears(5), today)}%`);

// Inside a year the accrued interest a buyer pays is unknown and dominates, so no figure is offered
// rather than the 500% that assuming a full coupon produces.
check('nothing is quoted inside a year to maturity',
  yieldToMaturity(1000, 1000, 8.65, new Date(Date.UTC(2026, 0, 19)), today) === null);
check('a matured bond yields nothing', yieldToMaturity(1000, 1000, 8, new Date(Date.UTC(2025, 0, 1)), today) === null);
check('an implausible result is withheld', yieldToMaturity(1, 1000, 8, inYears(2), today) === null,
  `${yieldToMaturity(1, 1000, 8, inYears(2), today)}`);
check('a missing price yields nothing', yieldToMaturity(null, 1000, 8, inYears(5), today) === null);

// --- credit ratings ---------------------------------------------------------------------------------
check('the leading grade is taken from a compound rating', ratingGrade('AA/Stable, AA+/Negative') === 'AA');
check('a simple rating parses', ratingGrade('AAA/Stable') === 'AAA');
check('a missing rating stays missing', ratingGrade(null) === null);
check('unrecognised text is not invented into a grade', ratingGrade('Provisional') === null);

// --- the feed's own shape ---------------------------------------------------------------------------
const rows = parseBonds({ data: [
  { symbol: 'TEST26', isin: 'INE000A08001', coupr: '9.60', maturity_date: '03-Nov-2028',
    credit_rating: 'AA/Stable', rating_agency: 'CRISIL', face_value: '1000',
    ltP: '', close: '1002.5', per: '-0.25', qty: '0', series: 'N5' },
  { symbol: 'TEST27', isin: 'INE000A08002', coupr: '8.00', maturity_date: '01-Jan-2030',
    face_value: '1000', ltP: '990', close: '985', qty: '120', series: 'NF' },
] }, 'corporate');

check('a bond that did not trade falls back to its close', rows[0].price === 1002.5 && !rows[0].tradedToday);
check('a bond that traded uses its traded price', rows[1].price === 990 && rows[1].tradedToday);
check('the maturity date parses', rows[0].maturity?.getUTCFullYear() === 2028);
check('a missing rating does not break the row', rows[1].creditRating === null);

// --- the live endpoint still looks like this --------------------------------------------------------
// It is undocumented, so a change of shape has to fail loudly rather than quietly empty the page.
const live = await fetchBonds('corporate');
if (!live.length) {
  console.log('WARN  NSE bond feed unreachable — shape not asserted this run');
} else {
  check('the live feed still returns bonds', live.length > 100, `${live.length} rows`);
  check('coupons are published for most of them',
    live.filter((b) => b.couponRate !== null).length / live.length > 0.8);
  check('maturities are published', live.filter((b) => b.maturity !== null).length / live.length > 0.9);
  check('a price is available for every row', live.filter((b) => b.price !== null).length / live.length > 0.95);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
