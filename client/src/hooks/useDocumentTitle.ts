import { useEffect } from 'react';

const BASE_TITLE = 'Plumbline';

export function useDocumentTitle(title?: string, description?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : `${BASE_TITLE} — AI Powered Stock & Portfolio Analysis`;

    if (description) {
      const tag = document.querySelector('meta[name="description"]');
      tag?.setAttribute('content', description);
    }
  }, [title, description]);
}
