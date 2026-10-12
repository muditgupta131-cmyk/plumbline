import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Delta, Input, Modal, Skeleton } from '@/components/ui';
import { EmptyState, QueryError } from '@/components/feedback';
import { ExchangePill, SymbolLogo } from '@/components/market';
import { AlertDialog } from '@/components/watchlist';
import { useAlerts, useWatchlist, useWatchlistMutations } from '@/hooks/useWatchlist';
import { useSymbolSearch } from '@/hooks/useMarketData';
import { useFundSearch } from '@/hooks/useFunds';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { securityKey, type PriceAlert, type WatchedItem } from '@/types';
import { formatCurrency, formatDate, formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';

const ALERT_LABEL: Record<PriceAlert['type'], string> = {
  PRICE_ABOVE: 'above',
  PRICE_BELOW: 'below',
  PERCENT_MOVE: 'moves',
};

export default function WatchlistPage() {
  useDocumentTitle('Watchlist', 'Follow stocks and funds, and get alerted when they hit your levels.');

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [alertFor, setAlertFor] = useState<WatchedItem | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<WatchedItem | null>(null);

  const watchlist = useWatchlist();
  const alerts = useAlerts();
  const mutations = useWatchlistMutations();

  const stockSearch = useSymbolSearch(query, 5);
  const fundSearch = useFundSearch(query, 4);

  const items = watchlist.data?.items ?? [];
  const alertsByKey = useMemo(() => {
    const map = new Map<string, PriceAlert[]>();
    for (const alert of alerts.data?.alerts ?? []) {
      const key = alert.schemeCode ? `MF:${alert.schemeCode}` : `${alert.exchange}:${alert.symbol}`;
      map.set(key, [...(map.get(key) ?? []), alert]);
    }
    return map;
  }, [alerts.data]);

  const keyFor = (item: WatchedItem) =>
    item.schemeCode ? `MF:${item.schemeCode}` : `${item.exchange}:${item.symbol}`;

  return (
    <div className="container space-y-6 py-8 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-eyebrow uppercase text-brand-600 dark:text-brand-400">Watchlist</p>
          <h1 className="text-display-md">Things you are following</h1>
          <p className="text-sm text-content-subtle">
            Stocks and funds you have not bought, with alerts checked every few minutes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={mutations.evaluate.isPending}
            onClick={() => mutations.evaluate.mutate()}
          >
            Check alerts now
          </Button>
          <Button size="sm" onClick={() => setAdding(true)} icon={<Plus className="size-4" aria-hidden />}>
            Add
          </Button>
        </div>
      </header>

      {mutations.evaluate.data ? (
        <p className="rounded-xl border border-hairline bg-canvas/50 p-3 text-sm text-content-muted">
          Checked {mutations.evaluate.data.checked} alert{mutations.evaluate.data.checked === 1 ? '' : 's'},{' '}
          {mutations.evaluate.data.triggered} fired
          {mutations.evaluate.data.skippedInCooldown
            ? `, ${mutations.evaluate.data.skippedInCooldown} still cooling down`
            : ''}
          .
        </p>
      ) : null}

      {watchlist.isError ? (
        <QueryError error={watchlist.error} onRetry={() => watchlist.refetch()} />
      ) : watchlist.isPending ? (
        <Card className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </Card>
      ) : items.length ? (
        <ul className="space-y-3">
          {items.map((item) => {
            const itemAlerts = alertsByKey.get(keyFor(item)) ?? [];

            return (
              <li key={item.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <SymbolLogo symbol={item.symbol} name={item.name} size="md" />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.assetType === 'MUTUAL_FUND' ? (
                          <span className="truncate font-medium">{item.name}</span>
                        ) : (
                          <Link
                            to={`/stocks/${item.exchange}/${encodeURIComponent(item.symbol)}`}
                            className="flex items-center gap-2 hover:text-brand-600 dark:hover:text-brand-400"
                          >
                            <span data-numeric className="font-semibold">
                              {item.symbol}
                            </span>
                            {item.exchange ? <ExchangePill exchange={item.exchange} /> : null}
                          </Link>
                        )}
                        {item.assetType === 'MUTUAL_FUND' ? <Badge tone="accent">Fund</Badge> : null}
                      </div>
                      <p className="truncate text-xs text-content-subtle">
                        {item.assetType === 'MUTUAL_FUND' ? (item.sector ?? 'Mutual fund') : item.name}
                        {item.navDate ? ` · NAV ${formatDate(item.navDate)}` : ''}
                      </p>
                    </div>

                    <div className="text-right">
                      {item.priced ? (
                        <>
                          <p data-numeric className="text-sm font-semibold">
                            {formatCurrency(item.price, item.currency)}
                          </p>
                          {item.changePercent !== null ? (
                            <Delta value={item.changePercent} className="text-xs" />
                          ) : null}
                        </>
                      ) : (
                        <span className="text-xs text-content-subtle">No price</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAlertFor(item)}
                        aria-label={`Add an alert on ${item.symbol}`}
                        className="rounded-full p-2 text-content-subtle transition-colors hover:bg-content/5 hover:text-content"
                      >
                        <Bell className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingRemoval(item)}
                        aria-label={`Remove ${item.symbol} from the watchlist`}
                        className="rounded-full p-2 text-content-subtle transition-colors hover:bg-bear/10 hover:text-bear"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>

                  {itemAlerts.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3">
                      {itemAlerts.map((alert) => (
                        <li
                          key={alert.id}
                          className={cn(
                            'flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
                            alert.active ? 'border-hairline' : 'border-hairline opacity-50',
                          )}
                        >
                          <span data-numeric>
                            {ALERT_LABEL[alert.type]}{' '}
                            {alert.type === 'PERCENT_MOVE'
                              ? `${alert.threshold}%`
                              : formatCurrency(alert.threshold, item.currency)}
                          </span>
                          {alert.lastTriggeredAt ? (
                            <span className="text-content-subtle">
                              fired {formatRelativeTime(alert.lastTriggeredAt)}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => mutations.toggleAlert.mutate({ id: alert.id, active: !alert.active })}
                            aria-label={alert.active ? 'Pause this alert' : 'Resume this alert'}
                            className="text-content-subtle transition-colors hover:text-content"
                          >
                            {alert.active ? <Bell className="size-3" aria-hidden /> : <BellOff className="size-3" aria-hidden />}
                          </button>
                          <button
                            type="button"
                            onClick={() => mutations.removeAlert.mutate(alert.id)}
                            aria-label="Delete this alert"
                            className="text-content-subtle transition-colors hover:text-bear"
                          >
                            <Trash2 className="size-3" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card className="p-10">
          <EmptyState
            icon={<Eye className="size-5" aria-hidden />}
            title="Nothing on the watchlist yet"
            description="Follow a stock or a fund you are thinking about, and set a level you want to be told about."
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                Add the first one
              </Button>
            }
          />
        </Card>
      )}

      <Modal
        open={adding}
        onClose={() => {
          setAdding(false);
          setQuery('');
        }}
        title="Follow a stock or fund"
        description="Search anything listed on NSE, BSE or the US markets, or any AMFI scheme."
      >
        <div className="space-y-3">
          <Input
            placeholder="RELIANCE, Infosys, AAPL, Parag Parikh…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            leading={<Search className="size-4" aria-hidden />}
            autoFocus
          />

          {query.trim().length > 1 ? (
            <ul className="max-h-72 divide-y divide-hairline overflow-y-auto rounded-xl border border-hairline">
              {stockSearch.results.map((match) => (
                <li key={securityKey(match)}>
                  <button
                    type="button"
                    disabled={mutations.add.isPending}
                    onClick={async () => {
                      await mutations.add.mutateAsync({ symbol: match.symbol, exchange: match.exchange });
                      setAdding(false);
                      setQuery('');
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-content/[0.04] disabled:opacity-50"
                  >
                    <SymbolLogo symbol={match.symbol} name={match.name} size="sm" />
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

              {fundSearch.results.map((fund) => (
                <li key={fund.schemeCode}>
                  <button
                    type="button"
                    disabled={mutations.add.isPending}
                    onClick={async () => {
                      await mutations.add.mutateAsync({ assetType: 'MUTUAL_FUND', schemeCode: fund.schemeCode });
                      setAdding(false);
                      setQuery('');
                    }}
                    className="w-full px-3 py-2.5 text-left transition-colors hover:bg-content/[0.04] disabled:opacity-50"
                  >
                    <span className="block truncate text-sm font-medium">{fund.name}</span>
                    <span className="block truncate text-xs text-content-subtle">
                      {fund.category} · NAV {fund.nav}
                    </span>
                  </button>
                </li>
              ))}

              {!stockSearch.results.length && !fundSearch.results.length ? (
                <li className="px-3 py-6 text-center text-sm text-content-subtle">No match yet.</li>
              ) : null}
            </ul>
          ) : null}

          {mutations.add.isError ? (
            <p className="rounded-xl border border-bear/30 bg-bear/[0.06] p-3 text-sm text-bear">
              {(mutations.add.error as Error).message}
            </p>
          ) : null}
        </div>
      </Modal>

      <AlertDialog
        open={Boolean(alertFor)}
        item={alertFor}
        submitting={mutations.createAlert.isPending}
        error={mutations.createAlert.error}
        onClose={() => setAlertFor(null)}
        onSubmit={async (values) => {
          if (!alertFor) return;
          await mutations.createAlert.mutateAsync({ itemId: alertFor.id, ...values });
          setAlertFor(null);
        }}
      />

      <Modal
        open={Boolean(pendingRemoval)}
        onClose={() => setPendingRemoval(null)}
        title={`Stop following ${pendingRemoval?.symbol ?? ''}?`}
        description="Any alerts on it are deleted too."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingRemoval(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={mutations.remove.isPending}
              onClick={async () => {
                if (!pendingRemoval) return;
                await mutations.remove.mutateAsync(pendingRemoval.id);
                setPendingRemoval(null);
              }}
            >
              Remove
            </Button>
          </div>
        }
      >
        <p className="text-sm text-content-muted">{pendingRemoval?.name}</p>
      </Modal>
    </div>
  );
}
