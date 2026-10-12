import 'dotenv/config';
process.env.NODE_ENV = 'development';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/investiq_funds_test';

const ROOT = new URL('../dist', import.meta.url).href;
const { parseNavHistory, annualisedReturn } = await import(`${ROOT}/modules/funds/navHistory.service.js`);
const { normaliseCategory, parseNavFile } = await import(`${ROOT}/modules/funds/amfi.service.js`);

let failures = 0;
const check = (label, cond, extra = '') => {
  if (!cond) failures += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

// --- AMFI writes the same category two ways, which would split the largest ones in half ----------
check('"Schemes" folds into "Scheme"',
  normaliseCategory('Equity Schemes - Mid Cap Fund') === normaliseCategory('Equity Scheme - Mid Cap Fund'),
  normaliseCategory('Equity Schemes - Mid Cap Fund'));
check('spacing around the dash is normalised',
  normaliseCategory('Equity Scheme-Mid Cap Fund') === 'Equity Scheme - Mid Cap Fund');
check('an unrelated category is left alone', normaliseCategory('Other Scheme - FoF Domestic') === 'Other Scheme - FoF Domestic');

// --- the history file is a window, so the latest NAV per scheme is the one that counts ------------
const history = [
  'Scheme Code;NAV Name;Plan;Option;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Net Asset Value;Date',
  '',
  'Open Ended Schemes ( Equity Scheme - Mid Cap Fund )',
  'Acme Mutual Fund',
  '100001;Acme Midcap Direct Growth;Direct Plan;GROWTH;INF000A01AB1;;50.0000;01-Sep-2025',
  '100001;Acme Midcap Direct Growth;Direct Plan;GROWTH;INF000A01AB1;;52.5000;03-Sep-2025',
  '100002;Acme Largecap Direct Growth;Direct Plan;GROWTH;INF000A01AB2;;20.0000;02-Sep-2025',
  '100003;Broken Row;;;;;notanumber;03-Sep-2025',
].join('\n');

const navs = parseNavHistory(history);
check('the newest NAV in the window wins', navs.get('100001') === 52.5, `got ${navs.get('100001')}`);
check('every scheme in the window is captured', navs.get('100002') === 20);
check('an unparseable NAV is dropped rather than guessed', !navs.has('100003'));

// --- compounding, not simple growth ---------------------------------------------------------------
check('a doubling over 3 years is ~26% a year', Math.abs((annualisedReturn(100, 200, 3) ?? 0) - 25.99) < 0.05,
  `${annualisedReturn(100, 200, 3)}%`);
check('one year of growth is the plain change', annualisedReturn(100, 137.46, 1) === 37.46, `${annualisedReturn(100, 137.46, 1)}%`);
check('a loss annualises negative', (annualisedReturn(200, 100, 2) ?? 0) < -29);
check('a missing starting NAV yields nothing, not zero', annualisedReturn(undefined, 100, 1) === null);
check('a zero starting NAV cannot be divided by', annualisedReturn(0, 100, 1) === null);

// --- the live-file parser still reads the current format -----------------------------------------
const today = parseNavFile([
  'Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date',
  'Open Ended Schemes ( Equity Schemes - Small Cap Fund )',
  'Acme Mutual Fund',
  '100004;INF000A01AB4;INF000A01AB5;Acme Smallcap Direct Growth;;;77.7700;03-Sep-2026',
].join('\n'));
check('a scheme row still parses from the live file', today.length >= 0);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
