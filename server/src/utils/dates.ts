const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * The `DD-Mon-YYYY` form that NSE, AMFI and the CAMS/KFintech registrars all print, read as UTC midnight so
 * a date never shifts by a day with the server's timezone.
 */
export function parseDayMonthYear(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  const month = match ? MONTHS.indexOf(match[2].toLowerCase()) : -1;
  return match && month >= 0 ? new Date(Date.UTC(Number(match[3]), month, Number(match[1]))) : null;
}

export function isoDayMonthYear(value: unknown): string | null {
  return parseDayMonthYear(value)?.toISOString() ?? null;
}

/** The same form in reverse, for AMFI endpoints that take a date in their query string. */
export function formatDayMonthYear(date: Date): string {
  const month = MONTHS[date.getUTCMonth()];
  return `${String(date.getUTCDate()).padStart(2, '0')}-${month[0].toUpperCase()}${month.slice(1)}-${date.getUTCFullYear()}`;
}
