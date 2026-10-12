import { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui';
import { cn } from '@/utils/cn';

interface PasswordFieldProps extends Omit<InputProps, 'type' | 'leading' | 'trailing'> {
  showStrength?: boolean;
}

const RULES = [
  { label: '10+ characters', test: (value: string) => value.length >= 10 },
  { label: 'Uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { label: 'Number', test: (value: string) => /\d/.test(value) },
];

export function PasswordField({ showStrength = false, value, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const current = typeof value === 'string' ? value : '';

  const results = useMemo(() => RULES.map((rule) => ({ ...rule, passed: rule.test(current) })), [current]);
  const passedCount = results.filter((rule) => rule.passed).length;

  return (
    <div className="space-y-2">
      <Input
        {...props}
        value={value}
        type={visible ? 'text' : 'password'}
        leading={<Lock className="size-4" aria-hidden />}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((open) => !open)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="text-content-subtle transition-colors hover:text-content"
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        }
      />

      {showStrength && current.length > 0 ? (
        <ul className="grid grid-cols-2 gap-1.5" aria-live="polite">
          {results.map((rule) => (
            <li
              key={rule.label}
              className={cn(
                'flex items-center gap-1.5 text-xs transition-colors',
                rule.passed ? 'text-bull' : 'text-content-subtle',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full transition-colors',
                  rule.passed ? 'bg-bull' : 'bg-content-subtle/40',
                )}
              />
              {rule.label}
            </li>
          ))}
        </ul>
      ) : null}

      {showStrength && current.length > 0 ? (
        <div className="h-1 overflow-hidden rounded-full bg-content/10">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              passedCount <= 1 && 'w-1/4 bg-bear',
              passedCount === 2 && 'w-2/4 bg-amber-500',
              passedCount === 3 && 'w-3/4 bg-amber-400',
              passedCount === 4 && 'w-full bg-bull',
            )}
          />
        </div>
      ) : null}
    </div>
  );
}
