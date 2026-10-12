import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'article' | 'section';
  interactive?: boolean;
  glass?: boolean;
}

export function Card({ as: Tag = 'div', interactive, glass, className, children, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-card border border-hairline shadow-card',
        glass ? 'glass' : 'bg-surface',
        interactive && 'transition-all duration-300 ease-swift hover:-translate-y-0.5 hover:shadow-lift',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, eyebrow, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 p-5 sm:p-6', className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow ? <p className="text-eyebrow uppercase text-content-subtle">{eyebrow}</p> : null}
        <h3 className="truncate text-lg font-semibold">{title}</h3>
        {description ? <p className="text-sm text-content-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props}>
      {children}
    </div>
  );
}
