import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { GuestOnlyRoute, ProtectedRoute } from '@/components/auth';

const HomePage = lazy(() => import('@/pages/Home'));
const SearchPage = lazy(() => import('@/pages/Search'));
const MarketsPage = lazy(() => import('@/pages/Markets'));
const ComparePage = lazy(() => import('@/pages/Compare'));
const ScreenerPage = lazy(() => import('@/pages/Screener'));
const FundsPage = lazy(() => import('@/pages/Funds'));
const BondsPage = lazy(() => import('@/pages/Bonds'));
const FundDetailPage = lazy(() => import('@/pages/FundDetail'));
const NewsPage = lazy(() => import('@/pages/News'));
const IpoPage = lazy(() => import('@/pages/Ipo'));
const LearnPage = lazy(() => import('@/pages/Learn'));
const LearnEntryPage = lazy(() => import('@/pages/LearnEntry'));
const StockPage = lazy(() => import('@/pages/Stock'));
const PortfolioPage = lazy(() => import('@/pages/Portfolio'));
const WatchlistPage = lazy(() => import('@/pages/Watchlist'));
const ProfilePage = lazy(() => import('@/pages/Profile'));
const LoginPage = lazy(() => import('@/pages/Login'));
const RegisterPage = lazy(() => import('@/pages/Register'));
const NotFoundPage = lazy(() => import('@/pages/NotFound'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'markets', element: <MarketsPage /> },
      { path: 'compare', element: <ComparePage /> },
      { path: 'screener', element: <ScreenerPage /> },
      { path: 'funds', element: <FundsPage /> },
      { path: 'funds/:schemeCode', element: <FundDetailPage /> },
      { path: 'bonds', element: <BondsPage /> },
      { path: 'news', element: <NewsPage /> },
      { path: 'ipo', element: <IpoPage /> },
      { path: 'learn', element: <LearnPage /> },
      { path: 'learn/:slug', element: <LearnEntryPage /> },
      { path: 'stocks/:exchange/:symbol', element: <StockPage /> },
      {
        element: <GuestOnlyRoute />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'portfolio', element: <PortfolioPage /> },
          { path: 'watchlist', element: <WatchlistPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
