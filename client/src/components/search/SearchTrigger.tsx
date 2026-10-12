import { Search } from 'lucide-react';
import { useSearchDialog } from '@/hooks/useSearchDialog';
import { cn } from '@/utils/cn';

const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function SearchTrigger({ className }: { className?: string }) {
  const { open } = useSearchDialog();

  return (
    <>
      <button
        type="button"
        onClick={() => open()}
        className={cn(
          'hidden h-9 items-center gap-2 rounded-full border border-hairline bg-surface/70 px-3 text-sm text-content-subtle transition-colors hover:border-brand-500/50 hover:text-content md:flex',
          className,
        )}
      >
        <Search className="size-4" aria-hidden />
        <span className="pr-6">Search stocks</span>
        <kbd className="rounded border border-hairline px-1.5 py-0.5 text-[10px] font-medium">
          {isApple ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => open()}
        aria-label="Search stocks"
        className="flex size-9 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-content/5 hover:text-content md:hidden"
      >
        <Search className="size-4" aria-hidden />
      </button>
    </>
  );
}
