import { EXCHANGES, EXCHANGE_MARKET, type Exchange, type Market } from '../../types/market.js';

export type SessionStatus = 'pre-open' | 'open' | 'closed';

interface ExchangeHours {
  timezone: string;
  label: string;
  preOpen: number;
  open: number;
  close: number;
}

const MINUTES_IN_DAY = 1440;
const MINUTES_IN_WEEK = MINUTES_IN_DAY * 7;

const HOURS: Record<Exchange, ExchangeHours> = {
  NSE: { timezone: 'Asia/Kolkata', label: 'IST', preOpen: 9 * 60, open: 9 * 60 + 15, close: 15 * 60 + 30 },
  BSE: { timezone: 'Asia/Kolkata', label: 'IST', preOpen: 9 * 60, open: 9 * 60 + 15, close: 15 * 60 + 30 },
  NASDAQ: { timezone: 'America/New_York', label: 'ET', preOpen: 4 * 60, open: 9 * 60 + 30, close: 16 * 60 },
  NYSE: { timezone: 'America/New_York', label: 'ET', preOpen: 4 * 60, open: 9 * 60 + 30, close: 16 * 60 },
  AMEX: { timezone: 'America/New_York', label: 'ET', preOpen: 4 * 60, open: 9 * 60 + 30, close: 16 * 60 },
};

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ExchangeSession {
  exchange: Exchange;
  market: Market;
  status: SessionStatus;
  timezone: string;
  localTime: string;
  opensInMinutes: number | null;
  closesInMinutes: number | null;
}

function localPosition(timezone: string, at: Date): { weekday: number; minutes: number; clock: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const lookup = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(lookup('hour')) % 24;
  const minute = Number(lookup('minute'));

  return {
    weekday: WEEKDAY_INDEX[lookup('weekday')] ?? 0,
    minutes: hour * 60 + minute,
    clock: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

function minutesUntilNextOpen(weekday: number, minutes: number, hours: ExchangeHours): number {
  const now = weekday * MINUTES_IN_DAY + minutes;

  for (let offset = 0; offset <= 7; offset += 1) {
    const day = (weekday + offset) % 7;
    if (day === 0 || day === 6) continue;

    const openAt = (weekday + offset) * MINUTES_IN_DAY + hours.open;
    if (openAt > now) return openAt - now;
  }

  return MINUTES_IN_WEEK;
}

export function exchangeSession(exchange: Exchange, at = new Date()): ExchangeSession {
  const hours = HOURS[exchange];
  const { weekday, minutes, clock } = localPosition(hours.timezone, at);
  const isWeekday = weekday >= 1 && weekday <= 5;

  let status: SessionStatus = 'closed';
  if (isWeekday && minutes >= hours.open && minutes < hours.close) status = 'open';
  else if (isWeekday && minutes >= hours.preOpen && minutes < hours.open) status = 'pre-open';

  return {
    exchange,
    market: EXCHANGE_MARKET[exchange],
    status,
    timezone: hours.label,
    localTime: clock,
    opensInMinutes: status === 'open' ? null : minutesUntilNextOpen(weekday, minutes, hours),
    closesInMinutes: status === 'open' ? hours.close - minutes : null,
  };
}

export function marketSessions(market?: Market): ExchangeSession[] {
  const exchanges = market ? EXCHANGES.filter((exchange) => EXCHANGE_MARKET[exchange] === market) : EXCHANGES;
  return exchanges.map((exchange) => exchangeSession(exchange));
}

export function primaryExchange(market: Market): Exchange {
  return market === 'IN' ? 'NSE' : 'NASDAQ';
}
