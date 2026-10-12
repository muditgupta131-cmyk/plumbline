import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ApiError } from '../../../utils/ApiError.js';

// pdf.js ships an ESM build that works headless in Node once the worker is disabled. It is loaded
// lazily so the API boots (and the market tests run) without paying the parse cost of a 2 MB bundle.
type TextItem = { str: string; transform: number[] };

let loader: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;

async function pdfjs() {
  // pdf.js falls back to an in-process "fake worker" in Node on its own; blanking workerSrc breaks it.
  if (!loader) loader = import('pdfjs-dist/legacy/build/pdf.mjs');
  return loader;
}

// Statements embed only the 14 standard fonts, which pdf.js reads from disk rather than the network.
// Resolved through the package itself so it survives whether npm hoists pdfjs-dist or not.
const STANDARD_FONTS = new URL(
  './standard_fonts/',
  pathToFileURL(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')),
).href;

/**
 * pdf.js hands back positioned glyph runs, not lines. Statements are column layouts, so we rebuild
 * rows by rounding the baseline and then reading each row left to right.
 */
// Cells of one printed row rarely share an exact baseline — superscripts, differing font sizes and
// the renderer's own rounding move them by a fraction of a point. Rounding to whole points therefore
// splits a single statement row in two, which detaches the units and NAV from the date beside them.
// Statement rows sit ~10pt apart, so grouping within this tolerance is safe.
const BASELINE_TOLERANCE_PT = 3;

function itemsToLines(items: TextItem[]): string[] {
  const glyphs = items
    .filter((item) => item.str)
    .map((item) => ({ x: item.transform[4] ?? 0, y: item.transform[5] ?? 0, str: item.str }))
    .sort((a, b) => b.y - a.y);

  const rows: Array<{ y: number; glyphs: typeof glyphs }> = [];

  for (const glyph of glyphs) {
    const current = rows[rows.length - 1];
    if (current && Math.abs(current.y - glyph.y) <= BASELINE_TOLERANCE_PT) current.glyphs.push(glyph);
    else rows.push({ y: glyph.y, glyphs: [glyph] });
  }

  return rows
    .map((row) =>
      row.glyphs
        .sort((a, b) => a.x - b.x)
        .map((glyph) => glyph.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

export interface PdfTextResult {
  text: string;
  pages: number;
}

export async function extractPdfText(data: Uint8Array, password?: string): Promise<PdfTextResult> {
  const { getDocument } = await pdfjs();

  let document;
  try {
    document = await getDocument({
      data,
      password,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      standardFontDataUrl: STANDARD_FONTS,
      // Text extraction never rasterises glyphs, so pdf.js font chatter is noise in the API log.
      verbosity: 0,
    }).promise;
  } catch (error) {
    const name = (error as { name?: string }).name;
    const code = (error as { code?: number }).code;

    if (name === 'PasswordException') {
      throw ApiError.badRequest(
        code === 1
          ? 'That statement is password protected. Enter the password and try again.'
          : 'That password did not open the statement. CAS passwords are usually the one you set when requesting it.',
      );
    }
    if (name === 'InvalidPDFException') throw ApiError.badRequest('That file is not a readable PDF.');
    throw ApiError.badRequest('Could not read that PDF.');
  }

  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    lines.push(...itemsToLines(content.items as TextItem[]));
    page.cleanup();
  }

  const pages = document.numPages;
  await document.destroy();

  return { text: lines.join('\n'), pages };
}
