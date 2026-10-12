export function parseDelimited(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const delimiter = pickDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((value) => value !== '')) rows.push(row);

  return rows;
}

function pickDelimiter(text: string): string {
  const sample = text.split('\n').slice(0, 12).join('\n');
  const counts: Array<[string, number]> = [
    [',', (sample.match(/,/g) ?? []).length],
    ['\t', (sample.match(/\t/g) ?? []).length],
    [';', (sample.match(/;/g) ?? []).length],
    ['|', (sample.match(/\|/g) ?? []).length],
  ];

  return counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts.sort((a, b) => b[1] - a[1])[0][0] : ',';
}

export function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[₹$,\s]/g, '').replace(/[()]/g, '-');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
