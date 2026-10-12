import { useContext } from 'react';
import { SearchContext } from '@/context/SearchContext';

export function useSearchDialog() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearchDialog must be used inside a SearchProvider');
  }
  return context;
}
