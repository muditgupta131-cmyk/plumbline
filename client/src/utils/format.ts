const COMPACT_TIERS = [
  { limit: 1e12, suffix: 'T' },
  { limit: 1e9, suffix: 'B' },
  { limit: 1e6, suffix: 'M' },
  { limit: 1e3, suffix: 'K' },
] as const;

export function formatCurrency(
  value: number | null | undefined,
  currency = 'USD',
  maximumFractionDigits = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(value);
}

export function formatCompact(value: number | null | undefined, currency?: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const prefix = currency ? `${sign}${currencySymbol(currency)}` : sign;

  for (const tier of COMPACT_TIERS) {
    if (abs >= tier.limit) {
      return `${prefix}${(abs / tier.limit).toFixed(2)}${tier.suffix}`;
    }
  }
  return `${prefix}${abs.toFixed(2)}`;
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
}

export function formatDate(value: string | number | Date, style: 'short' | 'long' = 'short'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
  }).format(date);
}

export function formatRelativeTime(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const formatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return formatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }
  return formatter.format(seconds, 'second');
}

export function currencySymbol(currency: string): string {
  const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value ?? '';
}

export function changeTone(value: number | null | undefined): 'up' | 'down' | 'flat' {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return 'flat';
  return value > 0 ? 'up' : 'down';
}

export function formatMarketCap(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return '—';

  if (currency === 'INR') {
    const crore = Math.abs(value) / 1e7;
    const sign = value < 0 ? '-' : '';
    if (crore >= 1e5) return `${sign}₹${(crore / 1e5).toFixed(2)}L Cr`;
    if (crore >= 1) return `${sign}₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(crore)} Cr`;
    return formatCompact(value, currency);
  }

  return formatCompact(value, currency);
}

export function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return formatCompact(value);
}

export function formatRange(low: number | null | undefined, high: number | null | undefined, currency: string): string {
  if (low === null || low === undefined || high === null || high === undefined) return '—';
  return `${formatCurrency(low, currency)} – ${formatCurrency(high, currency)}`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes < 0) return '—';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = Math.round(minutes % 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function formatRate(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatMultiple(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}×`;
}
