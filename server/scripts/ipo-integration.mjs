import 'dotenv/config';

process.env.NODE_ENV = 'development';
// Neither suite touches the database; this only satisfies environment validation at import.
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/investiq_ipo_test';

const ROOT = new URL('../dist', import.meta.url).href;
const { analyse, buildCalibration, slugify } = await import(`${ROOT}/modules/ipo/ipo.service.js`);
const { fetchCurrent, fetchGmp, fetchUpcoming } = await import(`${ROOT}/modules/ipo/ipo.sources.js`);

let failures = 0;
const check = (label, cond, extra = '') => {
  if (!cond) failures += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const warn = (label, extra = '') => console.log(`WARN  ${label}${extra ? '  ' + extra : ''}`);

// --- calibration ---------------------------------------------------------------------------------

// 60 issues: a 40% grey market premium that consistently listed at +30%, and a zero premium that fell.
const history = [
  ...Array.from({ length: 40 }, () => ({ name: 'Hot', issuePrice: 100, gmp: 40, listingPrice: 130 })),
  ...Array.from({ length: 20 }, () => ({ name: 'Cold', issuePrice: 100, gmp: 0, listingPrice: 95 })),
];

const calibration = buildCalibration(history);
check('calibration is built from a large enough sample', calibration !== null);
check('sample size is reported honestly', calibration?.sampleSize === 60, `n=${calibration?.sampleSize}`);

const hot = calibration?.bands.find((band) => band.band === '35-60%');
check('the premium band is measured on its own outcomes', hot?.medianActual === 30, `median=${hot?.medianActual}`);
check('the positive rate is reported per band', hot?.positiveRate === 100, `rate=${hot?.positiveRate}`);
check(
  'the grey market overstating the gain is recorded as a negative error',
  hot?.medianGmpError === -10,
  `error=${hot?.medianGmpError}`,
);

const cold = calibration?.bands.find((band) => band.band === 'No premium');
check('a zero premium is scored on what it actually did', cold?.medianActual === -5, `median=${cold?.medianActual}`);
check('directional accuracy counts both directions', calibration?.directionalAccuracy === 100);
check('too small a history refuses to produce base rates', buildCalibration(history.slice(0, 10)) === null);

// --- analysis ------------------------------------------------------------------------------------

const base = {
  symbol: 'TEST', slug: 'test', name: 'Test Issue', board: 'mainboard', status: 'open',
  priceBand: { min: 100, max: 100, label: '₹100' }, issueSize: null,
  openDate: null, closeDate: null, listingDate: null, dateLabel: null, gmp: null, subscription: null,
};
const gmp = (premium) => ({ premium, premiumPercent: premium, estimatedListing: 100 + premium, trend: 'up', updatedAt: null, source: 'test' });
const book = (total, qib) => ({
  total,
  categories: [
    { label: 'Qualified Institutional Buyers', key: 'qib', times: qib, offered: null, bid: null },
    { label: 'Retail Individual Investors', key: 'rii', times: 4, offered: null, bid: null },
  ],
  source: 'test',
});

const nothing = analyse({ ...base }, calibration);
check('an issue with no data is called insufficient rather than scored', nothing.stance === 'insufficient', nothing.stance);
check('a scoreless verdict carries no score', nothing.score === null);

const strong = analyse({ ...base, gmp: gmp(40), subscription: book(25, 12) }, calibration);
check('a strong book and premium leans towards applying', strong.stance === 'apply', `${strong.stance} ${strong.score}`);

const conflicted = analyse({ ...base, gmp: gmp(40), subscription: book(20, 0.5) }, calibration);
check(
  'an undersubscribed institutional book overrides a bullish grey market',
  conflicted.stance === 'consider',
  `${conflicted.stance} ${conflicted.score}`,
);
check(
  'and the disagreement is stated rather than buried',
  conflicted.caveats.some((caveat) => /institutional investors are not bidding/i.test(caveat)),
);

const weak = analyse({ ...base, gmp: gmp(0), subscription: book(0.4, 0.2) }, calibration);
check('an unwanted issue leans against applying', weak.stance === 'avoid', `${weak.stance} ${weak.score}`);

const gmpOnly = analyse({ ...base, gmp: gmp(40) }, calibration);
check('a grey market quote alone never reads as a firm call', gmpOnly.stance === 'consider', gmpOnly.stance);

check(
  'every verdict warns that the grey market is unofficial',
  [strong, conflicted, weak, gmpOnly].every((analysis) =>
    analysis.caveats.some((caveat) => /unofficial and unregulated/i.test(caveat)),
  ),
);

const sme = analyse({ ...base, board: 'sme', gmp: gmp(40), subscription: book(25, 12) }, calibration);
check('SME issues carry their own liquidity warning', sme.caveats.some((caveat) => /SME issues/i.test(caveat)));

check('slugs are URL safe', slugify('Maharaja & Speedex Ltd.') === 'maharaja-speedex-ltd');

// --- live source shape ---------------------------------------------------------------------------
// These sources are public endpoints and a scraped page, so their shape is worth asserting: a silent
// change upstream would otherwise show up as an empty IPO page rather than a failure.

const [upcoming, current, greyMarket] = await Promise.all([fetchUpcoming(), fetchCurrent(), fetchGmp()]);

if (!upcoming && !current) warn('NSE unreachable — skipping live shape checks');
else {
  const rows = [...(upcoming ?? []), ...(current ?? [])];
  check('NSE returns issues', rows.length > 0, `rows=${rows.length}`);
  check(
    'every NSE issue still carries a company, symbol and dates',
    rows.every((row) => row.companyName && row.symbol && row.issueStartDate && row.issueEndDate),
  );
}

if (!greyMarket) warn('grey market source unreachable — skipping its shape checks');
else {
  check('the grey market page still yields live rows', greyMarket.live.length > 0, `rows=${greyMarket.live.length}`);
  check('live rows carry a name and a premium', greyMarket.live.every((row) => row.name && row.premium !== null));
  check('both boards are represented', new Set(greyMarket.live.map((row) => row.board)).size === 2);
  check('the outcome archive is still present', greyMarket.history.length >= 50, `rows=${greyMarket.history.length}`);
  check(
    'archive rows carry an issue price and a listing price',
    greyMarket.history.every((row) => row.issuePrice > 0 && row.listingPrice > 0),
  );

  const live = buildCalibration(greyMarket.history);
  check('real history produces usable base rates', (live?.bands.length ?? 0) >= 4, `bands=${live?.bands.length}`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
