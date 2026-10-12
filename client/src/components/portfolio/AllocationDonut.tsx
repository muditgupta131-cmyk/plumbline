import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipProps } from 'recharts';
import { Card, Skeleton } from '@/components/ui';
import type { AllocationSlice } from '@/types';
import { formatCurrency } from '@/utils/format';
import { paletteColor } from './palette';

interface AllocationDonutProps {
  slices: AllocationSlice[] | undefined;
  currency: string;
  title: string;
  loading?: boolean;
}

function DonutTooltip({ active, payload, currency }: TooltipProps<number, string> & { currency: string }) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload as AllocationSlice;

  return (
    <div className="glass rounded-xl px-3 py-2 shadow-card">
      <p className="text-sm font-medium">{slice.label}</p>
      <p data-numeric className="text-xs text-content-muted">
        {formatCurrency(slice.value, currency, 0)} · {slice.weight.toFixed(1)}%
      </p>
    </div>
  );
}

export function AllocationDonut({ slices, currency, title, loading }: AllocationDonutProps) {
  const data = (slices ?? []).filter((slice) => slice.value > 0);

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="mb-4 text-base font-semibold">{title}</h3>

      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : data.length ? (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-52 w-full sm:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="58%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {data.map((slice, index) => (
                    <Cell key={slice.key} fill={paletteColor(index)} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip currency={currency} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="w-full space-y-2 sm:w-1/2">
            {data.slice(0, 7).map((slice, index) => (
              <li key={slice.key} className="flex items-center gap-2.5 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: paletteColor(index) }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                <span data-numeric className="shrink-0 text-content-muted">
                  {slice.weight.toFixed(1)}%
                </span>
              </li>
            ))}
            {data.length > 7 ? (
              <li className="pl-5 text-xs text-content-subtle">+{data.length - 7} more</li>
            ) : null}
          </ul>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-content-subtle">Add a holding to see the allocation.</p>
      )}
    </Card>
  );
}
