import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Sparkles, Trash2, TriangleAlert, Wallet } from 'lucide-react';
import { Button, Card, Input, Modal } from '@/components/ui';
import { EmptyState, QueryError } from '@/components/feedback';
import { PortfolioReview, PortfolioReviewSkeleton } from '@/components/ai';
import { useAiStatus, usePortfolioAnalysis } from '@/hooks/useAiAnalysis';
import {
  AllocationBars,
  AllocationDonut,
  HoldingDialog,
  HoldingsTable,
  ImportDialog,
  PortfolioPerformanceChart,
  SummaryCards,
  TransactionDialog,
  TransactionsPanel,
} from '@/components/portfolio';
import {
  usePortfolio,
  usePortfolioMutations,
  usePortfolioPerformance,
  usePortfolios,
  useTransactions,
} from '@/hooks/usePortfolio';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAuth } from '@/hooks/useAuth';
import type { HoldingFormValues } from '@/components/portfolio/HoldingDialog';
import {
  CURRENCIES,
  type CandleRange,
  type Currency,
  type PortfolioTransaction,
  type ValuedHolding,
} from '@/types';
import { formatCurrency, formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';

export default function PortfolioPage() {
  useDocumentTitle('Portfolio', 'Track holdings across NSE, BSE and US markets in one base currency.');

  const [storedId, setStoredId] = useLocalStorage<string | null>('plumbline.portfolio', null);
  const [range, setRange] = useState<CandleRange>('1Y');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('My portfolio');
  const { user } = useAuth();
  const [newCurrency, setNewCurrency] = useState<Currency>(user?.preferences.baseCurrency ?? 'INR');
  const [holdingDialog, setHoldingDialog] = useState<{ open: boolean; holding: ValuedHolding | null }>({
    open: false,
    holding: null,
  });
  const [pendingRemoval, setPendingRemoval] = useState<ValuedHolding | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importing, setImporting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [reviewRequested, setReviewRequested] = useState(false);
  const [regeneratingReview, setRegeneratingReview] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<PortfolioTransaction | null>(null);

  const portfolios = usePortfolios();
  const list = useMemo(() => portfolios.data?.portfolios ?? [], [portfolios.data]);

  const activeId = useMemo(() => {
    if (storedId && list.some((item) => item.id === storedId)) return storedId;
    return list[0]?.id ?? null;
  }, [storedId, list]);

  const portfolio = usePortfolio(activeId);
  const performance = usePortfolioPerformance(activeId, range);
  const transactions = useTransactions(activeId);

  const aiStatus = useAiStatus();
  const hasHoldings = (portfolio.data?.holdings.length ?? 0) > 0;
  const autoLoadReview = hasHoldings && (aiStatus.data ? !aiStatus.data.configured : false);
  const review = usePortfolioAnalysis(activeId, hasHoldings && (autoLoadReview || reviewRequested));
  const mutations = usePortfolioMutations(activeId);

  useEffect(() => {
    if (activeId && activeId !== storedId) setStoredId(activeId);
  }, [activeId, storedId, setStoredId]);

  const currency = portfolio.data?.baseCurrency ?? 'INR';
  const busy = mutations.addHolding.isPending || mutations.updateHolding.isPending;

  const submitHolding = async (values: HoldingFormValues) => {
    if (holdingDialog.holding) {
      await mutations.updateHolding.mutateAsync({
        holdingId: holdingDialog.holding.id,
        payload: { quantity: values.quantity, avgBuyPrice: values.avgBuyPrice, buyDate: values.buyDate },
      });
    } else {
      await mutations.addHolding.mutateAsync(values);
    }
    setHoldingDialog({ open: false, holding: null });
  };

  useEffect(() => {
    if (user) setNewCurrency(user.preferences.baseCurrency);
  }, [user]);

  const createPortfolio = async () => {
    const created = await mutations.createPortfolio.mutateAsync({ name: newName.trim(), baseCurrency: newCurrency });
    setStoredId(created.id);
    setCreating(false);
    setNewName('My portfolio');
  };

  if (portfolios.isError) {
    return (
      <div className="container py-16">
        <QueryError error={portfolios.error} onRetry={() => portfolios.refetch()} />
      </div>
    );
  }

  if (!portfolios.isPending && !list.length) {
    return (
      <div className="container py-20">
        <EmptyState
          icon={<Wallet className="size-5" aria-hidden />}
          title="Start your first portfolio"
          description="Add what you own across NSE, BSE and US markets. Plumbline values it in one base currency and tracks profit, allocation and annualised return."
          action={
            <Button onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden />}>
              Create portfolio
            </Button>
          }
        />
        <CreateDialog
          open={creating}
          onClose={() => setCreating(false)}
          name={newName}
          currency={newCurrency}
          onName={setNewName}
          onCurrency={setNewCurrency}
          onSubmit={createPortfolio}
          submitting={mutations.createPortfolio.isPending}
        />
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-8 sm:py-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-eyebrow uppercase text-brand-600 dark:text-brand-400">Portfolio</p>
          <h1 className="text-display-md">{portfolio.data?.name ?? 'Loading…'}</h1>
          <p className="text-sm text-content-subtle">
            Valued in {currency}
            {portfolio.data ? ` · updated ${formatRelativeTime(portfolio.data.asOf)}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {list.length > 1 ? (
            <div className="flex items-center gap-1 rounded-full border border-hairline p-1">
              {list.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === activeId}
                  onClick={() => setStoredId(item.id)}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                    item.id === activeId ? 'bg-brand-600 text-white' : 'text-content-muted hover:text-content',
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : null}

          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            New portfolio
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Delete this portfolio"
            disabled={!activeId}
            onClick={() => setConfirmDelete(true)}
            icon={<Trash2 className="size-4" aria-hidden />}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setImporting(true)}
            icon={<Download className="size-4" aria-hidden />}
          >
            Import
          </Button>
          <Button
            size="sm"
            onClick={() => setHoldingDialog({ open: true, holding: null })}
            icon={<Plus className="size-4" aria-hidden />}
          >
            Add holding
          </Button>
        </div>
      </header>

      {portfolio.isError ? (
        <QueryError error={portfolio.error} onRetry={() => portfolio.refetch()} />
      ) : (
        <>
          <SummaryCards totals={portfolio.data?.totals} currency={currency} loading={portfolio.isPending} />

          {portfolio.data?.unpricedSymbols.length ? (
            <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3 text-sm text-amber-700 dark:text-amber-400">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              No market price for {portfolio.data.unpricedSymbols.join(', ')}, so those positions are held at no
              value in the totals. A share allotted in an IPO has no price until it lists; pricing starts on
              its own once it trades.
            </p>
          ) : null}

          {portfolio.data?.holdings.length ? (
            <>
              <PortfolioPerformanceChart
                points={performance.data?.points}
                currency={currency}
                range={range}
                onRangeChange={setRange}
                loading={performance.isPending}
              />

              <HoldingsTable
                holdings={portfolio.data.holdings}
                currency={currency}
                loading={portfolio.isPending}
                onEdit={(holding) => setHoldingDialog({ open: true, holding })}
                onRemove={setPendingRemoval}
              />

              <div className="grid gap-6 lg:grid-cols-2">
                <AllocationDonut
                  slices={portfolio.data.allocation.byHolding}
                  currency={currency}
                  title="Allocation by holding"
                />
                <AllocationBars
                  slices={portfolio.data.allocation.bySector}
                  currency={currency}
                  title="Sector allocation"
                />
              </div>

              <section aria-label="Portfolio review">
                {review.data ? (
                  <PortfolioReview
                    analysis={review.data}
                    refreshing={regeneratingReview}
                    onRefresh={async () => {
                      setRegeneratingReview(true);
                      try {
                        await review.regenerate();
                      } finally {
                        setRegeneratingReview(false);
                      }
                    }}
                  />
                ) : review.isPending && (autoLoadReview || reviewRequested) ? (
                  <PortfolioReviewSkeleton />
                ) : review.isError ? (
                  <QueryError error={review.error} onRetry={() => review.refetch()} />
                ) : (
                  <Card className="flex flex-col items-center gap-4 p-8 text-center">
                    <span className="flex size-11 items-center justify-center rounded-full bg-brand-600/10 text-brand-600 dark:text-brand-400">
                      <Sparkles className="size-5" aria-hidden />
                    </span>
                    <div className="max-w-lg space-y-1.5">
                      <h3 className="text-lg font-semibold">Review this portfolio</h3>
                      <p className="text-sm text-content-muted">
                        {aiStatus.data?.note ??
                          'A diversification score, concentration and drawdown analysis, and a read on every position.'}
                      </p>
                    </div>
                    <Button onClick={() => setReviewRequested(true)} icon={<Sparkles className="size-4" aria-hidden />}>
                      Run review
                    </Button>
                  </Card>
                )}
              </section>

              <TransactionsPanel
                transactions={transactions.data?.transactions}
                loading={transactions.isPending}
                removing={mutations.removeTransaction.isPending}
                onAdd={() => setRecording(true)}
                onRemove={setPendingTransaction}
              />

              <div className="grid gap-6 lg:grid-cols-2">
                <AllocationBars
                  slices={portfolio.data.allocation.byAssetClass}
                  currency={currency}
                  title="Stocks vs mutual funds"
                />
                <AllocationBars
                  slices={portfolio.data.allocation.byMarket}
                  currency={currency}
                  title="Country allocation"
                />
              </div>
            </>
          ) : portfolio.isPending ? (
            <HoldingsTable holdings={undefined} currency={currency} loading onEdit={() => {}} onRemove={() => {}} />
          ) : (
            <Card className="p-10">
              <EmptyState
                icon={<Plus className="size-5" aria-hidden />}
                title="No holdings yet"
                description="Add the first position and Plumbline will start valuing it live."
                action={
                  <Button size="sm" onClick={() => setHoldingDialog({ open: true, holding: null })}>
                    Add holding
                  </Button>
                }
              />
            </Card>
          )}
        </>
      )}

      <TransactionDialog
        open={recording}
        holdings={portfolio.data?.holdings ?? []}
        submitting={mutations.addTransaction.isPending}
        error={mutations.addTransaction.error}
        onClose={() => setRecording(false)}
        onSubmit={async (payload) => {
          await mutations.addTransaction.mutateAsync(payload);
          setRecording(false);
        }}
      />

      <Modal
        open={Boolean(pendingTransaction)}
        onClose={() => setPendingTransaction(null)}
        title="Delete this transaction?"
        description="The position, realised gains and XIRR are recalculated from the remaining transactions."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingTransaction(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={mutations.removeTransaction.isPending}
              onClick={async () => {
                if (!pendingTransaction) return;
                await mutations.removeTransaction.mutateAsync(pendingTransaction.id);
                setPendingTransaction(null);
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-content-muted">
          {pendingTransaction?.type} · {pendingTransaction?.symbol}
        </p>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${portfolio.data?.name ?? 'this portfolio'}?`}
        description="This removes the portfolio, its holdings and its whole transaction ledger. It cannot be undone."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={mutations.deletePortfolio.isPending}
              onClick={async () => {
                if (!activeId) return;
                await mutations.deletePortfolio.mutateAsync(activeId);
                setStoredId(null);
                setConfirmDelete(false);
              }}
            >
              Delete portfolio
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-sm text-content-muted">
          <p>
            {portfolio.data?.totals.holdings ?? 0} holding
            {(portfolio.data?.totals.holdings ?? 0) === 1 ? '' : 's'} worth{' '}
            {formatCurrency(portfolio.data?.totals.value, currency, 0)} will be removed.
          </p>
          {transactions.data?.transactions.length ? (
            <p>
              {transactions.data.transactions.length} recorded transaction
              {transactions.data.transactions.length === 1 ? '' : 's'} will be deleted with it, so realised gains and
              XIRR for these positions are lost.
            </p>
          ) : null}
        </div>
      </Modal>

      <ImportDialog
        open={importing}
        portfolioId={activeId}
        onClose={() => setImporting(false)}
        onImported={() => {
          void portfolio.refetch();
          void portfolios.refetch();
        }}
      />

      <HoldingDialog
        open={holdingDialog.open}
        holding={holdingDialog.holding}
        submitting={busy}
        error={mutations.addHolding.error ?? mutations.updateHolding.error}
        onClose={() => setHoldingDialog({ open: false, holding: null })}
        onSubmit={submitHolding}
      />

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        name={newName}
        currency={newCurrency}
        onName={setNewName}
        onCurrency={setNewCurrency}
        onSubmit={createPortfolio}
        submitting={mutations.createPortfolio.isPending}
      />

      <Modal
        open={Boolean(pendingRemoval)}
        onClose={() => setPendingRemoval(null)}
        title={`Remove ${pendingRemoval?.symbol ?? ''}?`}
        description="This deletes the position from this portfolio. It cannot be undone."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingRemoval(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={mutations.removeHolding.isPending}
              onClick={async () => {
                if (!pendingRemoval) return;
                await mutations.removeHolding.mutateAsync(pendingRemoval.id);
                setPendingRemoval(null);
              }}
            >
              Remove holding
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-sm text-content-muted">
          <p>
            {pendingRemoval?.name} · {pendingRemoval?.quantity}{' '}
            {pendingRemoval?.assetType === 'MUTUAL_FUND' ? 'units' : 'shares'}
          </p>
          {pendingRemoval?.transactionCount ? (
            <p>
              Its {pendingRemoval.transactionCount} recorded transaction
              {pendingRemoval.transactionCount === 1 ? '' : 's'} will be deleted too, so its realised gains and XIRR
              go with it.
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  currency: Currency;
  onName: (value: string) => void;
  onCurrency: (value: Currency) => void;
  onSubmit: () => Promise<void>;
  submitting: boolean;
}

function CreateDialog({ open, onClose, name, currency, onName, onCurrency, onSubmit, submitting }: CreateDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New portfolio"
      description="Every holding is converted into the base currency you pick here."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={submitting} disabled={!name.trim()} onClick={onSubmit}>
            Create
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Name" value={name} onChange={(event) => onName(event.target.value)} maxLength={60} />

        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Base currency</span>
          <div className="flex gap-2">
            {CURRENCIES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={currency === option}
                onClick={() => onCurrency(option)}
                className={cn(
                  'flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
                  currency === option
                    ? 'border-brand-500 bg-brand-600/10 text-brand-700 dark:text-brand-400'
                    : 'border-hairline text-content-muted hover:text-content',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
