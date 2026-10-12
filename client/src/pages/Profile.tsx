import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  Check,
  Database,
  KeyRound,
  Landmark,
  Radio,
  ShieldCheck,
  User as UserIcon, Sparkles } from 'lucide-react';
import { Badge, Button, Card, Input, Section, Skeleton } from '@/components/ui';
import { PasswordField } from '@/components/auth';
import { DataSourceBadge } from '@/components/market';
import { useAuth } from '@/hooks/useAuth';
import { useProfileMutations } from '@/hooks/useProfile';
import { useAiStatus } from '@/hooks/useAiAnalysis';
import { useMarketStatus } from '@/hooks/useMarketData';
import { useFundUniverse } from '@/hooks/useFunds';
import { useTheme } from '@/hooks/useTheme';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/services';
import { CURRENCIES, MARKETS, type Currency, type Market } from '@/types';
import { formatDate, formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';

const MARKET_LABELS: Record<Market, string> = { IN: 'India', US: 'United States' };

function Choice({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
            value === option
              ? 'border-brand-500 bg-brand-600/10 text-brand-700 dark:text-brand-400'
              : 'border-hairline text-content-muted hover:text-content',
          )}
        >
          {labels?.[option] ?? option}
        </button>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  useDocumentTitle('Profile and settings', 'Your account, base currency, theme and data sources.');

  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { updateProfile, changePassword } = useProfileMutations();
  const marketStatus = useMarketStatus();
  const aiStatus = useAiStatus();
  const fundUniverse = useFundUniverse();

  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordDone, setPasswordDone] = useState(false);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  if (!user) return null;

  const preferences = user.preferences;
  const nameChanged = name.trim().length >= 2 && name.trim() !== user.name;

  const savePreference = (patch: Partial<typeof preferences>) => {
    updateProfile.mutate({ preferences: { ...patch } });
  };

  return (
    <div className="container max-w-4xl space-y-6 py-8 sm:py-10">
      <header className="space-y-2">
        <p className="text-eyebrow uppercase text-brand-600 dark:text-brand-400">Settings</p>
        <h1 className="text-display-md">{user.name}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-content-subtle">
          {user.email}
          {user.providers.map((provider) => (
            <Badge key={provider}>{provider === 'google' ? 'Google sign-in' : 'Email sign-in'}</Badge>
          ))}
          <span>· joined {formatDate(user.createdAt)}</span>
        </p>
      </header>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <UserIcon className="size-4 text-content-subtle" aria-hidden />
          Account
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Display name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            className="flex-1"
          />
          <Button
            size="sm"
            disabled={!nameChanged}
            loading={updateProfile.isPending}
            onClick={() => updateProfile.mutate({ name: name.trim() })}
          >
            Save
          </Button>
        </div>

        {updateProfile.isSuccess ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-bull">
            <Check className="size-4" aria-hidden />
            Saved.
          </p>
        ) : null}
        {updateProfile.isError ? (
          <p className="mt-3 text-sm text-bear">
            {updateProfile.error instanceof ApiError ? updateProfile.error.message : 'That did not save.'}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Landmark className="size-4 text-content-subtle" aria-hidden />
          Money
        </h2>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Base currency</span>
          <p className="text-xs text-content-subtle">
            New portfolios are valued in this currency. Existing portfolios keep the currency they were created with.
          </p>
          <Choice
            options={CURRENCIES}
            value={preferences.baseCurrency}
            onChange={(next) => savePreference({ baseCurrency: next as Currency })}
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Home market</span>
          <p className="text-xs text-content-subtle">Which market the overview page opens on.</p>
          <Choice
            options={MARKETS}
            value={preferences.defaultMarket}
            onChange={(next) => savePreference({ defaultMarket: next as Market })}
            labels={MARKET_LABELS}
          />
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <BellRing className="size-4 text-content-subtle" aria-hidden />
          Appearance and alerts
        </h2>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Theme</span>
          <Choice
            options={['light', 'dark'] as const}
            value={theme}
            onChange={(next) => {
              setTheme(next as 'light' | 'dark');
              savePreference({ theme: next as 'light' | 'dark' });
            }}
          />
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={preferences.emailAlerts}
            onChange={(event) => savePreference({ emailAlerts: event.target.checked })}
            className="mt-1 size-4 rounded border-hairline accent-brand-600"
          />
          <span>
            <span className="block text-sm font-medium">Email me when an alert fires</span>
            <span className="block text-xs text-content-subtle">
              Stored on your profile. No mail is sent yet — alerts currently surface in the notification bell only.
            </span>
          </span>
        </label>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <KeyRound className="size-4 text-content-subtle" aria-hidden />
          Password
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <PasswordField
            label="New password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            loading={changePassword.isPending}
            disabled={!currentPassword || newPassword.length < 8}
            onClick={async () => {
              setPasswordDone(false);
              await changePassword.mutateAsync({ currentPassword, newPassword });
              setCurrentPassword('');
              setNewPassword('');
              setPasswordDone(true);
            }}
          >
            Change password
          </Button>
          <p className="text-xs text-content-subtle">
            Changing it signs out every other session, including anywhere you left yourself logged in.
          </p>
        </div>

        {passwordDone ? (
          <p className="flex items-center gap-1.5 text-sm text-bull">
            <Check className="size-4" aria-hidden />
            Password changed.
          </p>
        ) : null}
        {changePassword.isError ? (
          <p className="text-sm text-bear">
            {changePassword.error instanceof ApiError ? changePassword.error.message : 'That did not work.'}
          </p>
        ) : null}
      </Card>

      <Section
        eyebrow="Data"
        title="Where the numbers come from"
        description="Nothing here is a secret: this is exactly which provider answered and how fresh it is."
        className="px-0 pb-0 pt-2"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="space-y-3 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Radio className="size-4 text-content-subtle" aria-hidden />
              Market data
            </h3>

            <p className="flex items-center gap-2 text-sm">
              <DataSourceBadge source={marketStatus.data?.liveData ? 'fmp' : 'sample'} />
              {marketStatus.data?.liveData ? 'Live provider connected' : 'Simulated prices'}
            </p>

            <ul className="space-y-1 text-xs text-content-muted">
              {marketStatus.data?.providers.map((provider) => (
                <li key={provider.id} className="flex items-center justify-between gap-2">
                  <span>{provider.label}</span>

                  {!provider.configured ? (
                    <span className="text-content-subtle">no key</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span data-numeric className="text-content-muted">
                        {provider.calls} calls
                      </span>
                      {provider.failures ? (
                        <span className="text-bear" title={provider.lastError ?? undefined}>
                          {provider.failures} errors
                        </span>
                      ) : (
                        <span className="text-bull">healthy</span>
                      )}
                      {provider.coverageMisses ? (
                        <span
                          className="text-content-subtle"
                          title="Requests this provider's plan does not cover — the chain fell through to another provider, as designed."
                        >
                          {provider.coverageMisses} not covered
                        </span>
                      ) : null}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {marketStatus.data ? (
              <p className="text-xs text-content-subtle">
                Cache: {marketStatus.data.cache.entries} entries, {(marketStatus.data.cache.hitRate * 100).toFixed(0)}%
                hit rate
              </p>
            ) : null}
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-content-subtle" aria-hidden />
              AI reports
            </h3>

            {aiStatus.data ? (
              <>
                <p className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                      aiStatus.data.healthy
                        ? 'bg-bull/12 text-bull'
                        : aiStatus.data.configured
                          ? 'bg-bear/12 text-bear'
                          : 'bg-content/[0.06] text-content-muted',
                    )}
                  >
                    {aiStatus.data.healthy ? (aiStatus.data.model ?? 'Connected') : aiStatus.data.configured ? 'Failing' : 'Rule engine'}
                  </span>
                  {aiStatus.data.healthy ? 'Written by a language model' : 'Reports come from the rule engine'}
                </p>

                <p className="text-xs text-content-subtle">{aiStatus.data.note}</p>
              </>
            ) : (
              <Skeleton rounded="sm" className="h-4 w-40" />
            )}
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Database className="size-4 text-content-subtle" aria-hidden />
              Mutual funds
            </h3>

            <p className="text-sm">
              {fundUniverse.data
                ? `${fundUniverse.data.schemes.toLocaleString('en-IN')} AMFI schemes`
                : 'Loading the AMFI universe…'}
            </p>

            {fundUniverse.data?.latestNavDate ? (
              <p className="text-xs text-content-muted">
                NAVs dated {formatDate(fundUniverse.data.latestNavDate)}
                {fundUniverse.data.lastRefreshAt
                  ? ` · refreshed ${formatRelativeTime(fundUniverse.data.lastRefreshAt)}`
                  : ''}
              </p>
            ) : null}

            <p className="text-xs text-content-subtle">
              Published daily by AMFI and refreshed every six hours. No API key involved.
            </p>
          </Card>
        </div>
      </Section>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-content-subtle" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold">Broker connections</h2>
            <p className="text-xs text-content-subtle">
              Credentials are encrypted and only ever used to read holdings. Manage them from the portfolio import
              dialog.
            </p>
          </div>
        </div>
        <Link
          to="/portfolio"
          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Open portfolio
        </Link>
      </Card>
    </div>
  );
}
