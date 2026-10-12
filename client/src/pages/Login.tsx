import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Mail } from 'lucide-react';
import { AuthLayout, GoogleSignInButton, PasswordField } from '@/components/auth';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAuthForm } from '@/hooks/useAuthForm';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function LoginPage() {
  useDocumentTitle('Sign in', 'Sign in to Plumbline to track portfolios, watchlists and AI research.');

  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle } = useAuth();
  const { submitting, formError, fieldErrors, submit } = useAuthForm();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/portfolio';

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(async () => {
      await login({ email, password });
      navigate(redirectTo, { replace: true });
    });
  };

  const handleGoogle = (credential: string) => {
    void submit(async () => {
      await loginWithGoogle(credential);
      navigate(redirectTo, { replace: true });
    });
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to Plumbline"
      subtitle="Pick up where you left off with your portfolio, watchlist and saved reports."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Create an account
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <GoogleSignInButton onCredential={handleGoogle} text="signin_with" />

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
            autoComplete="current-password"
            required
            value={password}
            error={fieldErrors.password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
          />

          <Button type="submit" fullWidth loading={submitting}>
            Sign in
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
