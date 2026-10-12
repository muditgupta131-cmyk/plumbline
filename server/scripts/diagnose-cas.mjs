import 'dotenv/config';
import { readFileSync } from 'node:fs';

process.env.NODE_ENV = 'development';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/investiq_diag';

/**
 * Reports how a real consolidated statement parses, without disclosing what it holds.
 *
 * Every digit is replaced with 9 by default, so amounts, units, folio numbers and PANs cannot be
 * read from the output — only the *shape* of each line survives, which is what a parser bug shows up
 * in. Pass --full to keep the real numbers if you would rather share them.
 *
 *   node scripts/diagnose-cas.mjs <path-to-cas.pdf> <password> [--full]
 */

const [, , file, password, ...flags] = process.argv;
const full = flags.includes('--full');

if (!file) {
  console.error('usage: node scripts/diagnose-cas.mjs <path-to-cas.pdf> <password> [--full]');
  process.exit(1);
}

const ROOT = new URL('../dist', import.meta.url).href;
const { extractPdfText } = await import(`${ROOT}/modules/import/parsers/pdfText.js`);
const { looksLikeCas, parseCasText } = await import(`${ROOT}/modules/import/parsers/cas.js`);

const redact = (line) =>
  line
    // PAN and email identify the holder and are never needed to debug a parser.
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[PAN]')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[EMAIL]');

const mask = (line) => (full ? redact(line) : redact(line).replace(/\d/g, '9'));

let text;
try {
  ({ text } = await extractPdfText(new Uint8Array(readFileSync(file)), password));
} catch (error) {
  console.error(`Could not read the statement: ${error.message}`);
  process.exit(1);
}

const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
const DATED = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+)$/;

console.log(`file           ${file.split('/').pop()}`);
console.log(`recognised     ${looksLikeCas(text) ? 'yes' : 'NO — this is the first problem'}`);
console.log(`lines of text  ${lines.length}`);
console.log(`masked         ${full ? 'no (--full)' : 'yes — every digit shown as 9'}`);

const parsed = parseCasText(text);
const datedLines = lines.filter((l) => DATED.test(l));

console.log(`\nPARSE RESULT`);
console.log(`  mode            ${parsed.mode}${parsed.mode === 'positions' ? '  (a scheme had an opening balance)' : ''}`);
console.log(`  complete ledger ${parsed.completeHistory}`);
console.log(`  schemes found   ${parsed.schemes}`);
console.log(`  rows produced   ${parsed.rows.length}`);
console.log(`  dated lines     ${datedLines.length}   <-- transaction-shaped lines in the file`);

if (parsed.mode === 'transactions' && parsed.rows.length < datedLines.length) {
  console.log(`\n  ${datedLines.length - parsed.rows.length} dated line(s) did not become transactions.`);
}

// Which dated lines the parser turned into rows, by line number.
const usedLineNumbers = new Set(parsed.rows.map((r) => r.line));
const rawIndexed = text.split('\n').map((l, i) => ({ line: i + 1, text: l.trim() }));
const droppedDated = rawIndexed.filter((e) => DATED.test(e.text) && !usedLineNumbers.has(e.line));

console.log(`\nDATED LINES THE PARSER DID NOT USE  (${droppedDated.length})`);
for (const entry of droppedDated.slice(0, 40)) console.log(`  ${String(entry.line).padStart(5)}  ${mask(entry.text)}`);
if (droppedDated.length > 40) console.log(`  … and ${droppedDated.length - 40} more`);

console.log(`\nSCHEME BLOCKS DETECTED`);
for (const row of parsed.rows) {
  const key = `${row.isin ?? 'no-isin'}  ${row.name}`;
  if (!globalThis.__seen) globalThis.__seen = new Set();
  if (globalThis.__seen.has(key)) continue;
  globalThis.__seen.add(key);
  console.log(`  ${key}`);
}

// The first scheme block, verbatim but masked: this shows the real column layout.
const firstIsin = rawIndexed.findIndex((e) => /\bINF[A-Z0-9]{9}\b/.test(e.text));
if (firstIsin >= 0) {
  console.log(`\nFIRST SCHEME BLOCK AS THE PARSER SEES IT  (lines ${Math.max(1, firstIsin - 3)}–${firstIsin + 22})`);
  for (const entry of rawIndexed.slice(Math.max(0, firstIsin - 4), firstIsin + 22)) {
    console.log(`  ${String(entry.line).padStart(5)}  ${mask(entry.text)}`);
  }
}

console.log(`\nSummary: ${parsed.rows.length} row(s) from ${datedLines.length} dated line(s) across ${parsed.schemes} scheme(s).`);
