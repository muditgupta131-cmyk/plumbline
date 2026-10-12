import { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { ApiError } from '@/services';
import type { CreateTransactionPayload, TransactionType, ValuedHolding } from '@/types';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';

interface TransactionDialogProps {
  open: boolean;
  holdings: ValuedHolding[];
  submitting: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (payload: CreateTransactionPayload) => Promise<void>;
}

const TYPES: Array<{ id: TransactionType; label: string }> = [
  { id: 'BUY', label: 'Buy' },
  { id: 'SELL', label: 'Sell' },
  { id: 'DIVIDEND', label: 'Dividend' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionDialog({ open, holdings, submitting, error, onClose, onSubmit }: TransactionDialogProps) {
  const [type, setType] = useState<TransactionType>('BUY');
  const [holdingId, setHoldingId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fees, setFees] = useState('');
  const [date, setDate] = useState(today());
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setType('BUY');
    setHoldingId(holdings[0]?.id ?? '');
    setQuantity('');
    setPrice('');
    setFees('');
    setDate(today());
  }, [open, holdings]);

  const holding = holdings.find((item) => item.id === holdingId) ?? null;
  const isDividend = type === 'DIVIDEND';
  const isFund = holding?.assetType === 'MUTUAL_FUND';

  const quantityValue = Number(quantity);
  const priceValue = Number(price);
  const validQuantity = isDividend || (Number.isFinite(quantityValue) && quantityValue > 0);
  const validPrice = Number.isFinite(priceValue) && priceValue > 0;
  const canSubmit = Boolean(holding) && validQuantity && validPrice && !submitting;

  const submit = async () => {
    setTouched(true);
    if (!canSubmit || !holding) return;

    await onSubmit({
      assetType: holding.assetType,
      ...(holding.assetType === 'MUTUAL_FUND'
        ? { schemeCode: holding.schemeCode ?? undefined }
        : { symbol: holding.symbol, exchange: holding.exchange ?? undefined }),
      type,
      quantity: isDividend ? 1 : quantityValue,
      price: priceValue,
      fees: Number(fees) || 0,
      date: new Date(date).toISOString(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a transaction"
      description="Recorded buys and sells replace the averaged cost with FIFO lots, realised gains and XIRR."
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-content-subtle">
            {validPrice && (isDividend || validQuantity)
              ? formatCurrency(isDividend ? priceValue : quantityValue * priceValue, holding?.currency ?? 'INR')
              : 'Enter the amounts'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" loading={submitting} disabled={!canSubmit} onClick={submit}>
              Record
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-1 rounded-full border border-hairline p-1">
          {TYPES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={type === option.id}
              onClick={() => setType(option.id)}
              className={cn(
                'flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                type === option.id ? 'bg-content/[0.08] text-content' : 'text-content-muted hover:text-content',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="transaction-holding" className="text-sm font-medium">
            Holding
          </label>
          <select
            id="transaction-holding"
            value={holdingId}
            onChange={(event) => setHoldingId(event.target.value)}
            className="w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            {holdings.map((item) => (
              <option key={item.id} value={item.id}>
                {item.assetType === 'MUTUAL_FUND' ? item.name : `${item.symbol} · ${item.exchange}`}
              </option>
            ))}
          </select>
          <p className="text-xs text-content-subtle">
            Selling more than you hold closes the position and keeps the realised gain.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!isDividend ? (
            <Input
              label={isFund ? 'Units' : 'Quantity'}
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              error={touched && !validQuantity ? 'Enter how many.' : undefined}
            />
          ) : null}

          <Input
            label={isDividend ? 'Amount received' : isFund ? 'NAV' : 'Price per share'}
            type="number"
            min="0"
            step="any"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            error={touched && !validPrice ? 'Enter the amount.' : undefined}
          />

          <Input
            label="Fees and taxes"
            type="number"
            min="0"
            step="any"
            value={fees}
            onChange={(event) => setFees(event.target.value)}
            hint="Brokerage, STT, stamp duty"
          />

          <Input label="Date" type="date" max={today()} value={date} onChange={(event) => setDate(event.target.value)} />
        </div>

        {error ? (
          <p className="rounded-xl border border-bear/30 bg-bear/[0.06] p-3 text-sm text-bear">
            {error instanceof ApiError ? error.message : 'That did not save. Try again.'}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
