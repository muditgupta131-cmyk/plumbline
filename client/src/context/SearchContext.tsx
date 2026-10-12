import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';
import { SearchDialog } from '@/components/search';
import { useHotkey } from '@/hooks/useHotkey';

interface SearchContextValue {
  isOpen: boolean;
  open: (initialQuery?: string) => void;
  close: () => void;
}

export const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [seedQuery, setSeedQuery] = useState('');

  const open = useCallback((initialQuery = '') => {
    setSeedQuery(initialQuery);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  useHotkey({ key: 'k', meta: true }, () => setIsOpen((current) => !current));
  useHotkey({ key: '/', enabled: !isOpen }, () => open());

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      <SearchDialog open={isOpen} initialQuery={seedQuery} onClose={close} />
    </SearchContext.Provider>
  );
}
