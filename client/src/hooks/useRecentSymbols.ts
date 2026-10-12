import { useCallback } from 'react';
import { securityKey, type SymbolMatch } from '@/types';
import { useLocalStorage } from './useLocalStorage';

const STORAGE_KEY = 'plumbline.recent-symbols';
const MAX_ENTRIES = 6;

export function useRecentSymbols() {
  const [recent, setRecent, clear] = useLocalStorage<SymbolMatch[]>(STORAGE_KEY, []);

  const remember = useCallback(
    (match: SymbolMatch) => {
      setRecent((current) => {
        const key = securityKey(match);
        return [match, ...current.filter((entry) => securityKey(entry) !== key)].slice(0, MAX_ENTRIES);
      });
    },
    [setRecent],
  );

  return { recent, remember, clear };
}
