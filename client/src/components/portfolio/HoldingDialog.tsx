import { useEffect, useState } from 'react';
import { Landmark, LineChart, Search } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { ExchangePill, SymbolLogo } from '@/components/market';
import { useSymbolSearch } from '@/hooks/useMarketData';
import { useFundSearch } from '@/hooks/useFunds';
import { currencyForExchange, securityKey, type AssetType, type FundMatch, type SymbolMatch, type ValuedHolding } from '@/types';
import { ApiError } from '@/services';
import { formatCurrency, formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

export interface HoldingFormValues {
  assetType: AssetType;
  symbol?: string;
  exchange?: SymbolMatch['exchange'];
  schemeCode?: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate: string;
}

interface HoldingDialogProps {
  open: boolean;
  onClose: () => void;
  holding?: ValuedHolding | null;
  submitting: boolean;
  error: unknown;
  onSubmit: (values: HoldingFormValues) => Promise<void>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HoldingDialog({ open, onClose, holding, submitting, error, onSubmit }: HoldingDialogProps) {
  const isEdit = Boolean(holding);

  const [assetType, setAssetType] = useState<AssetType>('EQUITY');
  const [query, setQuery] = useState('');
  const [stock, setStock] = useState<SymbolMatch | null>(null);
  const [fund, setFund] = useState<FundMatch | null>(null);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [buyDate, setBuyDate] = useState(today());
  const [touched, setTouched] = useState(false);

  const isFund = assetType === 'MUTUAL_FUND';
  const stockSearch = useSymbolSearch(isFund ? '' : query, 6);
  const fundSearch = useFundSearch(isFund ? query : '', 6);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setQuery('');
    setAssetType(holding?.assetType ?? 'EQUITY');
    setStock(
      holding && holding.assetType === 'EQUITY' && holding.exchange
        ? {
            symbol: holding.symbol,
            exchange: holding.exchange,
            name: holding.name,
            market: holding.market,
            currency: holding.currency,
            sector: holding.sector,
          }
        : null,
    );
    setFund(null);
    setQuantity(holding ? String(holding.quantity) : '');
    setPrice(holding ? String(holding.avgBuyPrice) : '');
    setBuyDate(holding ? holding.buyDate.slice(0, 10) : today());
  }, [open, holding]);

  const quantityValue = Number(quantity);
  const priceValue = Number(price);
  const validQuantity = Number.isFinite(quantityValue) && quantityValue > 0;
  const validPrice = Number.isFinite(priceValue) && priceValue >= 0;
  const selected = isFund ? fund : stock;
  const canSubmit = (isEdit || Boolean(selected)) && validQuantity && validPrice && !submitting;

  const currency = isFund ? 'INR' : stock ? currencyForExchange(stock.exchange) : 'INR';
  const total = validQuantity && validPrice ? quantityValue * priceValue : null;

  const submit = async () => {
    setTouched(true);
    if (!canSubmit) return;

    await onSubmit({
      assetType,
      ...(isFund
        ? { schemeCode: fund?.schemeCode ?? holding?.schemeCode ?? undefined }
        : { symbol: stock?.symbol, exchange: stock?.exchange }),
      quantity: quantityValue,
      avgBuyPrice: priceValue,
      buyDate: new Date(buyDate).toISOString(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${holding?.symbol}` : 'Add a holding'}
      description={
        isEdit
          ? 'Update the quantity, average cost or purchase date.'
          : 'Search a listed company or an AMFI mutual fund scheme, then enter what you own.'
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-content-subtle">
            {total !== null ? `Invested ${formatCurrency(total, currency)}` : 'Enter quantity and cost'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" loading={submitting} onClick={submit} disabled={!canSubmit}>
              {isEdit ? 'Save changes' : 'Add holding'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {!isEdit ? (
          <>
            <div className="flex gap-1 rounded-full border border-hairline p-1">
              {[
                { id: 'EQUITY' as const, label: 'Stock', icon: LineChart },
                { id: 'MUTUAL_FUND' as const, label: 'Mutual fund', icon: Landmark },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={assetType === option.id}
                  onClick={() => {
                    setAssetType(option.id);
                    setQuery('');
                    setStock(null);
                    setFund(null);
                  }}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    assetType === option.id ? 'bg-content/[0.08] text-content' : 'text-content-muted hover:text-content',
                  )}
                >
                  <option.icon className="size-4" aria-hidden />
                  {option.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Input
                label={isFund ? 'Scheme' : 'Company'}
                placeholder={isFund ? 'Parag Parikh Flexi Cap Direct Growth…' : 'RELIANCE, Infosys, AAPL…'}
                value={selected ? (isFund ? fund!.name : `${stock!.symbol} · ${stock!.name}`) : query}
                onChange={(event) => {
                  setStock(null);
                  setFund(null);
                  setQuery(event.target.value);
                }}
                leading={<Search className="size-4" aria-hidden />}
                hint={isFund ? 'Searches all 14,000 AMFI schemes by name, plan and option.' : undefined}
                error={touched && !selected ? `Pick a ${isFund ? 'scheme' : 'company'} from the list.` : undefined}
              />

              {!selected && query.trim().length > 0 ? (
                <ul className="max-h-56 overflow-y-auto rounded-xl border border-hairline">
                  {isFund
                    ? fundSearch.results.map((match) => (
                        <li key={match.schemeCode}>
                          <button
                            type="button"
                            onClick={() => {
                              setFund(match);
                              setPrice((current) => current || String(match.nav));
                              setQuery('');
                            }}
                            className="w-full px-3 py-2.5 text-left transition-colors hover:bg-content/[0.04]"
                          >
                            <span className="block truncate text-sm font-medium">{match.name}</span>
                            <span className="block truncate text-xs text-content-subtle">
                              {match.category} · NAV {match.nav} on {formatDate(match.navDate)}
                            </span>
                          </button>
                        </li>
                      ))
                    : stockSearch.results.map((match) => (
                        <li key={securityKey(match)}>
                          <button
                            type="button"
                            onClick={() => {
                              setStock(match);
                              setQuery('');
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-content/[0.04]"
                          >
                            <SymbolLogo symbol={match.symbol} name={match.name} logoUrl={match.logoUrl} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span data-numeric className="text-sm font-semibold">
                                  {match.symbol}
                                </span>
                                <ExchangePill exchange={match.exchange} />
                              </span>
                              <span className="block truncate text-xs text-content-muted">{match.name}</span>
                            </span>
                          </button>
                        </li>
                      ))}

                  {(isFund ? fundSearch : stockSearch).isFetching ? (
                    <li className="px-3 py-4 text-center text-xs text-content-subtle">Searching…</li>
                  ) : (isFund ? fundSearch.results : stockSearch.results).length === 0 ? (
                    <li className="px-3 py-6 text-center text-sm text-content-subtle">No match yet.</li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={isFund ? 'Units' : 'Quantity'}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            error={touched && !validQuantity ? `Enter the ${isFund ? 'units' : 'quantity'} you hold.` : undefined}
          />
          <Input
            label={isFund ? 'Average NAV (INR)' : `Average cost (${currency})`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            error={touched && !validPrice ? 'Enter the price you paid.' : undefined}
          />
        </div>

        <Input
          label="Purchase date"
          type="date"
          max={today()}
          value={buyDate}
          onChange={(event) => setBuyDate(event.target.value)}
          hint="Used for the annualised return."
        />

        {error ? (
          <p className="rounded-xl border border-bear/30 bg-bear/[0.06] p-3 text-sm text-bear">
            {error instanceof ApiError ? error.message : 'That did not save. Try again.'}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
