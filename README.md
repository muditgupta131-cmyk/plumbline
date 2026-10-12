# Plumbline

A private stock and mutual fund tracker with AI research. React 19 + Vite + Tailwind on the front, Express + Mongoose on the back, one npm workspace.

Built to answer one question well: **what do I actually own, and what is it doing?**

## What it does

| | |
| --- | --- |
| **Search** | Any listed company across NSE, BSE, NASDAQ, NYSE and AMEX, plus all ~14,000 AMFI mutual fund schemes |
| **Markets** | Indices, gainers, losers, most active, sector rotation, breadth, and live session clocks per exchange |
| **Stock detail** | 26 fundamentals grouped the way an analyst reads them, price history from 1D to 5Y, and a company profile |
| **AI research** | A full report per company and per portfolio — grounded in figures computed in code, never in the model's memory |
| **Portfolio** | Stocks and funds together, valued in one base currency with live FX, allocation by holding, sector, asset class and country |
| **Import** | Groww holdings and order statements, plus Zerodha, Upstox, Angel One, Dhan and ICICI formats — or a direct read-only broker API connection |
| **Returns** | FIFO lot matching for realised gains, and XIRR for the money-weighted return an averaged cost cannot express |
| **Watchlist** | Price and percentage-move alerts checked every five minutes, with notifications |
| **Compare** | Up to four companies side by side, with the best reading on each row marked |
| **Screener** | Filter on valuation, profitability, growth, debt and yield, with presets and sortable columns |
| **Learn** | Twenty-one explainers, each covering how a metric misleads as well as what it means |

## Quick start

```bash
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run dev
```

Then open http://localhost:5273. The API runs on 5050 (5000 is taken by macOS AirPlay).

**It works immediately with no API keys.** Market data falls back to a built-in sample provider, clearly labelled as such everywhere it appears. Two things make it real:

- **`MONGODB_URI`** — a local `mongodb://127.0.0.1:27017/investiq` is enough. Without it the app still runs; auth and saved data are simply unavailable
- **A market data key** — `FMP_API_KEY` or `TWELVE_DATA_API_KEY` (both have free tiers). Mutual fund NAVs need no key at all: they come from AMFI's public daily file

Everything else is optional: `OPENAI_API_KEY` upgrades AI reports from the built-in rule engine, `ENCRYPTION_KEY` enables broker connections, `GOOGLE_CLIENT_ID` enables Google sign-in.

## Connecting live market data

The chain is FMP → Finnhub → Twelve Data → **Yahoo Finance** → Alpha Vantage → sample. Each is optional; whatever is configured gets used in that order, and the response says which one answered.

### What the free plans actually cover

Probed rather than assumed, because the marketing pages do not say:

| Provider | Covers | Does not |
| --- | --- | --- |
| **FMP** (entry) | US quotes, profiles, TTM ratios, statements, daily history, indices, FX | Indian listings (402), batch quotes, intraday |
| **Twelve Data** (basic) | US quotes and candles, 8 calls/min, 800/day | **Indian listings — "available starting with the Grow plan"** |
| **Yahoo Finance** | Quotes and candles for **NSE, BSE and US**, keyless and unmetered | Fundamentals, profiles |
| **Alpha Vantage** (free) | Indian *quotes* via the `.BSE` suffix, US fundamentals | **Indian fundamentals — `OVERVIEW` returns empty.** 25 calls/day |
| **AMFI** | Every Indian mutual fund NAV, daily, keyless | Anything that is not a fund |

**Indian equities on a free plan means Yahoo.** It is an unofficial endpoint with no SLA or documented terms for programmatic use — it can change or rate-limit without notice — but it is the only unmetered free route to NSE and BSE prices.

Alpha Vantage covers Indian quotes too, so it sits directly behind Yahoo as the backup for exactly that case. It is capped at **20 calls a day** in `PROVIDER_DAILY_LIMITS` rather than sharing the global budget, because its free tier allows 25 and spending it like an ordinary provider would exhaust it in one page view. Ordering matters here: an unmetered provider must be tried before a rationed one, or the ration is gone before it is needed.

### Three safeguards for metered plans

- **A daily call budget** (`MARKET_DAILY_CALL_BUDGET`, default 220). When spent, that provider leaves the chain for the day and the app degrades rather than hard-failing
- **Coverage memory.** A provider that answers "not on your plan" for a market is remembered for 24 hours and skipped for that market, so a screener over 55 Indian symbols does not spend 55 wasted calls learning the same thing. It is per market, never global, and it reads the plan message out of the provider's own response — which is why upstream errors now carry the provider's text instead of a bare status code
- **The test suite runs on sample data**, with provider keys deleted and `YAHOO_ENABLED=false`, so hundreds of integration calls never touch a live quota

Where a holding has no live quote, the portfolio says so: a banner naming how many holdings are simulated, and a marker on each affected row. A blended total that silently mixes real and simulated prices would be worse than useless.

## Testing

```bash
npm run test:market --workspace server
npm run test:cas --workspace server
npm run test:ipo --workspace server
npm run test:funds --workspace server
npm run test:bonds --workspace server

# writes and deletes rows, so point it at a throwaway database
MONGODB_URI="mongodb://127.0.0.1:27017/investiq_test" npm run test:import --workspace server
```

`test:market` runs 333 integration checks against the live API — provider failover, coverage gaps
versus real errors, currency conversion, FIFO arithmetic, XIRR against an independently computed
CAGR, news sentiment and de-duplication, alert firing and cooldowns, credential encryption, and
per-user isolation. It cleans up after itself and works with the database offline (skipping the
checks that need it).

`test:cas` reads two generated CAMS-format statements end to end: the password prompts, the two
import modes, ISIN capture, and that replaying the parsed ledger reproduces the closing balance
printed on the statement. The fixtures are synthetic, so no real holding data sits in the repo.

`test:funds` checks the compounding behind the returns column, the window parser that picks the
right NAV out of AMFI's historical file, and the category folding — AMFI writes "Equity Scheme" and
"Equity Schemes" for the same thing, which would otherwise split the largest categories in two.

`test:bonds` checks the redemption yield against cases with known answers (a bond at par yields its
coupon, a discount yields more, a zero-coupon bond is priced purely off the pull to par) and asserts
the *shape* of NSE's undocumented debt feed. It also pins the two refusals that matter: no yield is
quoted inside a year to maturity, where unpublished accrued interest would distort it beyond use, and
an implausible result is withheld rather than shown.

`test:import` covers what happens when the same statement is imported twice. A statement prints a
*balance*, so importing one again has to correct the position rather than add a second copy of it,
and transactions already recorded have to be recognised and skipped. It also asserts that a position
built from a transaction ledger is never overwritten by a stated balance.

`test:ipo` checks the base-rate maths and the verdict rules offline, then asserts the *shape* of both
live sources. The grey market feed is a scraped page: if its columns move, that has to fail loudly
rather than quietly emptying the IPO page. An unreachable source warns instead of failing.

## Deploying

`render.yaml` and `client/vercel.json` are included: the API on Render, the client on Vercel.

- Set `CLIENT_URL` on the API to the exact Vercel origin, no trailing slash — the refresh cookie is `SameSite=None; Secure` in production and will silently fail otherwise
- Set `MARKET_SAMPLE_FALLBACK=false` so a provider outage fails loudly instead of serving simulated prices
- Render generates the JWT secrets; supply `ENCRYPTION_KEY` yourself if you want broker connections
- The server refuses to boot in production with placeholder or matching JWT secrets

## What is deliberately not built

The **admin panel**. User statistics are meaningless for a single-user tool; the parts worth having — provider usage, cache hit rate, fund universe freshness — live on the settings page instead. Nothing in the navigation points at it, rather than offering a link that goes nowhere.

News *was* on this list, on the grounds that it needs a provider key. That turned out to be wrong: Google News RSS carries both markets keylessly, so it was built (feature 17).

---

# Build log

Each feature was built as a vertical slice: schema, API, UI and tests together.

## Feature 1 — Foundation & Design System

What ships in this milestone:

- npm workspace monorepo (`client`, `server`) with a single `npm run dev`
- Tailwind design system: brand tokens, light/dark theming via CSS variables, glass surfaces, type scale, motion presets
- App shell: sticky glass navbar, mobile menu, footer, skip link, scroll restoration
- Reusable primitives: `Button`, `Card`, `Input`, `Badge`, `Delta`, `Skeleton`, `Section`, `ThemeToggle`
- Error handling: React error boundary, query error state, empty state, route-level suspense loader
- Hooks: `useTheme`, `useMediaQuery`, `useDebouncedValue`, `useLocalStorage`, `useLockBodyScroll`, `useDocumentTitle`
- API service layer with axios interceptors, typed envelopes and a typed `ApiError`
- React Query client with retry policy and a central `queryKeys` registry
- Express core: helmet, CORS allowlist, compression, mongo sanitisation, HPP, rate limiters, request logging
- Zod-validated environment config that fails fast on boot
- Central error normaliser (Zod, Mongoose validation, cast, duplicate key) and a consistent JSON envelope
- `GET /api/health` wired end to end and rendered on the home page

## Feature 2 — Authentication

- `User` and `Session` schemas, bcrypt hashing at cost 12, `passwordHash` excluded from queries by default
- Short-lived JWT access tokens (15m) held **in memory only**, never in `localStorage`
- Opaque refresh tokens in an httpOnly cookie, SHA-256 hashed at rest, rotated on every use
- Refresh reuse detection: replaying a spent token revokes the entire session family
- Google Identity Services sign-in with server-side ID token verification, account linking by email
- `requireAuth`, `optionalAuth` and `requireRole` middleware; session revocation checked per request
- Route guards: `ProtectedRoute`, `ProtectedRoute roles={['admin']}`, `GuestOnlyRoute`
- Sign-in and register screens, password strength meter, user menu, auth-aware navbar
- Multi-market account setup: base currency and default market chosen at signup

### Auth endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | Create account, returns access token + sets refresh cookie |
| POST | `/api/auth/login` | — | Email sign-in |
| POST | `/api/auth/google` | — | Exchange a Google ID token for a session |
| POST | `/api/auth/refresh` | cookie | Rotate tokens |
| POST | `/api/auth/logout` | cookie | Revoke the current session |
| GET | `/api/auth/me` | bearer | Current profile |
| PATCH | `/api/auth/me` | bearer | Update name, avatar, preferences |
| POST | `/api/auth/change-password` | bearer | Change password, revokes all sessions |

### Testing auth

```bash
cd server
MONGODB_URI="mongodb+srv://.../investiq_test" npm run test:auth
```

Covers registration, duplicate email, wrong password, token rotation, reuse detection, preference updates and session revocation on logout. It writes to whatever database the URI points at, so use a throwaway one.

## Feature 3 — Market data engine & stock search

The data layer every later feature reads from, plus the search experience on top of it.

- Four provider adapters behind one interface — Financial Modeling Prep, Finnhub, Twelve Data, Alpha Vantage — normalising quotes, profiles, candles and symbol search into a single shape
- Priority chain with automatic failover: each capability walks the configured providers in order and falls through on error, timeout, throttle or empty payload
- A built-in **sample provider** closes the chain, so search, quotes, charts and profiles work before any API key exists. Every response carries a `source`, and the UI labels simulated prices as *Sample data*
- In-memory cache with per-capability TTLs (quote 20s, search 5m, intraday candles 60s, daily candles 30m, profile 12h), in-flight request de-duplication, and stale-on-error fallback
- `StockSymbol` collection seeds a 125-name NSE / BSE / NASDAQ / NYSE universe on boot, records what people look up, and absorbs provider search results so the local index gets better with use
- Command palette (`⌘K` / `Ctrl K`, or `/`) with debounced search, arrow-key navigation, live prices per row, recent searches and popular tickers
- `/search` page: results list with market filters, URL-synced query and selection, quote panel with price, 1D→5Y chart, day and 52-week ranges, volume, market cap (`₹19.10L Cr` in India, `$3.39T` in the US) and the company profile
- Rate limited to 120 requests/minute per IP, separate from the global limiter

Fundamentals ratios (P/E, EPS, ROE, debt, dividend yield) and the full company page land in feature 5.

### Market endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/market/search?q=&limit=` | Symbol search across the local universe and providers |
| GET | `/api/market/quote/:exchange/:symbol` | Single quote |
| GET | `/api/market/quotes?symbols=NSE:TCS,NASDAQ:AAPL` | Up to 25 quotes in one call |
| GET | `/api/market/profile/:exchange/:symbol` | Company profile |
| GET | `/api/market/candles/:exchange/:symbol?range=1M` | OHLCV series — `1D`, `1W`, `1M`, `6M`, `1Y`, `5Y` |
| GET | `/api/market/trending?market=IN&limit=` | Popular tickers, markets interleaved when unfiltered |
| GET | `/api/market/status` | Provider configuration, call counts, failures, cache hit rate |

### Provider keys

Add any subset — the chain uses what is configured and falls back to sample data for the rest.

| Key | Gives you |
| --- | --- |
| `FMP_API_KEY` | Quotes, profiles, candles, search (best coverage, tried first) |
| `FINNHUB_API_KEY` | Quotes, profiles, search |
| `TWELVE_DATA_API_KEY` | Quotes, candles, search (good NSE/BSE coverage) |
| `ALPHA_VANTAGE_API_KEY` | Quotes, profiles, candles, search (BSE only for India) |

Set `MARKET_SAMPLE_FALLBACK=false` in production to make requests fail loudly instead of returning simulated prices.

### Testing market data

```bash
cd server
npm run test:market
```

Runs the full endpoint surface — search ranking, currency per exchange, batch quotes, candle ordering, validation errors, market filters and cache hits — against whichever providers are configured. It works with the database offline.

## Feature 4 — Market overview

The live market surface: `/markets` plus a market section on the home page.

- Index coverage for both markets — NIFTY 50, SENSEX, NIFTY Bank, S&P 500, NASDAQ Composite, Dow Jones — with a scrolling ticker tape that pauses on hover and stops under `prefers-reduced-motion`
- Session clock per exchange computed from real trading hours in the exchange's own timezone: open, pre-open or closed, with the local time and a countdown to the next open or close (holidays are not tracked yet)
- Top gainers, top losers and most active, derived from a 40-name snapshot of each market's popular universe, plus advancing/declining/flat breadth
- Sector performance ranked by average move, with member counts and per-sector leaders
- Batch quoting: providers that support multi-symbol requests (FMP) fetch the whole snapshot in **one** upstream call instead of forty, and the per-symbol cache is populated from the batch
- One `/api/market/overview` call powers the page; it refreshes every 60 seconds and shows when it last updated

### Overview endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/market/overview?market=IN&limit=` | Indices, movers, sectors, breadth, trending and sessions in one call |
| GET | `/api/market/indices?market=` | Index quotes, all markets when unfiltered |
| GET | `/api/market/movers?market=&limit=` | Gainers, losers, most active and breadth |
| GET | `/api/market/sectors?market=` | Average move per sector with leaders and laggards |
| GET | `/api/market/sessions?market=` | Exchange session status and countdowns |

`npm run test:market` covers this surface too — session countdowns, mover ordering, breadth arithmetic, sector ranking and overview caching.

## Feature 5 — Stock detail page

`/stocks/:exchange/:symbol` — the page every search result, mover and trending chip now points at.

- Fundamentals adapter on four providers with the same failover chain: FMP (TTM ratios, key metrics, five years of income statements), Finnhub (`metric=all`), Alpha Vantage (`OVERVIEW`) and the sample generator
- Sample fundamentals are internally consistent rather than random: sector-typical P/E, P/S, margins and ROE drive everything else, so P/B equals P/E × ROE, EPS equals price ÷ P/E and net income equals revenue × net margin. The integration test asserts those identities
- 26 ratios grouped the way an analyst reads them — valuation, profitability, growth and shareholder return, balance sheet and risk — each with a plain-language tooltip that Feature 12 will link to
- Price history across `1D`→`5Y`, day and 52-week range bars showing where the price sits in its band, key statistics, five-year revenue-versus-profit bars, and a company profile with CEO, headquarters, employees and listing date
- One `/api/market/stock/:exchange/:symbol` call fans out to quote, profile, fundamentals and candles in parallel, and degrades field by field — a missing profile or fundamentals never blanks the page

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/market/fundamentals/:exchange/:symbol` | Normalised TTM ratios, financials and five-year history |
| GET | `/api/market/stock/:exchange/:symbol?range=` | Quote, profile, fundamentals, candles and session in one call |

## Feature 6 — AI stock analysis

A full research report on any ticker, generated from verified figures rather than the model's memory.

**How it stays honest.** A deterministic rule engine scores the company first — ten signals (earnings multiple, sales multiple, ROE, net margin, revenue and earnings growth, leverage, liquidity, interest cover, 52-week position) each compared against a sector benchmark, weighted into a 0–100 score across five pillars. Those signals, the raw fundamentals and the sector benchmarks become the FACTS block in the prompt, and the model is told to ground every claim in it and never state a figure that is not there. The score itself is computed in code, never by the model, so it cannot drift.

- OpenAI structured outputs (`json_schema`, strict) fill twelve narrative sections: business summary, strengths, weaknesses, growth potential, financial health, valuation, risks, competitors, short and long term outlook, and who the profile suits
- **Graceful degradation, not fake output.** Without `OPENAI_API_KEY` — or if OpenAI errors, times out or refuses — the same report renders from the rule engine, labelled *Rule engine* rather than passing itself off as AI. Nothing is fabricated to fill the gap
- Reports are cached 24 hours in MongoDB (`AiReport`, TTL index) keyed by a hash of the inputs, plus a 30-minute in-memory layer, so re-opening a page never re-bills. When a key is configured the report is generated on click rather than on page load; without one it renders immediately since it costs nothing
- Sample market data is disclosed in the payload and shown as a banner on the report — an analysis of simulated numbers always says so
- No buy, sell or hold language, no price targets, and a standing disclaimer on every report. The score is framed as research quality, not a recommendation
- Rate limited to 30 reports per hour per IP

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/ai/status` | Whether a model is configured, which one, and what the fallback is |
| GET | `/api/ai/stock/:exchange/:symbol?refresh=true` | Full research report; `refresh` forces regeneration |

### AI configuration

| Variable | Notes |
| --- | --- |
| `OPENAI_API_KEY` | Optional. Absent means rule-engine reports |
| `OPENAI_MODEL` | Defaults to `gpt-4o-mini` |

The provider sits behind one small client (`modules/ai/openai.client.ts`) and a prompt builder, so swapping to another model provider is a single-file change.

## Feature 7 — Portfolio

Holdings across NSE, BSE and US markets, valued in one base currency.

- `Portfolio` and `Holding` schemas, scoped to the signed-in user — every read and write is filtered by `userId`, and a request for someone else's portfolio returns 404, not 403 (no existence leak)
- **FX layer**: a new `fx` capability on FMP, Twelve Data and the sample provider converts every position into the portfolio's base currency, cached for an hour. Each holding reports the rate used, so the conversion is auditable
- Buying more of something you already own averages the cost and keeps the earlier purchase date, rather than creating a second row
- Live valuation: current value, invested, P&L, today's move, weight per holding, and dividend income estimated from each company's reported dividend per share
- Annualised return per holding from its purchase date, and an invested-weighted portfolio figure (labelled as approximate — it is not a money-weighted IRR)
- Allocation by holding, sector, market and exchange; performance chart plotting value against money invested, where each holding only counts from the date it was bought
- Positions with no live quote are excluded from the total and named explicitly, instead of quietly counting as zero

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/portfolio` | Every portfolio with its totals |
| POST | `/api/portfolio` | Create (max 10 per user) |
| GET | `/api/portfolio/:id` | Full valuation, holdings and allocation |
| PATCH / DELETE | `/api/portfolio/:id` | Rename, change base currency, delete |
| POST | `/api/portfolio/:id/holdings` | Add a position (max 100) |
| PATCH / DELETE | `/api/portfolio/:id/holdings/:holdingId` | Edit quantity, cost, date; remove |
| GET | `/api/portfolio/:id/performance?range=` | Value against invested over time |
| GET | `/api/market/fx?base=&quote=` | Exchange rate |

The performance series converts historical prices at today's FX rate — a simplification worth knowing about when a portfolio spans currencies.

## Feature 8 — Importing holdings from Groww and other brokers

Two routes in, because only one of them works for everybody.

### 1. File or paste import (works today, no credentials)

Every Indian broker lets you download holdings as CSV. Plumbline reads them generically rather than hard-coding one layout: it sniffs the delimiter (comma, tab, semicolon, pipe), finds the header row anywhere in the first twelve lines, and maps columns by alias — so `Average buy price`, `Avg cost`, `Buy Average` and `average_price` all land in the same field. Groww, Zerodha Console, Upstox, Angel One, Dhan and ICICI Direct layouts are recognised by signature and named back to you.

- Groww exports company names rather than tickers, so rows are matched by name against the symbol universe and flagged **name match** for you to check — a name match is never treated as certain
- Anything unmatched is shown with suggestions to pick from, or skipped. Nothing is guessed silently
- Quantities and prices parse through `₹`, `$`, thousands separators and bracketed negatives
- Importing the same ticker twice averages the cost, so a re-import top-up behaves correctly

### 2. Direct broker connection (needs your own API key)

There is no universal "connect any app" option in India — the Account Aggregator framework needs an FIU licence, and brokers each expose their own API. So Plumbline ships an adapter per broker, and you supply your own key:

| Broker | What you need | Notes |
| --- | --- | --- |
| Groww | Access token | Profile → Trading APIs on the Groww web app |
| Zerodha | API key + access token | Kite Connect is a paid developer subscription; tokens expire daily |
| Upstox | Access token | Create an app, run the OAuth login once |
| Dhan | Access token | DhanHQ Trading APIs, valid 30 days |

- **Read-only by construction.** Each adapter has exactly one method, `fetchHoldings`, pointed at the broker's holdings endpoint. There is no order-placement code anywhere in the codebase
- Credentials are encrypted with AES-256-GCM before they touch the database, stored in a `select: false` field, and only a masked hint (`supe••••1234`) is ever returned by the API
- A connection is only saved if the credentials actually work — the first fetch runs before anything is written
- Sync maps broker symbols onto the Plumbline universe, then goes through the same import pipeline

Set `ENCRYPTION_KEY` (64 hex characters) in `server/.env` to enable broker connections:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Without it, broker connections are disabled with a clear message and the file import still works.

### Broker sync dropped anything it did not recognise

The first real Groww sync returned two holdings and imported none, reporting only "Nothing to import". Two silent drops were responsible, both in the same line:

```ts
if (!match || holding.avgBuyPrice <= 0) continue;
```

- **Unknown symbols were discarded.** `searchSymbols` only knows the seeded universe plus whatever the configured providers return, so a recently listed stock or an ETF matched nothing and vanished. A holding the broker reports is real whether or not Plumbline has heard of it, so unmatched holdings are now imported under the broker's own symbol and registered in the universe, which also makes them searchable afterwards
- **A zero cost basis discarded the position too.** Some instruments report no average price; that is a missing cost basis, not a missing holding

Sync now reports what happened — fetched, imported, newly discovered, and anything skipped with the reason — instead of failing with one opaque sentence. A regression test replays the exact account that surfaced this (`GROWW` and `SILVERAXIS`, neither in the universe) and asserts both import.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/portfolio/:id/import/preview` | Parse a file or pasted table, match symbols, report issues |
| POST | `/api/portfolio/:id/import/commit` | Import the rows you confirmed |
| GET | `/api/brokers` | Supported brokers, required credentials, setup steps |
| GET/POST | `/api/brokers/connections` | List or create a connection |
| POST | `/api/brokers/connections/:id/sync` | Pull holdings into a portfolio |
| DELETE | `/api/brokers/connections/:id` | Disconnect |

## Feature 9 — Mutual funds

Groww holds stocks and funds together, so Plumbline tracks both in one portfolio.

- **AMFI as the NAV source** — the official daily file at `portal.amfiindia.com/spages/NAVAll.txt`, free and keyless, ingested into a `FundScheme` collection (~14,000 schemes) and refreshed every six hours. Every scheme carries fund house, SEBI category, ISIN, plan, option and the latest NAV
- Holdings now carry an `assetType`: a stock needs `{symbol, exchange}`, a fund needs an AMFI `schemeCode`. Funds are valued at units × NAV in INR, stocks at price × FX
- **Search survives SEBI's renaming.** Broker statements still say "HDFC Mid Cap Opportunities" and "SBI Bluechip" for schemes AMFI now lists as "HDFC Mid Cap Fund" and "SBI Large Cap Fund". Matching anchors on the fund house, gathers candidates across progressively looser queries, and scores on word coverage plus plan/option agreement — so both resolve to the right scheme, and the test suite asserts it
- Groww's mutual fund statement is detected separately from its stock statement (`Scheme Name`, `Units`, `Average NAV` instead of `Stock Name`, `Quantity`, `Average buy price`) and rows resolve against AMFI rather than the equity universe
- Allocation gains a stocks-versus-funds split, and fund categories flow into the sector view alongside equity sectors

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/funds/search?q=&limit=` | Scheme search across the AMFI universe |
| GET | `/api/funds/:schemeCode` | One scheme with its latest NAV |
| GET | `/api/funds/:schemeCode/history?days=` | NAV history (via mfapi.in) |
| GET | `/api/funds/status` | Scheme count, latest NAV date |
| POST | `/api/funds/refresh` | Force an AMFI reload |

Fund holdings hold their current NAV flat across the performance chart — AMFI publishes one NAV per day and the history endpoint is not yet wired into the portfolio series.

## Feature 10 — Transactions, FIFO and XIRR

Averaged cost cannot describe a SIP. This feature adds the ledger underneath the position.

- A `Transaction` collection records every **buy, sell and dividend** with quantity, price, fees and date. Holdings become a projection of the ledger: adding or deleting a transaction replays it and rewrites the position
- **FIFO lot matching**, which is what Indian capital-gains reporting assumes — so realised gains line up with the broker's own tax statement. Selling part of a position consumes the oldest lots, and the cost basis date follows the oldest surviving lot
- **XIRR** (money-weighted return) per holding and per portfolio, solved by Newton-Raphson with a bisection fallback. On a six-month SIP the difference is not cosmetic: one test portfolio reads 21.09% XIRR against 11.74% averaged-cost CAGR
- Portfolio XIRR only counts positions that actually have a ledger — pairing recorded cash flows against the whole portfolio value would produce nonsense (it briefly did, and now a test asserts otherwise)
- Realised gains survive a fully closed position: selling out deletes the holding but the booked gain stays in the totals
- Positions with no ledger keep working exactly as before on average cost, and report no XIRR rather than a fabricated one
- Mutual fund NAV history now feeds the performance chart, so fund holdings trace their real path instead of holding today's NAV flat

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/portfolio/:id/transactions` | The ledger, newest first |
| POST | `/api/portfolio/:id/transactions` | Record a buy, sell or dividend |
| DELETE | `/api/portfolio/:id/transactions/:transactionId` | Remove one and replay the position |

### On the two return figures

`CAGR` annualises the move from average cost over the holding period. `XIRR` solves for the rate that discounts every actual cash flow to zero. For a single purchase they agree — the test suite asserts that. For anything staggered, XIRR is the honest number and is what the UI leads with.

## Feature 11 — Importing a broker ledger

The holdings import loads today's positions. This loads the history that explains them.

- The parser recognises a **ledger export** — a file that names an action per row and dates it — as distinct from a holdings snapshot, and says which it found. Groww order history and Groww fund transaction statements are both detected by name
- Buy/sell/dividend wording is normalised across brokers: `SIP`, `Purchase`, `Invest` and `Switch in` mean BUY; `Redemption`, `Redeem` and `Switch out` mean SELL
- Rows are replayed in date order through the same FIFO engine, so importing a statement rebuilds the position, its cost basis, its realised gains and its XIRR in one step
- Where a statement gives a total instead of a unit price, the unit price is derived from amount ÷ quantity
- Indian `dd-mm-yyyy` dates are read correctly rather than being misread as American ones

### Four bugs this shook out

Each was silent rather than loud, and each has a regression test:

1. **`SIP` and `Purchase` imported as sells.** The transaction-type matcher accepted single-letter broker codes (`s` for sell) as substrings, and both words contain an "s". Single-letter codes now only match exactly
2. **A bare `Price` or `NAV` column never mapped**, because the aliases only covered qualified names like "Average buy price" — so every row in a Groww order export imported with no price. Alias matching also now walks aliases in specificity order, so "average buy price" still wins over a bare "price" when both are present
3. **"ITC Ltd" silently failed to match anything.** After stripping the "Ltd" suffix the needle was three characters and the name matcher required more than three, so every short company name was excluded. Short names now match on a whole-word or ticker basis
4. **`Button` stayed clickable while its own mutation was in flight.** `disabled={disabled ?? loading}` only falls back when `disabled` is null or undefined, so any button passing an explicit `false` ignored `loading` entirely — a double-click on Import imported the whole file twice. Now `disabled || loading`

### Two performance fixes found in the same pass

- Scheme search is cached, so a statement repeating the same fund on every SIP instalment resolves once. A 40-row fund statement went from ~1.5 s to 5 ms
- The AMFI universe only blocks a request when there is nothing to serve. Once loaded, refreshes happen in the background rather than holding the first request after a restart behind a 1.5 MB download — 70 ms instead of roughly ten seconds

## Feature 12 — AI portfolio review

The same grounding discipline as the stock reports, applied to the whole portfolio.

**Computed in code, not by the model:** a diversification score and a health score, each out of 100. Diversification weighs concentration most heavily (34%), then sector spread, position count, asset mix and geography. Health blends diversification with a weight-adjusted quality read on the holdings and the worst drawdown over the charted year. Concentration uses a Herfindahl index over position weights — the test suite recomputes it from the valuation and asserts they agree.

- Six structural signals — concentration, position count, sector spread, asset mix, geography, worst drawdown — each with a verdict and a plain-language reason, shown so the score is auditable rather than a black box
- Every holding is classified on **valuation** (against its sector's earnings benchmark) and **quality** (ROE, net margin and leverage against the same benchmark), surfacing strong positions, weak positions, and the richly and cheaply valued
- **Mutual funds are never called overvalued on a P/E basis.** They are judged on mandate and category, they carry that explanation instead, and a test asserts no fund ever appears in the valuation buckets
- Max drawdown is measured from the actual portfolio value series, including the peak-to-trough duration
- Without `OPENAI_API_KEY` the same review renders from the rule engine, labelled as such. Reports cache for 24 hours keyed by a hash of the weights and scores
- The prompt forbids buy, sell, hold and rebalance instructions and price targets; it explains exposure and trade-offs and leaves the decision to the reader

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/ai/portfolio/:id?refresh=true` | Diversification, health, risks, suggestions and per-position verdicts |

An empty portfolio is refused rather than scored, since there is nothing to diversify.

## Feature 13 — Watchlist and price alerts

Things you are following but have not bought, with alerts that actually check themselves.

- Watch stocks and AMFI funds side by side; each row prices live (NAV for funds) and links through to its stock page
- Three alert types: **rises above**, **falls below**, and **moves by** a daily percentage in either direction
- A scheduler evaluates every active alert every five minutes while the server runs, batching quotes per symbol rather than per alert. `POST /api/watchlist/alerts/evaluate` runs the same check on demand
- **Alerts cool down for 12 hours after firing**, so a price hovering at your level cannot bury you in notifications. The evaluation result reports what fired and what is still cooling down
- Notifications land in a bell in the navbar with an unread badge, and expire after 30 days via a TTL index
- Removing a watchlist entry removes its alerts with it; alerts can also be paused rather than deleted

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/api/watchlist` | List with live prices, or follow something new |
| DELETE | `/api/watchlist/:id` | Stop following, and drop its alerts |
| GET/POST | `/api/watchlist/alerts` | List or create alerts |
| PATCH/DELETE | `/api/watchlist/alerts/:id` | Pause, resume or delete |
| POST | `/api/watchlist/alerts/evaluate` | Check now |
| GET | `/api/notifications` | Notifications with an unread count |
| PATCH | `/api/notifications/:id/read`, `/read-all` | Mark read |

News, earnings and dividend alerts from the original spec are **not** built: they need a news feed and an earnings calendar, and neither exists in the app yet. The `Alert` schema has room for them, but nothing pretends to offer them in the meantime.

## Feature 14 — Compare

Up to four companies side by side, on the fundamentals the app already fetches.

- Twenty-four metrics in six groups — size and price, valuation, profitability, growth, balance sheet and risk, shareholder return — assembled by one `/api/market/compare` call that fans out to quote, profile and fundamentals per company
- **Direction-aware highlighting**: a tick marks the cheapest P/E, the highest ROE, the least levered balance sheet. Rows where every company ties are left unmarked, because a tick on all of them says nothing
- Relative performance chart rebases every line to 100 at the start of the range, so the gap between lines *is* the difference in return
- Currencies stay native — an Indian listing shows ₹ and a US one $, side by side, rather than being force-converted into a single unit that implies a comparison the data does not support
- The table carries its own caveat: a low P/E often reflects a business the market expects to shrink

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/market/compare?symbols=NSE:TCS,NASDAQ:AAPL` | Quote, profile and fundamentals for up to four companies |

Funds are not comparable here — they have no company multiples, and the honest comparison for two funds is category, mandate and cost, which is a different table.

## Feature 15 — Profile and settings

- Display name, base currency, home market, theme and alert preferences, all persisted on the user record
- **Preferences that actually do something.** Base currency pre-selects when you create a portfolio; home market decides which market `/markets` opens on when the URL does not say. Both were claims the settings copy made before the wiring existed, and shipping the copy without the behaviour would have been a lie
- Password change through the existing endpoint, with the consequence stated up front: it revokes every other session
- A **data provenance** panel: which market data provider answered, how many calls each has made, the cache hit rate, the AMFI scheme count and NAV date. Nothing about where a number came from is hidden behind the UI
- The email-alerts toggle is stored but labelled honestly — no mail is sent yet, alerts surface in the notification bell only

The admin panel, screener, news and learn sections from the original spec remain unbuilt. For a single-user private tracker they are close to dead weight: a user-statistics dashboard for one user, a screener for a universe you already own, and static explainers already covered by the metric tooltips on the stock page.

## Feature 16 — Screener and Learn

**Screener.** Filters the tradeable universe on valuation, profitability, growth, debt and yield, with four presets (quality at a fair price, dividend payers, growing fast, near their lows), sortable columns and pagination.

Two things it gets right that a naive version would not:

- **Companies listed on two exchanges appear once.** The universe carries HDFCBANK on both NSE and BSE; a screener lists companies, so the more liquid listing wins and the duplicate is dropped
- **The same company reports the same fundamentals on every listing.** Sample fundamentals were keyed on `EXCHANGE:SYMBOL`, so HDFCBANK showed a P/E of 12.84 on NSE and 19.09 on BSE — the same business with two different valuations. Now keyed on the company

The universe is capped and the whole dataset cached for 15 minutes, because each row needs a fundamentals call. That limit is stated on the page rather than hidden.

**Learn.** Twenty-one explainers covering every metric the app displays — P/E, ROE, net margin, debt to equity, interest coverage, beta, alpha, Sharpe, intrinsic value and DCF, NAV, expense ratio, XIRR, CAGR, FIFO and the rest. Each one carries four things: what it is, how to read it, **where it misleads**, and where it appears in Plumbline.

The section is wired into the app rather than parked beside it: metric labels on the stock detail page link straight to their explainer, so the definition is one click from the number. Entries are honest about what Plumbline does not compute — the Sharpe and alpha pages say so plainly, and the DCF page explains why no "fair value" number is published.

## Feature 17 — Market news

Headlines for both markets, and per company, with sentiment on every story.

- **Google News RSS** carries it, keylessly, for India and the US. Yahoo's search endpoint was tried first and rejected: a query for `RELIANCE.NS` returned stories about Berkshire, Gitlab and Quebec retailers, so it cannot support per-company news
- An RSS parser with no dependency, handling CDATA and entities, and stripping the `" - Publisher"` suffix Google appends to every headline
- Feeds are deduplicated by headline, sorted newest first and cached for ten minutes; the digest for thirty
- A market digest counts the sentiment split across twenty headlines and names the stories moving the tone
- Company news on the stock page queries by company name rather than ticker, which is what actually returns Indian coverage


**A throttled feed is not an empty world.** Google sometimes answers with a valid RSS envelope carrying no items when it is rate limiting. That was surfacing as a hard error and an empty page. An empty response is now kept out of the cache, so the last good feed is served instead; only when there is nothing to fall back on does the page show an empty state, and it says the feed is throttling rather than claiming there is no news.

Diagnosing it was a lesson in not trusting the first theory: the response carries `vary: Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site`, and Node's fetch does force `Sec-Fetch-Mode: cors`, which looked like a convincing cause. Raw `node:https` requests failed identically, and minutes later plain `fetch` returned all hundred headlines. It was throttling all along.

### Sentiment is keyword-scored, and says so

There is no language model behind it, and the UI says that on every chip rather than implying more than it does. Three things make the scoring hold up:

1. **The headline carries double weight.** A summary that happens to mention "gains" should not cancel a headline that says "falls".
2. **"Higher" and "lower" are not in the lexicon.** They take meaning from their subject — *"Sensex falls amid higher oil prices"* is bearish, and counting "higher" as positive scored it neutral. Removing them fixed it.
3. **Numeric moves are matched as patterns.** `down 374 pts` and `ends 374 points lower` are unambiguous in market context where a bare word list misses them.

Each of those came from reading real misclassified headlines in the live feed, not from theory.

### Deleting things takes their data with them

Portfolios and holdings can both be deleted from the portfolio page, each behind a confirmation that states the cost before you commit — how many holdings, how much they are worth, and how many recorded transactions go with them.

That confirmation exists because the first implementation was quietly lossy. Transactions live in their own collection, so deleting a portfolio removed the portfolio and its holdings and **left every transaction orphaned**. Deleting a single holding was worse: the position vanished from the table while its ledger stayed behind, still counting towards realised gains and portfolio XIRR, and the next transaction recorded for that symbol would have resurrected the holding out of nowhere.

Both now delete the ledger with the position and report what they removed. Twelve checks cover it, including that a deleted holding leaves no orphaned transactions and that its realised gains leave the totals with it.

### Broker sync is a snapshot, not a purchase

A sync reports what an account holds *now*. The first implementation pushed each row through the same path as a manual "I bought more", which averages cost and **adds** quantity — so every sync doubled the position. Syncing three times trebled it.

Sync now reconciles instead of accumulating: it *sets* each position, so running it twice leaves the portfolio identical. It touches only rows it owns —

- positions it created are updated in place, and removed when the broker stops reporting them (sold elsewhere)
- **manual holdings are never touched**, tracked by an `origin` field on the holding
- **a position with a transaction ledger is skipped**, because FIFO history is something a snapshot cannot express, and overwriting it would destroy realised gains and XIRR

Eight checks cover it, the sharpest being that syncing the same snapshot twice leaves quantity and cost basis unchanged.

## Feature 18 — Indian fundamentals

Prices for Indian holdings were real; the ratios behind them were simulated. Every free tier refuses Indian fundamentals — FMP charges for NSE, Twelve Data gates India behind its Grow plan, Alpha Vantage returns an empty `{}` for `.BSE` overviews, and Yahoo's `quoteSummary` now demands a crumb it will not issue. NSE's own API sits behind Akamai and answers "Access Denied" to anything that is not a browser.

**BSE's public API answers.** It is keyless, it does not rate limit, and it returns exactly the ratios the reports were missing:

```
RELIANCE  P/E 44.89  P/B 3.36  ROE 7.48  OPM 14.24  NPM 7.99  EPS 28.98  mktcap ₹17.6L Cr
```

- A scrip master of 4,996 active equities is loaded once and held for a day, indexed by ticker and by normalised company name
- **BSE lists nearly everything NSE trades**, so an NSE ticker resolves against it. Where tickers have drifted — Zomato is now Eternal Ltd, Tata Motors demerged — the company name is the fallback, and the seed universe's annotations like `Eternal Ltd (Zomato)` are stripped before matching
**Revenue and debt are not available.** BSE exposes ratios, not statements. Its results endpoint (`StockreachResult/w`) answers "No Record Found" to every parameter shape reconstructible from the public bundle, and deriving revenue from `market cap ÷ P/E ÷ net margin` produced ₹39,222 Cr of profit for Reliance against roughly ₹70,000 Cr consolidated — BSE's P/E is standalone while the market cap is not. Mixing the two bases would mislead, so those fields stay null and render as "—".

- 15 of 15 large caps tested resolve to real data. The provider declares only the `fundamentals` capability and refuses US listings, so it never sits in a chain it cannot serve

### What this changed downstream

The rule engine now scores Indian companies on filed numbers. Reliance reads *weak* on earnings multiple (P/E 44.89 against an Energy benchmark of 12) and on ROE (7.5% against 13%) — a judgement that means something, where before it was arithmetic on invented figures. Indian reports no longer carry the simulated-data banner.

It also exposed a caching flaw worth recording: **AI reports are cached for 24 hours, and a cached report outlived the data source that produced it.** A report written from sample figures was still being served after BSE came online. The data source is now part of the cache key, so a provider upgrade invalidates the old report rather than shadowing it.

## Feature 19 — Mutual fund statements (CAS)

Groww's Trade API only returns stocks, and a Groww CSV only covers funds bought through Groww. The
file that actually solves the problem is the **Consolidated Account Statement** — one PDF from CAMS
or KFintech listing every scheme a person holds across every AMC, whichever app bought the units.

- **Password-protected PDFs are read directly.** `pdfjs-dist` runs headless in Node; the two failure
  modes are separated because they need different fixes from the user — "this file needs a password"
  (`PasswordException` code 1) and "that password was wrong" (code 2)
- **Text is rebuilt into lines before parsing.** pdf.js returns positioned glyph runs, not rows, so
  runs are bucketed by rounded baseline and read left to right. A CAS is a column layout; without this
  step the numbers arrive detached from the scheme they belong to
- **The parser picks its own import mode.** If every scheme opens at zero units the statement is a
  complete history, so it imports as *transactions* — real cost basis, FIFO and XIRR. If any scheme
  carries an opening balance, replaying only the in-range rows would understate the holding, so it
  imports current units and cost as *positions* instead. This is the difference between a correct
  portfolio and a quietly wrong one
- **ISIN beats name matching.** A CAS prints the ISIN beside every scheme, and AMFI's file already
  carries ISINs, so schemes resolve exactly instead of being fuzzy-matched. Stamp duty, STT and TDS
  lines are dropped, reinvestment counts as a purchase, and redemptions in parentheses read as negative

Because ISIN is authoritative, a scheme resolves even when it has since been renamed — so when the
matched name differs materially from the one printed on the statement, the review row says so
("Matched by ISIN — AMFI now lists this scheme as …") rather than silently swapping the fund.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/portfolio/:id/import/statement` | Read a CAS PDF (base64 + password) into an import preview |

The statement rides the existing preview → review → commit pipeline, so every row is still shown for
approval before anything is written. The PDF is parsed in memory and never stored.

**Verified end to end** against a generated CAMS-format statement: wrong password and missing password
each return their own message; a period statement imports 2 positions; a since-inception statement
imports 5 transactions, rebuilds 156.170 units of HDFC Flexi Cap at ₹352.28 average cost, and books
₹1,299 realised on the Axis sale — which is exactly 196.85 × (₹101.60 − ₹95.00) under FIFO.

## Feature 20 — IPOs, grey market premium and base rates

An IPO decision usually gets made on one number — the grey market premium — which is an unofficial
quote from an unregulated market. The interesting question is not what the premium is but what a
premium that size has actually been worth, and that turns out to be answerable.

**Two sources, kept visibly separate.** NSE's public endpoints are the official record: which issues
are open, and how many times each investor category has bid. They are keyless and answer directly.
The premium comes from a public IPO tracker and is labelled as grey market throughout — never
presented as exchange data.

| Source | What it gives |
| --- | --- |
| `nseindia.com/api/all-upcoming-issues`, `/ipo-current-issue` | Open and upcoming issues, price band, total subscription |
| `nseindia.com/api/ipo-active-category` | The live book split by QIB, NII and retail |
| `nseindia.com/api/public-past-issues` | 1,400+ past issues |
| IPO tracker (scraped) | Grey market premium, and an archive of past issues with the premium each showed *and* the price it listed at |

**That archive is what makes the feature worth building.** 275 past issues carry both the premium
they traded at and the price they actually listed at, so the premium can be scored against its own
track record instead of taken at face value:

| GMP band | Issues | Median listing | Listed up |
| --- | --- | --- | --- |
| No premium | 24 | −4.7% | 21% |
| 0–10% | 88 | +3.1% | 66% |
| 10–20% | 55 | +10.7% | 84% |
| 20–35% | 42 | +26.2% | 98% |
| 35–60% | 41 | +37.2% | 100% |
| Over 60% | 25 | +89.4% | 100% |

The grey market pointed the right way 84% of the time but **overstated the gain by about 2 points on
median**, and by 3–5 points through the middle bands. So an issue's premium is shown next to the row
it belongs to, and the verdict is scored on the band's historical median rather than on the quote.

**Where the two disagree, the book wins.** The verdict is deterministic and weighted towards
institutional money, and it will not say "apply" over the top of an undersubscribed QIB portion no
matter how strong the premium — it downgrades to "consider" and says why. On the day this was built,
Pranav Constructions showed a ₹44 premium (35.5%, a band that has listed positive 100 times out of
100) against a QIB book filled only 0.87×, and the page says exactly that rather than picking a side.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/ipo` | Every open, upcoming and recent issue, with premium, subscription and the base-rate table |
| GET | `/api/ipo/:slug` | One issue: the category-wise book, the signals and the verdict |

Both sources are optional at request time. If NSE is unreachable the page still shows the tracker's
issues; if the tracker is unreachable the exchange data stands on its own. Neither failure is allowed
to empty the page, and every panel names where its numbers came from.

## Security and robustness pass

A deliberate audit after the feature work, since the app now holds broker credentials and financial history.

**Fixed**

1. **JWT secrets were the placeholders from `.env.example`** — the same string committed to the repository, so anyone with the repo could forge a token for any account. Harmless on localhost, critical once deployed. Secrets rotated, and the server now **refuses to boot in production** with a placeholder value or with matching access and refresh secrets (a refresh token replayable as an access token). In development it warns instead of exiting
2. **Almost no indexes existed.** Mongoose only builds them when `autoIndex` is on, and that is deliberately off in production — so a deployment would have run with none, including the **TTL indexes that expire sessions, notifications and cached AI reports**. `ensureIndexes()` now builds them explicitly at boot, for every model, in every environment
3. **Duplicate portfolio names were possible**, because the unique index enforcing it had never been built. Creating or renaming a portfolio now returns a clear 409 instead of relying on an index that may not exist
4. **The portfolio report cache was keyed without the user.** Ownership was already proven upstream, but scoping the cache by `userId` too means a future refactor cannot turn it into a cross-account read
5. **Two moderate dependency advisories** (`uuid` via `gaxios`, pulled in by Google sign-in) — patched, `0 vulnerabilities`

**Checked and found sound**

- `.gitignore` covers `server/.env` and `client/.env` while keeping `.env.example` — verified against a throwaway repo rather than assumed
- Every route taking an `:id` scopes its query by the signed-in user; a request for another account's portfolio returns 404, not 403
- Broker credentials never reach a log, an error message or an API response — only a masked hint. Regression tests assert the stored value is ciphertext, that it still decrypts, and that `credentials` is absent from an ordinary read
- Stock AI reports are cached per symbol rather than per user, which is intentional: a report on TCS is public market analysis, not personal data

## Provider coverage in practice

What the free tiers actually serve, measured rather than assumed:

| Provider | US equities | Indian equities (NSE/BSE) | Indices | Notes |
| --- | --- | --- | --- | --- |
| Financial Modeling Prep | yes | **no** — HTTP 402, NSE symbols are a premium parameter | US only | Best US coverage, tried first |
| Twelve Data | yes | **no** — HTTP 404, "available starting with the Grow plan" | — | |
| Yahoo Finance | yes | **yes** | **yes**, including `^NSEI`, `^BSESN`, `^NSEBANK` | Keyless; carries Indian prices |
| BSE India | — | **fundamentals** | — | Keyless; the only free source of Indian ratios |
| Alpha Vantage | yes | BSE only | — | 25 requests/day, rationed by a budget guard and spaced 1.6s apart |
| Sample | — | — | — | Deterministic fallback, always labelled |

**Yahoo is what makes Indian coverage work.** With `YAHOO_ENABLED=false` and only paid-tier keys, every NSE quote falls through to sample data.

### The batch-quote trap

Batch quoting is a real saving on FMP (forty symbols in one call), but it caused a subtle failure: FMP cannot serve NSE, so the batch fell through to the sample provider, which answered for *every* symbol and wrote those simulated prices into the per-symbol cache. Later single-quote requests then hit the cache and never reached Yahoo, which could have priced them.

Batch calls now run with `allowSample: false`. Anything the batch cannot price falls through to per-symbol resolution, which walks the full chain. The chain composition is asserted in the test suite.


### Coverage gaps are not errors

The status page used to report a healthy setup as broken: an NSE quote walks past FMP and Twelve Data, whose free tiers cannot serve India, before Yahoo answers it. Each fall-through incremented a `failures` counter, so a working chain read as "FMP 9 of 10 calls failed".

Provider stats now separate the two. A `402`/`403`/`404` from a provider that does not cover the requested market counts as a **coverage miss** — the chain working as designed. Only timeouts, `5xx`, auth rejections and parse errors count as **failures**. Measured on a live run after three quotes:

| Provider | Calls | Errors | Not covered |
| --- | --- | --- | --- |
| Financial Modeling Prep | 24 | 0 | 12 |
| Twelve Data | 8 | 2 | 2 |
| Yahoo Finance | 36 | 2 | 5 |
| Alpha Vantage | 10 | 4 | 5 |

Settings shows the same split, so "your key is broken" is distinguishable at a glance from "this provider does not cover India".


### Rate limiting is a provider trait, not a global one

Alpha Vantage answers a burst with a 200 body that is not data: *"Please consider spreading out your free API requests more sparingly (1 request per second)."* A daily budget guard does not help, because the problem is spacing rather than volume.

Calls to a rate-limited provider are now serialised and held apart in `upstream.ts`. Four concurrent Alpha Vantage quotes went from one throttle note in four to four real prices. Its own advice of one per second was not quite enough — 1.6s is what actually clears it, which is the sort of thing only measurement tells you.

Every other provider is untouched, so one slow provider never becomes everyone's bottleneck. The suite asserts both halves: spaced calls for the limited provider, no added latency for the rest, using our own health endpoint so the assertion costs nothing from the daily allowance.

## Ports

| Service | Port |
| --- | --- |
| Client | 5273 |
| API | 5050 |

Neither is the framework default: 5000 is taken by macOS AirPlay Receiver, and 5173 by another Vite project on this machine. `CLIENT_URL` in `server/.env` must match the client origin or CORS will block every call.

## Requirements

- Node 20.11 or newer
- A MongoDB Atlas connection string

## Setup

```bash
git clone <your-repo> plumbline
cd plumbline
npm install

cp client/.env.example client/.env
cp server/.env.example server/.env
```

Fill in `server/.env`:

| Variable | Required now | Notes |
| --- | --- | --- |
| `MONGODB_URI` | yes | Atlas connection string |
| `CLIENT_URL` | yes | CORS allowlist, `http://localhost:5273` in dev |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | yes | 32+ characters each, different values |
| `GOOGLE_CLIENT_ID` | optional | Also set `VITE_GOOGLE_CLIENT_ID` in `client/.env` |
| `OPENAI_API_KEY` | feature 6 | |
| `FMP_API_KEY`, `FINNHUB_API_KEY`, `TWELVE_DATA_API_KEY`, `ALPHA_VANTAGE_API_KEY` | optional | Without them the app serves clearly-labelled sample market data |
| `MARKET_SAMPLE_FALLBACK` | optional | `true` by default; set `false` in production |
| `ENCRYPTION_KEY` | optional | 64 hex chars; required for broker connections |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Run

```bash
npm run dev
```

- Client: http://localhost:5273
- API: http://localhost:5050/api/health

Port 5050 rather than 5000 because macOS AirPlay Receiver squats on 5000. In development the API also boots without a database — auth and saved data are disabled, market data still works — so you can explore before setting up Atlas.

Vite proxies `/api` to port 5050, so the client works with or without `VITE_API_URL`.

Other scripts:

```bash
npm run build       # typecheck + bundle client, compile server
npm run typecheck   # both workspaces
```

## API response contract

Every endpoint returns the same envelope. Success:

```json
{ "success": true, "message": "OK", "data": { }, "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 } }
```

Failure:

```json
{ "success": false, "message": "Some fields need attention.", "code": "VALIDATION_ERROR", "details": [{ "field": "email", "message": "Enter a valid email" }] }
```

`http.get<T>()` on the client unwraps `data` for you and throws a typed `ApiError` on failure, so components and hooks only ever see `T`.

## Structure

```
plumbline/
├── client/
│   ├── index.html
│   ├── tailwind.config.ts
│   └── src/
│       ├── components/{ui,layout,feedback,market,search,stock,ai,portfolio,watchlist,compare}/
│       ├── context/          Theme, Auth, Search
│       ├── hooks/
│       ├── lib/              queryClient + queryKeys
│       ├── pages/
│       ├── services/         httpClient + per-domain services
│       ├── styles/
│       ├── types/
│       ├── utils/            cn, formatters
│       ├── router.tsx
│       └── App.tsx
└── server/
    └── src/
        ├── config/           env, logger, database
        ├── data/             seeded symbol universe + index definitions
        ├── middleware/       errorHandler, notFound, rateLimiter, validate
        ├── modules/          feature folders (controller + routes + model + service)
        │   ├── market/       providers/ + cache + symbol universe + market hours
        │   ├── ai/           openai client + stock and portfolio rule engines + prompts + caches
        │   ├── portfolio/    portfolio + holding schemas, valuation engine
        │   ├── import/       delimited parser + broker column mapping
        │   ├── broker/       encrypted credentials + per-broker holdings adapters
        │   ├── funds/        AMFI NAV ingestion + scheme search
        │   └── watchlist/    watched names, price alerts, notifications
        ├── routes/           router composition
        ├── utils/            ApiError, apiResponse, asyncHandler
        ├── app.ts
        └── index.ts
```

Backend code is organised by feature module, not by technical layer, so each new capability lands in one folder.

## Conventions

- Components never call axios directly. They call a hook, the hook calls a service, the service calls `http`.
- Every query key lives in `lib/queryClient.ts`.
- Colours come from CSS variables, never hardcoded hex in components.
- Numeric values carry `data-numeric` so they render in the tabular mono face.
- Route components are lazy loaded and default-exported.
- Access tokens live in a module variable, never in storage. A 401 triggers one silent refresh, retries the original request, and signs the user out if that fails.
- Stocks are always identified as `{ symbol, exchange }`, never a bare ticker — `RELIANCE` exists on both NSE and BSE.
- Market data is never fetched from a provider directly in a service. It goes through `withFailover(capability, …)` so every call is cached, attributed to a source and able to fall through.

## Google sign-in setup

1. Google Cloud Console → APIs & Services → Credentials → OAuth client ID → Web application
2. Authorised JavaScript origins: `http://localhost:5273` and your Vercel domain
3. No redirect URI needed — GIS returns the credential to the page
4. Put the client ID in both `server/.env` (`GOOGLE_CLIENT_ID`) and `client/.env` (`VITE_GOOGLE_CLIENT_ID`)

If `VITE_GOOGLE_CLIENT_ID` is absent the button degrades to a note and email sign-in still works.

## Cross-origin cookies in production

The refresh cookie is `SameSite=None; Secure` in production because the client (Vercel) and API (Render) are different origins. Two things must hold or sign-in will silently fail:

- `CLIENT_URL` on the API exactly matches the deployed client origin, no trailing slash
- The API is served over HTTPS

In development the cookie is `SameSite=Lax` over the Vite proxy, so it works without HTTPS.
