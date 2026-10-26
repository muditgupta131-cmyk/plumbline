import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 ease-swift disabled:pointer-events-none disabled:opacity-50 active:translate-y-px';

const variants: Record<Variant, string> = {
  // A raised control: specular top rim, occluded base, and the cyan blooms on hover.
  primary: 'relief bg-brand-600 text-white hover:bg-brand-500 hover:shadow-glow active:shadow-none dark:bg-brand-400 dark:text-ink-900 dark:hover:bg-brand-300',
  secondary: 'relief border border-hairline bg-elevated text-content hover:text-brand-600 dark:hover:text-brand-400',
  ghost: 'text-content-muted hover:bg-content/5 hover:text-content',
  danger: 'relief bg-bear text-white hover:opacity-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export interface ButtonProps extends BaseProps, ButtonHTMLAttributes<HTMLButtonElement> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, fullWidth, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

interface ButtonLinkProps extends BaseProps {
  to: string;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth,
  className,
  children,
}: ButtonLinkProps) {
  return (
    <Link
      to={to}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
    >
      {icon}
      {children}
    </Link>
  );
}
