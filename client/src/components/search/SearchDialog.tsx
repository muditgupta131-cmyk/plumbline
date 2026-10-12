import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, CornerDownLeft, Loader2, Search, TrendingUp, X } from 'lucide-react';
import { DataSourceBadge } from '@/components/market';
import { useSymbolSearch, useQuotes, useTrendingSymbols } from '@/hooks/useMarketData';
import { useRecentSymbols } from '@/hooks/useRecentSymbols';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { securityKey, type SymbolMatch } from '@/types';
import { SearchResultRow } from './SearchResultRow';

interface SearchDialogProps {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
}

export function SearchDialog({ open, initialQuery = '', onClose }: SearchDialogProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  const [input, setInput] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);

  const { recent, remember } = useRecentSymbols();
  const search = useSymbolSearch(input, 8);
  const trending = useTrendingSymbols(undefined, 6);

  const showFallback = input.trim().length === 0;
  const fallbackMatches = recent.length ? recent : (trending.data?.results ?? []);
  const matches: SymbolMatch[] = showFallback ? fallbackMatches.slice(0, 6) : search.results;

  const quotes = useQuotes(
    matches.map((match) => ({ symbol: match.symbol, exchange: match.exchange })),
    open,
  );

  const quoteMap = useMemo(
    () => new Map((quotes.data?.quotes ?? []).map((quote) => [securityKey(quote), quote])),
    [quotes.data],
  );

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    setInput(initialQuery);
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open, initialQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [search.query, showFallback]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, matches.length]);

  const select = useCallback(
    (match: SymbolMatch) => {
      remember(match);
      onClose();
      navigate(`/stocks/${match.exchange}/${encodeURIComponent(match.symbol)}`);
    },
    [remember, navigate, onClose],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (!matches.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % matches.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(matches.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const match = matches[activeIndex];
      if (match) select(match);
    }
  };

  const busy = search.isFetching || search.isTyping;
  const noResults = !showFallback && !busy && matches.length === 0;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh] sm:pt-[16vh]"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search stocks"
            initial={reduceMotion ? false : { opacity: 0, y: -12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl overflow-hidden rounded-panel border border-hairline bg-elevated/95 shadow-lift backdrop-blur-2xl"
          >
            <div className="flex items-center gap-3 border-b border-hairline px-4 py-3.5">
              <Search className="size-4 shrink-0 text-content-subtle" aria-hidden />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded
                aria-controls="search-dialog-results"
                aria-autocomplete="list"
                aria-activedescendant={matches.length ? `search-option-${activeIndex}` : undefined}
                placeholder="Search a company or ticker — RELIANCE, Infosys, AAPL…"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                className="w-full bg-transparent text-sm outline-none placeholder:text-content-subtle focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {busy ? <Loader2 className="size-4 animate-spin text-content-subtle" aria-hidden /> : null}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close search"
                className="rounded-full p-1 text-content-subtle transition-colors hover:bg-content/5 hover:text-content"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="max-h-[54vh] overflow-y-auto p-2">
              {showFallback ? (
                <p className="flex items-center gap-1.5 px-3 py-2 text-eyebrow uppercase text-content-subtle">
                  {recent.length ? (
                    <>
                      <Clock className="size-3" aria-hidden /> Recent
                    </>
                  ) : (
                    <>
                      <TrendingUp className="size-3" aria-hidden /> Popular right now
                    </>
                  )}
                </p>
              ) : null}

              {noResults ? (
                <div className="px-3 py-10 text-center">
                  <p className="text-sm font-medium">No match for “{search.query}”</p>
                  <p className="mt-1 text-sm text-content-muted">
                    Try a ticker like RELIANCE, TCS or NVDA, or the full company name.
                  </p>
                </div>
              ) : (
                <ul id="search-dialog-results" role="listbox" aria-label="Search results" ref={listRef}>
                  {matches.map((match, index) => (
                    <SearchResultRow
                      key={securityKey(match)}
                      id={`search-option-${index}`}
                      match={match}
                      quote={quoteMap.get(securityKey(match))}
                      quoteLoading={quotes.isPending}
                      active={index === activeIndex}
                      onSelect={() => select(match)}
                      onHover={() => setActiveIndex(index)}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-2.5 text-[11px] text-content-subtle">
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-hairline px-1 py-0.5">↑</kbd>
                  <kbd className="rounded border border-hairline px-1 py-0.5">↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-hairline px-1 py-0.5">
                    <CornerDownLeft className="size-2.5" aria-hidden />
                  </kbd>
                  open
                </span>
                <span className="hidden items-center gap-1 sm:flex">
                  <kbd className="rounded border border-hairline px-1 py-0.5">esc</kbd>
                  close
                </span>
              </span>
              <DataSourceBadge source={quotes.data?.quotes[0]?.source} />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
