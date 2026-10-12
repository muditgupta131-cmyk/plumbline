import type { NavItem } from '@/types';

export const primaryNav: NavItem[] = [
  { label: 'Markets', to: '/markets', description: 'Indices, movers and sector heat' },
  { label: 'Search', to: '/search', description: 'Any listed company, by name or ticker' },
  { label: 'Compare', to: '/compare', description: 'Put companies side by side' },
  { label: 'Screener', to: '/screener', description: 'Filter on valuation, growth and debt' },
  { label: 'Funds', to: '/funds', description: 'Every AMFI scheme, ranked on real returns' },
  { label: 'Bonds', to: '/bonds', description: 'Corporate and government debt, with computed yields' },
  { label: 'IPOs', to: '/ipo', description: 'Grey market premium, subscription and the base rates' },
  { label: 'News', to: '/news', description: 'Headlines with sentiment on every story' },
  { label: 'Learn', to: '/learn', description: 'Every metric, explained plainly' },
];

export const accountNav: NavItem[] = [
  { label: 'Portfolio', to: '/portfolio', requiresAuth: true },
  { label: 'Watchlist', to: '/watchlist', requiresAuth: true },
];

export const footerNav = [
  {
    title: 'Research',
    links: [
      { label: 'Markets', to: '/markets' },
      { label: 'Search', to: '/search' },
      { label: 'Compare', to: '/compare' },
      { label: 'Screener', to: '/screener' },
      { label: 'Funds', to: '/funds' },
      { label: 'Bonds', to: '/bonds' },
      { label: 'IPOs', to: '/ipo' },
      { label: 'News', to: '/news' },
    ],
  },
  {
    title: 'Your money',
    links: [
      { label: 'Portfolio', to: '/portfolio' },
      { label: 'Watchlist', to: '/watchlist' },
      { label: 'Settings', to: '/profile' },
      { label: 'Learn', to: '/learn' },
    ],
  },
] as const;
