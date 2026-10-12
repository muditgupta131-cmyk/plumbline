import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, FileUp, Link2, Loader2, PiggyBank, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge, Button, Input, Modal } from '@/components/ui';
import { ExchangePill } from '@/components/market';
import { ApiError, portfolioService } from '@/services';
import { useBrokerCatalogue, useBrokerConnections, useBrokerMutations } from '@/hooks/useBrokers';
import type {
  BrokerId,
  FundMatch,
  ImportCommitRow,
  ImportCommitTransaction,
  ImportPreview,
  ImportPreviewRow,
  ImportStrategy,
  SymbolMatch,
} from '@/types';
import { securityKey } from '@/types';
import { formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';

interface ImportDialogProps {
  open: boolean;
  portfolioId: string | null;
  onClose: () => void;
  onImported: () => void;
}

type Tab = 'file' | 'funds' | 'broker';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Says what a row will do to the position it lands on. A statement restates a balance, so the useful
 * question is not "what does this row say" but "what will change if I import it".
 */
function RowEffectNote({ row }: { row: ImportPreviewRow }) {
  if (row.effect === 'ledger') {
    return (
      <p className="mt-0.5 text-xs text-content-subtle">
        Built from its transaction history, which takes precedence — this row will be skipped.
      </p>
    );
  }

  if (row.effect === 'unchanged') {
    return <p className="mt-0.5 text-xs text-content-subtle">Already up to date.</p>;
  }

  if (row.effect === 'update' && row.existing) {
    return (
      <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
        Updates {row.existing.quantity} → {row.quantity ?? '—'} units
      </p>
    );
  }

  return <p className="mt-0.5 text-xs text-bull">New position.</p>;
}

export function ImportDialog({ open, portfolioId, onClose, onImported }: ImportDialogProps) {
  const [tab, setTab] = useState<Tab>('file');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import holdings"
      description="Bring positions in from a broker statement, a mutual fund statement, or a connected broker."
      className="max-w-3xl"
    >
      <div className="mb-5 flex gap-1 rounded-full border border-hairline p-1">
        {[
          { id: 'file' as const, label: 'From a file', icon: FileUp },
          { id: 'funds' as const, label: 'Mutual funds', icon: PiggyBank },
          { id: 'broker' as const, label: 'Connect a broker', icon: Link2 },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              tab === item.id ? 'bg-content/[0.08] text-content' : 'text-content-muted hover:text-content',
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'broker' ? (
        <BrokerConnect portfolioId={portfolioId} onImported={onImported} />
      ) : (
        <FileImport key={tab} variant={tab} portfolioId={portfolioId} onImported={onImported} />
      )}
    </Modal>
  );
}

function FileImport({
  portfolioId,
  onImported,
  variant,
}: {
  portfolioId: string | null;
  onImported: () => void;
  variant: 'file' | 'funds';
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [overrides, setOverrides] = useState<Record<number, SymbolMatch | FundMatch>>({});
  const [result, setResult] = useState<{ added: number; skipped: number; failed: number } | null>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>('add');

  const applyPreview = (data: ImportPreview) => {
    setPreview(data);
    setStrategy(data.suggestedStrategy);
    // Anything the server could not match starts unticked rather than silently importing wrong.
    setSkipped(new Set(data.rows.filter((row) => !row.match && !row.fund).map((row) => row.line)));
    setResult(null);
  };

  const previewMutation = useMutation({
    mutationFn: (text: string) => portfolioService.importPreview(portfolioId!, text),
    onSuccess: applyPreview,
  });

  const commitMutation = useMutation({
    mutationFn: (rows: ImportCommitRow[] | ImportCommitTransaction[]) =>
      preview?.mode === 'transactions'
        ? portfolioService.importCommitTransactions(portfolioId!, rows as ImportCommitTransaction[])
        : portfolioService.importCommit(portfolioId!, rows as ImportCommitRow[], strategy),
    onSuccess: (data) => {
      setResult({ added: data.added, skipped: data.skipped, failed: data.failed.length });
      onImported();
    },
  });

  const matchFor = (row: ImportPreviewRow): SymbolMatch | FundMatch | null =>
    overrides[row.line] ?? row.match ?? row.fund;

  const isFundMatch = (match: SymbolMatch | FundMatch | null): match is FundMatch =>
    Boolean(match && 'schemeCode' in match);

  const isLedger = preview?.mode === 'transactions';

  const selectable = (preview?.rows ?? []).filter(
    (row) =>
      matchFor(row) &&
      row.avgBuyPrice !== null &&
      !skipped.has(row.line) &&
      (isLedger ? Boolean(row.buyDate && row.transactionType) : (row.quantity ?? 0) > 0),
  );

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setContent(text);
      previewMutation.mutate(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      {!preview ? (
        variant === 'funds' ? (
          <FundStatementInput portfolioId={portfolioId} onPreview={applyPreview} />
        ) : (
        <>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (file) readFile(file);
            }}
            className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-hairline p-8 text-center"
          >
            <FileUp className="size-6 text-content-subtle" aria-hidden />
            <div>
              <p className="text-sm font-medium">Drop a holdings export here</p>
              <p className="text-xs text-content-subtle">
                Stocks or mutual funds — Groww, Zerodha, Upstox, Angel One, Dhan or ICICI Direct
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) readFile(file);
              }}
            />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              Choose file
            </Button>
          </div>

          <div className="space-y-2">
            <label htmlFor="paste-holdings" className="text-sm font-medium">
              …or paste the table
            </label>
            <textarea
              id="paste-holdings"
              rows={5}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={'Stock Name,Quantity,Average buy price\nReliance Industries Ltd,40,1180'}
              className="w-full rounded-xl border border-hairline bg-surface p-3 font-data text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
            <Button
              size="sm"
              disabled={content.trim().length < 10}
              loading={previewMutation.isPending}
              onClick={() => previewMutation.mutate(content)}
            >
              Read holdings
            </Button>
          </div>

          {previewMutation.isError ? (
            <p className="rounded-xl border border-bear/30 bg-bear/[0.06] p-3 text-sm text-bear">
              {errorMessage(previewMutation.error, 'That file could not be read.')}
            </p>
          ) : null}
        </>
        )
      ) : (
        <>
          {preview.notice ? (
            <div
              role="status"
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
            >
              {preview.notice}
            </div>
          ) : null}

          {!isLedger ? (
            <fieldset className="rounded-xl border border-hairline p-3">
              <legend className="px-1 text-xs font-medium text-content-muted">
                These rows are balances. What should they do to positions you already hold?
              </legend>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      id: 'replace' as const,
                      title: 'Update to match',
                      hint: 'Set each position to the balance shown. Re-importing a statement stays correct.',
                    },
                    {
                      id: 'add' as const,
                      title: 'Add on top',
                      hint: 'Treat every row as a further purchase and average it in.',
                    },
                  ]
                ).map((option) => (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer gap-2 rounded-lg border p-2.5 text-left transition-colors',
                      strategy === option.id
                        ? 'border-brand-500 bg-brand-500/[0.07]'
                        : 'border-hairline hover:border-content-subtle',
                    )}
                  >
                    <input
                      type="radio"
                      name="import-strategy"
                      className="mt-0.5"
                      checked={strategy === option.id}
                      onChange={() => setStrategy(option.id)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-content">{option.title}</span>
                      <span className="block text-xs text-content-subtle">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="rounded-xl border border-hairline px-3 py-2 text-xs text-content-subtle">
              Transactions already recorded are recognised and skipped, so re-importing an overlapping
              statement only adds what is new.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-content-muted">
              {preview.detectedFormat ? (
                <>
                  Detected <Badge tone="brand">{preview.detectedFormat}</Badge> ·{' '}
                </>
              ) : null}
              {preview.totalRows} rows, {selectable.length} {isLedger ? 'transactions' : 'holdings'} ready
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPreview(null);
                setContent('');
                setResult(null);
              }}
            >
              Use another file
            </Button>
          </div>

          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {preview.rows.map((row) => {
              const match = matchFor(row);
              const isSkipped = skipped.has(row.line);

              return (
                <li
                  key={row.line}
                  className={cn(
                    'rounded-xl border p-3 transition-opacity',
                    isSkipped ? 'border-hairline opacity-50' : match ? 'border-hairline' : 'border-amber-500/40',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.name ?? row.symbol}</p>
                      <p data-numeric className="text-xs text-content-subtle">
                        {isLedger && row.transactionType ? (
                          <span
                            className={cn(
                              'mr-1.5 font-semibold',
                              row.transactionType === 'SELL' ? 'text-bear' : 'text-bull',
                            )}
                          >
                            {row.transactionType}
                          </span>
                        ) : null}
                        {row.quantity ?? '—'} × {row.avgBuyPrice ?? '—'}
                        {isLedger && row.buyDate ? ` · ${row.buyDate.slice(0, 10)}` : ''}
                      </p>
                      {!isLedger && strategy === 'replace' ? <RowEffectNote row={row} /> : null}
                    </div>

                    {match ? (
                      <span className="flex max-w-[55%] items-center gap-2">
                        {isFundMatch(match) ? (
                          <span className="truncate text-sm font-medium">{match.name}</span>
                        ) : (
                          <>
                            <span data-numeric className="text-sm font-semibold">
                              {match.symbol}
                            </span>
                            <ExchangePill exchange={match.exchange} />
                          </>
                        )}
                        {row.confidence === 'name' ? (
                          <Badge tone="accent">name match</Badge>
                        ) : (
                          <CheckCircle2 className="size-4 shrink-0 text-bull" aria-hidden />
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertCircle className="size-3.5" aria-hidden /> no match
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setSkipped((current) => {
                          const next = new Set(current);
                          if (next.has(row.line)) next.delete(row.line);
                          else next.add(row.line);
                          return next;
                        })
                      }
                      className="text-xs text-content-subtle underline-offset-4 hover:text-content hover:underline"
                    >
                      {isSkipped ? 'Include' : 'Skip'}
                    </button>
                  </div>

                  {row.fundSuggestions.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.fundSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.schemeCode}
                          type="button"
                          onClick={() => setOverrides((current) => ({ ...current, [row.line]: suggestion }))}
                          className="max-w-full truncate rounded-full border border-hairline px-2.5 py-1 text-xs transition-colors hover:border-brand-500/50"
                        >
                          {suggestion.name}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {!match && row.suggestions.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.suggestions.map((suggestion) => (
                        <button
                          key={securityKey(suggestion)}
                          type="button"
                          onClick={() => {
                            setOverrides((current) => ({ ...current, [row.line]: suggestion }));
                            setSkipped((current) => {
                              const next = new Set(current);
                              next.delete(row.line);
                              return next;
                            });
                          }}
                          className="rounded-full border border-hairline px-2.5 py-1 text-xs transition-colors hover:border-brand-500/50"
                        >
                          {suggestion.symbol} · {suggestion.exchange}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {result ? (
            <p className="flex items-center gap-2 rounded-xl border border-bull/30 bg-bull/[0.06] p-3 text-sm text-bull">
              <CheckCircle2 className="size-4" aria-hidden />
              {result.added} {isLedger ? 'transaction' : 'holding'}
              {result.added === 1 ? '' : 's'} {strategy === 'replace' && !isLedger ? 'updated' : 'imported'}
              {result.skipped ? `, ${result.skipped} already up to date` : ''}
              {result.failed ? `, ${result.failed} could not be added` : ''}
              {isLedger ? '. Positions were rebuilt from the ledger.' : '.'}
            </p>
          ) : (
            <Button
              fullWidth
              loading={commitMutation.isPending}
              disabled={!selectable.length}
              onClick={() =>
                commitMutation.mutate(
                  selectable.map((row) => {
                    const match = matchFor(row)!;
                    const identity = isFundMatch(match)
                      ? { assetType: 'MUTUAL_FUND' as const, schemeCode: match.schemeCode }
                      : { assetType: 'EQUITY' as const, symbol: match.symbol, exchange: match.exchange };

                    return isLedger
                      ? {
                          ...identity,
                          type: row.transactionType!,
                          quantity: row.quantity ?? 0,
                          price: row.avgBuyPrice!,
                          date: row.buyDate!,
                        }
                      : {
                          ...identity,
                          quantity: row.quantity!,
                          avgBuyPrice: row.avgBuyPrice!,
                        };
                  }) as ImportCommitRow[] | ImportCommitTransaction[],
                )
              }
            >
              Import {selectable.length} {isLedger ? 'transactions' : 'holdings'}
            </Button>
          )}

          {commitMutation.isError ? (
            <p className="rounded-xl border border-bear/30 bg-bear/[0.06] p-3 text-sm text-bear">
              {errorMessage(commitMutation.error, 'The import failed.')}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function BrokerConnect({ portfolioId, onImported }: { portfolioId: string | null; onImported: () => void }) {
  const catalogue = useBrokerCatalogue();
  const connections = useBrokerConnections(catalogue.data?.available ?? false);
  const mutations = useBrokerMutations(portfolioId);

  const [selected, setSelected] = useState<BrokerId | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [syncResult, setSyncResult] = useState<{ headline: string; detail: string[] } | null>(null);

  const broker = catalogue.data?.brokers.find((item) => item.id === selected) ?? null;

  if (catalogue.isPending) {
    return (
      <div className="flex items-center justify-center py-10 text-content-subtle">
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded-xl border border-hairline bg-canvas/50 p-3 text-xs text-content-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
        {catalogue.data?.note} Plumbline never places orders and never moves money — it only reads your holdings.
      </p>

      {connections.data?.connections.length ? (
        <ul className="space-y-2">
          {connections.data.connections.map((connection) => (
            <li key={connection.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{connection.brokerLabel}</p>
                <p data-numeric className="text-xs text-content-subtle">
                  {connection.hint}
                  {connection.lastSyncedAt ? ` · synced ${formatRelativeTime(connection.lastSyncedAt)}` : ' · never synced'}
                </p>
                {connection.lastError ? <p className="text-xs text-bear">{connection.lastError}</p> : null}
              </div>

              <Button
                size="sm"
                loading={mutations.sync.isPending}
                onClick={async () => {
                  const result = await mutations.sync.mutateAsync(connection.id);
                  const detail: string[] = [];

                  if (result.discovered.length) {
                    detail.push(
                      `${result.discovered.join(', ')} ${result.discovered.length === 1 ? 'was' : 'were'} not in the Plumbline universe and ${result.discovered.length === 1 ? 'was' : 'were'} added from your broker.`,
                    );
                  }
                  for (const entry of result.skipped) detail.push(`${entry.symbol}: ${entry.reason}`);

                  setSyncResult({
                    headline:
                      `${connection.brokerLabel} returned ${result.fetched} holding${result.fetched === 1 ? '' : 's'}. ` +
                      `${result.added} added, ${result.updated} updated` +
                      `${result.removed ? `, ${result.removed} removed as no longer held` : ''}.`,
                    detail,
                  });
                  onImported();
                }}
              >
                Sync now
              </Button>

              <button
                type="button"
                aria-label={`Disconnect ${connection.brokerLabel}`}
                onClick={() => mutations.disconnect.mutate(connection.id)}
                className="rounded-full p-2 text-content-subtle transition-colors hover:bg-bear/10 hover:text-bear"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {syncResult ? (
        <div className="space-y-1.5 rounded-xl border border-bull/30 bg-bull/[0.06] p-3 text-sm text-bull">
          <p>{syncResult.headline}</p>
          {syncResult.detail.length ? (
            <ul className="space-y-1 text-xs text-content-muted">
              {syncResult.detail.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {mutations.sync.isError ? (
        <p className="rounded-xl border border-bear/30 bg-bear/[0.06] p-3 text-sm text-bear">
          {errorMessage(mutations.sync.error, 'That sync failed.')}
        </p>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm font-medium">Connect an account</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {catalogue.data?.brokers.map((entry) => (
            <button
              key={entry.id}
              type="button"
              disabled={!catalogue.data.available}
              onClick={() => {
                setSelected(entry.id);
                setCredentials({});
              }}
              className={cn(
                'rounded-xl border p-3 text-left text-sm transition-colors disabled:opacity-50',
                selected === entry.id ? 'border-brand-500 bg-brand-600/[0.06]' : 'border-hairline hover:border-brand-500/40',
              )}
            >
              <span className="font-medium">{entry.label}</span>
              <span className="mt-0.5 block text-xs text-content-subtle">
                {entry.credentialFields.map((field) => field.label).join(' + ')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {broker ? (
        <div className="space-y-3 rounded-xl border border-hairline p-4">
          <ol className="list-decimal space-y-1 pl-4 text-xs text-content-muted">
            {broker.setupSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <a
            href={broker.docsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-block text-xs text-accent-600 hover:underline dark:text-accent-400"
          >
            {broker.label} API documentation
          </a>

          {broker.credentialFields.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              type={field.secret ? 'password' : 'text'}
              autoComplete="off"
              hint={field.help}
              value={credentials[field.key] ?? ''}
              onChange={(event) => setCredentials((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          ))}

          <Button
            fullWidth
            loading={mutations.connect.isPending}
            disabled={broker.credentialFields.some((field) => !credentials[field.key]?.trim())}
            onClick={() => mutations.connect.mutate({ broker: broker.id, credentials })}
          >
            Connect {broker.label}
          </Button>

          {mutations.connect.isError ? (
            <p className="rounded-xl border border-bear/30 bg-bear/[0.06] p-3 text-sm text-bear">
              {errorMessage(mutations.connect.error, 'Could not connect that account.')}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const MAX_STATEMENT_BYTES = 15 * 1024 * 1024;

/**
 * The consolidated account statement (CAS) is the one file that carries every mutual fund a person
 * holds, across all AMCs and whichever app the units were bought through — Groww included.
 */
function FundStatementInput({
  portfolioId,
  onPreview,
}: {
  portfolioId: string | null;
  onPreview: (preview: ImportPreview) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; data: string; size: number } | null>(null);
  const [password, setPassword] = useState('');
  const [readError, setReadError] = useState<string | null>(null);

  const statementMutation = useMutation({
    mutationFn: () => portfolioService.importStatement(portfolioId!, file!.data, password || undefined),
    onSuccess: onPreview,
  });

  const accept = (chosen: File) => {
    setReadError(null);
    statementMutation.reset();

    if (chosen.size > MAX_STATEMENT_BYTES) {
      setReadError('That file is larger than 15 MB. A consolidated statement is normally well under 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setReadError('That file could not be read.');
    reader.onload = () => setFile({ name: chosen.name, data: String(reader.result ?? ''), size: chosen.size });
    // A data URL keeps the bytes intact through JSON; the API strips the prefix.
    reader.readAsDataURL(chosen);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files[0];
          if (dropped) accept(dropped);
        }}
        className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-hairline p-8 text-center"
      >
        <PiggyBank className="size-6 text-content-subtle" aria-hidden />
        <div>
          <p className="text-sm font-medium">
            {file ? file.name : 'Drop your consolidated account statement here'}
          </p>
          <p className="text-xs text-content-subtle">
            {file
              ? `${(file.size / 1024).toFixed(0)} KB · enter the password below if it has one`
              : 'The CAS PDF from CAMS or KFintech — every fund you hold, across every AMC'}
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) accept(chosen);
          }}
        />
        <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
          {file ? 'Choose a different file' : 'Choose PDF'}
        </Button>
      </div>

      <div className="space-y-2">
        <Input
          id="cas-password"
          type="password"
          label="Statement password"
          hint="CAS files are almost always protected. Use the password you set when you asked for the statement."
          autoComplete="off"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Leave blank if the PDF opens without one"
        />
        <Button
          size="sm"
          disabled={!file}
          loading={statementMutation.isPending}
          onClick={() => statementMutation.mutate()}
        >
          Read statement
        </Button>
      </div>

      {readError ? (
        <p className="rounded-xl border border-bear/30 bg-bear/[0.06] p-3 text-sm text-bear">{readError}</p>
      ) : null}

      {statementMutation.isError ? (
        <p className="rounded-xl border border-bear/30 bg-bear/[0.06] p-3 text-sm text-bear">
          {errorMessage(statementMutation.error, 'That statement could not be read.')}
        </p>
      ) : null}

      <div className="space-y-3 rounded-xl border border-hairline bg-surface-muted/40 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-brand-500" aria-hidden />
          Where to get the statement
        </div>
        <ol className="list-decimal space-y-1.5 pl-5 text-xs text-content-muted">
          <li>
            Request a CAS from{' '}
            <a
              className="text-brand-600 underline underline-offset-2 hover:text-brand-500"
              href="https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement"
              target="_blank"
              rel="noreferrer noopener"
            >
              CAMS
            </a>{' '}
            or{' '}
            <a
              className="text-brand-600 underline underline-offset-2 hover:text-brand-500"
              href="https://www.mfcentral.com/"
              target="_blank"
              rel="noreferrer noopener"
            >
              MF Central
            </a>
            . Pick <strong>detailed</strong> and the longest period offered.
          </li>
          <li>Set a password when asked — the statement is emailed to you as a protected PDF.</li>
          <li>Drop that PDF above with its password. Nothing is stored; only the rows you tick are imported.</li>
        </ol>
        <p className="text-xs text-content-subtle">
          A statement that starts from zero units brings full transaction history, so returns are worked out
          properly. A shorter one imports current units and cost instead.
        </p>
        <p className="text-xs text-content-subtle">
          Prefer Groww's own export? Download the mutual fund holdings or transaction report from Groww and
          drop the CSV into <strong>From a file</strong> — both layouts are recognised.
        </p>
      </div>
    </div>
  );
}
