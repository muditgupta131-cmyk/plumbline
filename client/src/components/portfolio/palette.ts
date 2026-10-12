export const ALLOCATION_PALETTE = [
  '#16A34A',
  '#2563EB',
  '#F59E0B',
  '#8B5CF6',
  '#06B6D4',
  '#EC4899',
  '#84CC16',
  '#F97316',
  '#0EA5E9',
  '#A855F7',
] as const;

export function paletteColor(index: number): string {
  return ALLOCATION_PALETTE[index % ALLOCATION_PALETTE.length];
}
