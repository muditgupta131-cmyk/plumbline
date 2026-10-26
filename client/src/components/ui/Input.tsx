import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, trailing, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-content">
          {label}
        </label>
      ) : null}

      <div
        className={cn(
          'inset-well flex h-11 items-center gap-2.5 rounded-lg border bg-canvas px-3.5 transition-colors duration-200',
          'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20',
          error ? 'border-bear' : 'border-hairline',
        )}
      >
        {leading ? <span className="text-content-subtle">{leading}</span> : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full bg-transparent text-sm text-content outline-none placeholder:text-content-subtle',
            className,
          )}
          {...props}
        />
        {trailing}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-bear">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-content-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
