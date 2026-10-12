import { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { ApiError } from '@/services';
import { ALERT_TYPES, type AlertType, type WatchedItem } from '@/types';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';

interface AlertDialogProps {
  open: boolean;
  item: WatchedItem | null;
  submitting: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (values: { type: AlertType; threshold: number; note?: string }) => Promise<void>;
}

const LABELS: Record<AlertType, { label: string; hint: (item: WatchedItem | null) => string }> = {
  PRICE_ABOVE: { label: 'Rises above', hint: () => 'Fires once the price crosses your level.' },
  PRICE_BELOW: { label: 'Falls below', hint: () => 'Fires once the price drops through your level.' },
  PERCENT_MOVE: { label: 'Moves by', hint: () => 'Fires on a daily move of at least this size, up or down.' },
};

export function AlertDialog({ open, item, submitting, error, onClose, onSubmit }: AlertDialogProps) {
  const [type, setType] = useState<AlertType>('PRICE_ABOVE');
  const [threshold, setThreshold] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setTouched(false);
    setType('PRICE_ABOVE');
    setThreshold(item.price ? String(Math.round(item.price * 1.05)) : '');
  }, [open, item]);

  const value = Number(threshold);
  const valid = Number.isFinite(value) && value > 0;
  const isPercent = type === 'PERCENT_MOVE';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Alert on ${item?.symbol ?? ''}`}
      description={
        item?.price
          ? `${item.name} is at ${formatCurrency(item.price, item.currency)} right now.`
          : 'Set a level and Plumbline will check it every few minutes.'
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={submitting}
            disabled={!valid}
            onClick={async () => {
              setTouched(true);
              if (!valid) return;
              await onSubmit({ type, threshold: value });
            }}
          >
            Set alert
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-1 rounded-full border border-hairline p-1">
          {ALERT_TYPES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={type === option}
              onClick={() => setType(option)}
              className={cn(
                'flex-1 rounded-full px-3 py-2 text-xs font-medium transition-colors',
                type === option ? 'bg-content/[0.08] text-content' : 'text-content-muted hover:text-content',
              )}
            >
              {LABELS[option].label}
            </button>
          ))}
        </div>

        <Input
          label={isPercent ? 'Percentage move' : `Price level (${item?.currency ?? 'INR'})`}
          type="number"
          min="0"
          step="any"
          value={threshold}
          onChange={(event) => setThreshold(event.target.value)}
          hint={LABELS[type].hint(item)}
          error={touched && !valid ? 'Enter a value above zero.' : undefined}
        />

        <p className="rounded-xl border border-hairline bg-canvas/50 p-3 text-xs text-content-muted">
          Alerts are checked every five minutes while the server is running, and each one stays quiet for 12 hours
          after it fires so a hovering price cannot spam you.
        </p>

        {error ? (
          <p className="rounded-xl border border-bear/30 bg-bear/[0.06] p-3 text-sm text-bear">
            {error instanceof ApiError ? error.message : 'That did not save. Try again.'}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
