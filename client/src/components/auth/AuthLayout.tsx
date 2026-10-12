import type { ReactNode } from 'react';
import { ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { Logo } from '@/components/layout';

const proofPoints = [
  { icon: TrendingUp, text: 'NSE, BSE, NASDAQ and NYSE fundamentals in one place' },
  { icon: Sparkles, text: 'AI research reports on any ticker you follow' },
  { icon: ShieldCheck, text: 'Your holdings stay private and are never sold' },
];

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ eyebrow, title, subtitle, footer, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-7">
          <div className="space-y-2">
            <p className="text-eyebrow uppercase text-brand-600 dark:text-brand-400">{eyebrow}</p>
            <h1 className="text-display-md">{title}</h1>
            <p className="text-sm text-content-muted">{subtitle}</p>
          </div>

          {children}

          <p className="text-center text-sm text-content-muted">{footer}</p>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-hairline bg-surface lg:block">
        <div className="surface-gradient absolute inset-0" aria-hidden />
        <div className="hairline-grid absolute inset-0" aria-hidden />

        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />

          <div className="space-y-8">
            <p className="max-w-sm text-2xl font-display font-semibold leading-snug text-balance">
              Know what you own, and why you own it.
            </p>

            <ul className="space-y-4">
              {proofPoints.map((point) => (
                <li key={point.text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-600 dark:text-brand-400">
                    <point.icon className="size-4" aria-hidden />
                  </span>
                  <span className="text-sm text-content-muted">{point.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-content-subtle">
            Plumbline is a research tool, not an advisor. Verify every figure against your broker before you
            rely on it.
          </p>
        </div>
      </aside>
    </div>
  );
}
