import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface SectionProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Section({ eyebrow, title, description, action, className, children }: SectionProps) {
  return (
    <section className={cn('py-12 sm:py-16', className)}>
      <div className="container">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-2">
            {eyebrow ? <p className="text-eyebrow uppercase text-brand-600 dark:text-brand-400">{eyebrow}</p> : null}
            <h2 className="text-display-md text-balance">{title}</h2>
            {description ? <p className="text-content-muted">{description}</p> : null}
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}
