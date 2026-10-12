import { Suspense } from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import { ErrorBoundary, PageLoader } from '@/components/feedback';
import { SearchProvider } from '@/context/SearchContext';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function AppShell() {
  return (
    <SearchProvider>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>

        <Navbar />

        <main id="main" className="flex-1">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>

        <Footer />
        <ScrollRestoration />
      </div>
    </SearchProvider>
  );
}
