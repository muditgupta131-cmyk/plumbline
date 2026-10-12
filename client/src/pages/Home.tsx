import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, ArrowRight, Brain, LineChart, Search, ShieldCheck } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, Section } from '@/components/ui';
import { QueryError } from '@/components/feedback';
import { IndexCard, IndexCardSkeleton, MoversTable, SectorHeat, TickerTape } from '@/components/market';
import { useIndices, useMarketOverview } from '@/hooks/useMarketData';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { useSearchDialog } from '@/hooks/useSearchDialog';

const capabilities = [
  {
    icon: Brain,
    title: 'AI research reports',
    body: 'A full write-up on any ticker: business model, moat, financial health, valuation and the risks worth watching.',
  },
  {
    icon: LineChart,
    title: 'Portfolio intelligence',
    body: 'Track cost basis, allocation and CAGR, then get a diversification score with concrete rebalancing suggestions.',
  },
  {
    icon: Activity,
    title: 'Live market data',
    body: 'Quotes, fundamentals, filings and news pulled from four independent providers with automatic failover.',
  },
  {
    icon: ShieldCheck,
    title: 'Health scoring',
    body: 'Profitability, liquidity, debt, growth and cash flow scored on one 0–100 scale you can compare across sectors.',
  },
];

export default function HomePage() {
  useDocumentTitle();
  const reduceMotion = usePrefersReducedMotion();
  const navigate = useNavigate();
  const { open } = useSearchDialog();
  const [query, setQuery] = useState('');

  const tape = useIndices();
  const overview = useMarketOverview('IN', 5);

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="hairline-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="surface-gradient pointer-events-none absolute inset-0" aria-hidden />

        <div className="container relative py-20 sm:py-28">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl space-y-6"
          >
            <Badge tone="brand">Market data engine · live</Badge>

            <h1 className="text-display-xl text-balance">
              AI Powered Stock &amp; Portfolio Analysis
            </h1>

            <p className="max-w-xl text-lg text-content-muted">
              Search any listed company, read the fundamentals in plain language, and see what your portfolio is
              actually exposed to.
            </p>

            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                navigate(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search');
              }}
              className="flex max-w-lg flex-col gap-3 sm:flex-row"
            >
              <div className="flex-1">
                <Input
                  type="search"
                  aria-label="Search by ticker or company name"
                  placeholder="Search AAPL, Reliance, NVDA…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onClick={() => open(query)}
                  leading={<Search className="size-4" aria-hidden />}
                  hint="Press ⌘K anywhere to open search."
                />
              </div>
              <Button type="submit" icon={<ArrowRight className="size-4" aria-hidden />}>
                Analyse
              </Button>
            </form>
          </motion.div>
        </div>
      </section>

      <TickerTape indices={tape.data?.indices ?? []} />

      <section className="container py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((item, index) => (
            <motion.div
              key={item.title}
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card interactive className="h-full p-6">
                <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600 dark:text-brand-400">
                  <item.icon className="size-5" aria-hidden />
                </span>
                <h2 className="mb-2 text-base font-semibold">{item.title}</h2>
                <p className="text-sm leading-relaxed text-content-muted">{item.body}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <Section
        eyebrow="Live markets"
        title="What the market is doing right now"
        description="Indices, movers and sector rotation across India and the United States, refreshed every minute."
        action={
          <ButtonLink to="/markets" variant="secondary" size="sm" icon={<ArrowRight className="size-4" aria-hidden />}>
            Full overview
          </ButtonLink>
        }
        className="pb-24 pt-0"
      >
        {overview.isError ? (
          <QueryError error={overview.error} onRetry={() => overview.refetch()} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {overview.data
                ? overview.data.indices.map((index) => <IndexCard key={index.id} index={index} />)
                : Array.from({ length: 3 }).map((_, index) => <IndexCardSkeleton key={index} />)}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <MoversTable movers={overview.data?.movers} loading={overview.isPending} />
              </div>
              <div className="lg:col-span-5">
                <SectorHeat sectors={overview.data?.sectors.slice(0, 6)} loading={overview.isPending} />
              </div>
            </div>
          </>
        )}
      </Section>

    </>
  );
}
