import 'dotenv/config';
import { readFileSync } from 'node:fs';

process.env.NODE_ENV = 'development';
// Neither suite touches the database; this only satisfies environment validation at import.
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/investiq_cas_test';

// Two synthetic CAMS-format statements, both protected with the PAN-style password a registrar uses.
// They are generated rather than real so no personal holding data lives in the repository.
const PASSWORD = 'ABCDE1234F';
const FIXTURES = new URL('./fixtures/', import.meta.url);
const ROOT = new URL('../dist', import.meta.url).href;

const { extractPdfText } = await import(`${ROOT}/modules/import/parsers/pdfText.js`);
const { looksLikeCas, parseCasText } = await import(`${ROOT}/modules/import/parsers/cas.js`);

let failures = 0;
const check = (label, cond, extra = '') => {
  if (!cond) failures += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

const read = (name) => new Uint8Array(readFileSync(new URL(name, FIXTURES)));

// --- password handling -------------------------------------------------------------------------

const messageFor = async (name, password) => {
  try {
    await extractPdfText(read(name), password);
    return null;
  } catch (error) {
    return error.message;
  }
};

const missing = await messageFor('cas-period.pdf', undefined);
check('a protected statement asks for a password', /password protected/i.test(missing ?? ''), missing ?? '');

const wrong = await messageFor('cas-period.pdf', 'NOT-THE-PASSWORD');
check('a wrong password says so rather than failing generically', /did not open/i.test(wrong ?? ''), wrong ?? '');

// --- period statement: current units and cost ----------------------------------------------------

const period = await extractPdfText(read('cas-period.pdf'), PASSWORD);
check('a CAS is recognised from its text', looksLikeCas(period.text));

const positions = parseCasText(period.text);
check('a statement with an opening balance imports positions', positions.mode === 'positions', positions.mode);
check('both schemes are found', positions.schemes === 2, `schemes=${positions.schemes}`);

const hdfc = positions.rows.find((row) => row.isin === 'INF179K01608');
check('closing units are read from the statement footer', hdfc?.quantity === 156.17, `units=${hdfc?.quantity}`);
check(
  'average cost is derived from the stated total cost',
  Math.abs((hdfc?.avgBuyPrice ?? 0) - 55_000 / 156.17) < 0.01,
  `avg=${hdfc?.avgBuyPrice}`,
);
check('every fund row carries its ISIN for exact matching', positions.rows.every((row) => row.isin));

// --- since-inception statement: full ledger -------------------------------------------------------

const full = parseCasText((await extractPdfText(read('cas-since-inception.pdf'), PASSWORD)).text);
check('a statement starting from zero imports transactions', full.mode === 'transactions', full.mode);
check('the ledger is complete', full.completeHistory === true);

const types = full.rows.map((row) => row.transactionType);
check('purchases, redemptions and payouts are all classified', types.includes('BUY') && types.includes('SELL') && types.includes('DIVIDEND'), types.join(','));
check('stamp duty is not imported as a transaction', full.rows.length === 5, `rows=${full.rows.length}`);

const axis = full.rows.filter((row) => row.isin === 'INF846K01131');
const axisUnits = axis.reduce(
  (sum, row) => sum + (row.transactionType === 'BUY' ? row.quantity : row.transactionType === 'SELL' ? -row.quantity : 0),
  0,
);
check('replaying the ledger reproduces the closing balance', Math.abs(axisUnits - 645.255) < 0.001, `units=${axisUnits}`);
check(
  'a redemption printed in parentheses is read as a sale, not a negative buy',
  axis.some((row) => row.transactionType === 'SELL' && row.quantity > 0),
);

// --- multi-page statements ------------------------------------------------------------------------

// Registrars reprint the fund-house banner on every continuation page. It must not be mistaken for a
// scheme: a phantom scheme swallows the rows that follow, and they then import under the wrong fund.
const banner = parseCasText(
  [
    'Consolidated Account Statement',
    'PORTFOLIO SUMMARY',
    'Mutual Fund Cost Value Market Value',
    'HDFC Mutual Fund 11,000.00 13,200.00',
    'Folio No: 12345678 / 09',
    'H101G-HDFC Gold ETF Fund of Fund - Direct Plan Growth (Advisor: DIRECT) Registrar : CAMS',
    'ISIN: INF179K01VX0',
    'Date Transaction Amount Units NAV Unit Balance',
    'Opening Unit Balance 0.000',
    '07-Aug-2025 Purchase 2,000.00 20.000 100.0000 20.000',
    'Page 1 of 3',
    'HDFC Mutual Fund',
    '23-Jan-2026 Purchase 5,000.00 100.000 50.0000 120.000',
    '09-Mar-2026 Purchase 4,000.00 100.000 40.0000 220.000',
    'Closing Unit Balance: 220.000 NAV on 07-Sep-2026: INR 60.0000',
    'Total Cost Value: 11,000.00 Market Value on 07-Sep-2026: INR 13,200.00',
  ].join('\n'),
);

check('a fund-house banner does not become a scheme of its own', banner.schemes === 1, `schemes=${banner.schemes}`);
check('rows after a banner keep the real scheme name', banner.rows.every((row) => /Gold ETF/.test(row.name ?? '')));
check('rows after a banner keep the scheme ISIN', banner.rows.every((row) => row.isin === 'INF179K01VX0'));
check(
  'no transaction is lost across the page break',
  Math.abs(banner.rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0) - 220) < 0.001,
);

// A scheme whose block is split across pages reprints its folio and header. Both halves belong to one
// position, so resuming it — rather than forking a second, partial scheme — is what keeps units right.
const split = parseCasText(
  [
    'Folio No: 12345678 / 09',
    'Q101G-Quant Small Cap Fund - Direct Plan Growth (Advisor: DIRECT) Registrar : CAMS',
    'ISIN: INF966L01986',
    'Opening Unit Balance 0.000',
    '07-Aug-2025 Purchase 2,000.00 20.000 100.0000 20.000',
    'Consolidated Account Statement',
    'Folio No: 12345678 / 09',
    'Q101G-Quant Small Cap Fund - Direct Plan Growth (Advisor: DIRECT) Registrar : CAMS',
    'ISIN: INF966L01986',
    '23-Jan-2026 Purchase 5,000.00 100.000 50.0000 120.000',
    'Closing Unit Balance: 120.000 NAV on 07-Sep-2026: INR 60.0000',
    'Total Cost Value: 7,000.00 Market Value on 07-Sep-2026: INR 7,200.00',
  ].join('\n'),
);

check('a scheme split across pages is one position, not two', split.schemes === 1, `schemes=${split.schemes}`);
check('a split scheme reconciles against its printed balance', split.completeHistory, `mode=${split.mode}`);

// The replay has to start from the opening balance, or every statement that begins mid-life looks
// like a misread and is wrongly reported as failing to reconcile.
const opening = parseCasText(
  [
    'Folio No: 55',
    'A1-Axis ELSS Tax Saver Fund - Regular Plan - Growth (Advisor: INA000001) Registrar : KFINTECH',
    'ISIN: INF846K01131',
    'Opening Unit Balance 500.000',
    '12-Jun-2025 Purchase 80,000.00 842.105 95.0000 1,342.105',
    'Closing Unit Balance: 1,342.105 NAV on 07-Sep-2026: INR 106.4200',
    'Total Cost Value: 80,000.00 Market Value on 07-Sep-2026: INR 142,847.81',
  ].join('\n'),
);

check('an opening balance counts towards the replay', opening.reconciliation.failed.length === 0, opening.notice ?? '');
check('a statement that starts mid-life imports positions', opening.mode === 'positions', `mode=${opening.mode}`);

// --- real-registrar formatting ---------------------------------------------------------------------

// A PDF text layer splits an ISIN into glyph runs ("INF 179 KC 1 GI 5"), the scheme carries the
// registrar's code and a "( Demat )" tag, and the footer prints balance, NAV and cost on one line.
const demat = parseCasText(
  [
    'Folio No: 11111111 / 35 PAN: ABCDE1234F PAN: OK',
    'HHDDGR - HDFC Defence Fund Direct Growth ( Demat ) - ISIN : INF 179 KC 1 GI 5 ( Advisor : INZ 000000000 ) Registrar : CAMS',
    'Opening Unit Balance: 0.000',
    '06-Jul-2026 SIP Purchase Instalment No - 1 Online 500.00 20.000 25.0000 20.000',
    '06-Jul-2026 *** Stamp Duty *** 0.02',
    '03-Aug-2026 Sys. Investment (2/999) 500.00 25.000 20.0000 45.000',
    '03-Sep-2026 Frobnicated Allotment 500.00 10.000 50.0000 55.000',
    'Closing Unit Balance: 55.000 NAV on 04-Sep-2026: INR 30.0000 Total Cost Value: 1,500.00 Market Value on 04-Sep-2026: INR 1,650.00',
  ].join('\n'),
);

check('an ISIN split by the PDF text layer is still read', demat.rows.every((row) => row.isin === 'INF179KC1GI5'));
check('the registrar code prefix is stripped from the scheme name', demat.detail[0]?.name === 'HDFC Defence Fund Direct Growth', demat.detail[0]?.name);
check('a "( Demat )" tag is not part of the scheme name', !/demat/i.test(demat.detail[0]?.name ?? ''));
check('total cost printed on the closing line is read', demat.detail[0]?.costValue === 1500, `cost=${demat.detail[0]?.costValue}`);
check('"Sys. Investment" is a purchase, not an unknown row', demat.rows.length === 3, `rows=${demat.rows.length}`);
check('an unrecognised wording with a full row shape still imports', demat.rows.some((row) => Math.abs((row.quantity ?? 0) - 10) < 0.001));
check('the whole block reconciles', demat.completeHistory && Math.abs(demat.detail[0].replayed - 55) < 0.001);

// "Redemption - NEFT PAYOUT" describes how the money was sent. Reading it as a dividend leaves the
// units in the portfolio and silently overstates the holding.
const payout = parseCasText(
  [
    'Folio No: 1',
    'HGOLD - HDFC Gold ETF Fund of Fund - Direct Plan - Growth Option ( Demat ) - ISIN : INF 179 K 01 VX 0 ( Advisor : X ) Registrar : CAMS',
    'Opening Unit Balance: 0.000',
    '09-Mar-2026 Purchase Online 3,000.00 60.000 50.0000 60.000',
    '21-Aug-2026 Redemption - NEFT PAYOUT - 9900112233 (2,940.00) (60.000) 49.0000 0.000',
    'Closing Unit Balance: 0.000 NAV on 04-Sep-2026: INR 49.0000 Total Cost Value: 0.00 Market Value on 04-Sep-2026: INR 0.00',
  ].join('\n'),
);

check('a redemption paid out by NEFT is a sale, not a dividend', payout.rows.some((row) => row.transactionType === 'SELL'));
check('an exited position replays back to zero', Math.abs(payout.detail[0]?.replayed ?? -1) < 0.001, `replayed=${payout.detail[0]?.replayed}`);

// A fund house name at the head of a scheme must survive: only a code-like prefix is a prefix.
const nippon = parseCasText(
  [
    'Folio No: 333333333333 / 0',
    'RMFEAAGG - NIPPON INDIA LARGE CAP FUND - DIRECT GROWTH PLAN GROWTH OPTION ( Demat ) - ISIN : INF 204 K 01 XI 3 ( Advisor : INZ 000000000 )',
    'Opening Unit Balance: 0.000',
    '07-Aug-2025 Sys. Investment New Purchase with SIP (1/1000) 1,000.00 10.000 100.0000 10.000',
    'Closing Unit Balance: 10.000 NAV on 04-Sep-2026: INR 101.0000 Total Cost Value: 1,000.00 Market Value on 04-Sep-2026: INR 1,010.00',
  ].join('\n'),
);

check('a fund house at the head of a scheme name is kept', /^NIPPON INDIA LARGE CAP FUND/.test(nippon.detail[0]?.name ?? ''), nippon.detail[0]?.name);

// A scheme whose name abbreviates "Fund of Fund" to "FoF" carries none of the words the reader looks
// for. Dropping it loses the whole position silently — an ISIN on the line is proof enough.
const fof = parseCasText(
  [
    'Folio No: 444444444444 / 0 KYC: NOT OK PAN: NOT OK',
    '128 GSDGG - Axis Gold and Silver Passive FoF - Direct Growth ( Demat ) - ISIN : INF 846 KA 1408 ( Advisor : INZ 000000000 )',
    'Opening Unit Balance: 0.000',
    '12-Mar-2026 Purchase 3,999.80 332.624 12.0250 332.624',
    '21-Aug-2026 Redemption Directly credited to your Bank account (DC-NSE) (3,842.24) (332.624) 11.5513 0.000',
    'Closing Unit Balance: 0.000 NAV on 04-Sep-2026: INR 11.1366 Total Cost Value: 0.00 Market Value on 04-Sep-2026: INR 0.00',
  ].join('\n'),
);

check('a "FoF" scheme is not dropped for lacking the word "Fund"', fof.schemes === 1, `schemes=${fof.schemes}`);
check('a FoF scheme keeps its ISIN', fof.rows.every((row) => row.isin === 'INF846KA1408'), fof.rows[0]?.isin);
check('a fully exited FoF still contributes its buy and sell', fof.rows.length === 2, `rows=${fof.rows.length}`);

// --- not a statement ------------------------------------------------------------------------------

check('an ordinary CSV is not mistaken for a CAS', !looksLikeCas('Stock Name,Quantity,Average buy price\nReliance,40,1180'));

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
