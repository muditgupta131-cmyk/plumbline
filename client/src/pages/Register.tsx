import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Mail, User } from 'lucide-react';
import { AuthLayout, GoogleSignInButton, PasswordField } from '@/components/auth';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAuthForm } from '@/hooks/useAuthForm';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/utils/cn';
import { MARKET_CURRENCY, type Market } from '@/types';

const MARKET_OPTIONS: Array<{ value: Market; label: string; detail: string }> = [
  { value: 'IN', label: 'India', detail: 'NSE and BSE · ₹ INR' },
  { value: 'US', label: 'United States', detail: 'NASDAQ and NYSE · $ USD' },
];

export default function RegisterPage() {
  useDocumentTitle('Create your account', 'Create a free Plumbline account to analyse stocks and portfolios.');

  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth();
  const { submitting, formError, fieldErrors, submit } = useAuthForm();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [market, setMarket] = useState<Market>('IN');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(async () => {
      await register({
        name,
        email,
        password,
        defaultMarket: market,
        baseCurrency: MARKET_CURRENCY[market],
      });
      navigate('/portfolio', { replace: true });
    });
  };

  const handleGoogle = (credential: string) => {
    void submit(async () => {
      await loginWithGoogle(credential);
      navigate('/portfolio', { replace: true });
    });
  };

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your account"
      subtitle="Free while in beta. No card, no broker connection, no data sold."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <GoogleSignInButton onCredential={handleGoogle} text="signup_with" />

        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-content-subtle">
          <span className="h-px flex-1 bg-hairline" />
          or use email
          <span className="h-px flex-1 bg-hairline" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-bear/30 bg-bear/8 p-3 text-sm text-bear"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{formError}</span>
            </div>
          ) : null}

          <Input
            label="Name"
            name="name"
            autoComplete="name"
            required
            value={name}
            error={fieldErrors.name}
            onChange={(event) => setName(event.target.value)}
            leading={<User className="size-4" aria-hidden />}
            placeholder="Your name"
          />

          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            error={fieldErrors.email}
            onChange={(event) => setEmail(event.target.value)}
            leading={<Mail className="size-4" aria-hidden />}
            placeholder="you@example.com"
          />

          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            required
            showStrength
            value={password}
            error={fieldErrors.password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
          />

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-content">Which market do you follow most?</legend>
            <div className="grid grid-cols-2 gap-2">
              {MARKET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMarket(option.value)}
                  aria-pressed={market === option.value}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-all duration-200',
                    market === option.value
                      ? 'border-brand-500 bg-brand-600/8'
                      : 'border-hairline hover:border-content-subtle',
                  )}
                >
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-content-subtle">{option.detail}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-content-subtle">
              Sets your base currency for portfolio totals. You can hold stocks from both markets either way.
            </p>
          </fieldset>

          <Button type="submit" fullWidth loading={submitting}>
            Create account
          </Button>

          <p className="text-center text-xs text-content-subtle">
            Your holdings stay in your own database. Plumbline is a research tool, not an advisor.
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}
