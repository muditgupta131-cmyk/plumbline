const UNITS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDuration(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Unsupported duration "${value}". Use formats like 15m, 12h or 30d.`);
  }
  const amount = Number(match[1]);
  const unit = UNITS[match[2] as string];
  if (!unit) {
    throw new Error(`Unsupported duration unit in "${value}".`);
  }
  return amount * unit;
}
