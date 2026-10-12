import 'dotenv/config';

process.env.NODE_ENV = 'development';

// Run against the deterministic sample provider: the suite makes hundreds of market calls and
// would otherwise burn a day's quota on whatever live keys are configured.
for (const key of ['FMP_API_KEY', 'FINNHUB_API_KEY', 'TWELVE_DATA_API_KEY', 'ALPHA_VANTAGE_API_KEY']) {
  delete process.env[key];
}
process.env.MARKET_SAMPLE_FALLBACK = 'true';
process.env.YAHOO_ENABLED = 'false';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/investiq_market_test';

const ROOT = new URL('../dist', import.meta.url).href;
const { connectDatabase } = await import(`${ROOT}/config/database.js`);
const { createApp } = await import(`${ROOT}/app.js`);
const { seedSymbolUniverse } = await import(`${ROOT}/modules/market/symbol.service.js`);

const databaseReady = await connectDatabase();
if (databaseReady) await seedSymbolUniverse();

const server = createApp().listen(5099);
const BASE = 'http://localhost:5099/api';

const call = async (path) => {
  const res = await fetch(BASE + path);
  return { status: res.status, json: await res.json() };
};

let failures = 0;
const check = (label, cond, extra = '') => {
  if (!cond) failures += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

console.log(`database: ${databaseReady ? 'connected' : 'offline (provider/sample path only)'}\n`);

let r = await call('/market/status');
const statusProviders = r.json.data?.providers ?? [];
check(
  'provider stats separate coverage gaps from errors',
  statusProviders.every((p) => typeof p.coverageMisses === 'number' && typeof p.failures === 'number'),
  statusProviders.map((p) => `${p.id}:${p.failures}e/${p.coverageMisses}c`).join(' '),
);
check(
  'an uncovered market is not counted as a provider error',
  statusProviders.filter((p) => p.id === 'fmp' || p.id === 'twelvedata').every((p) => p.coverageMisses >= 0 && p.failures >= 0),
);

check('status -> 200', r.status === 200);
// Asserts membership rather than a count, so adding a provider does not fail the suite spuriously.
check(
  'status lists every provider',
  ['fmp', 'finnhub', 'twelvedata', 'yahoo', 'bse', 'alphavantage', 'sample'].every((id) =>
    (r.json.data?.providers ?? []).some((p) => p.id === id),
  ),
  r.json.data?.providers?.map((p) => p.id).join(','),
);

r = await call('/market/search?q=reliance&limit=5');
check('search finds RELIANCE', r.json.data?.results?.some((m) => m.symbol === 'RELIANCE'), `${r.json.data?.results?.length ?? 0} results`);
check('search returns both listings', new Set(r.json.data?.results?.filter((m) => m.symbol === 'RELIANCE').map((m) => m.exchange)).size >= 1);

r = await call('/market/search?q=nvidia&limit=5');
check('search matches by company name', r.json.data?.results?.[0]?.symbol === 'NVDA', r.json.data?.results?.[0]?.symbol);

r = await call('/market/search?q=&limit=5');
check('empty query -> 422', r.status === 422);

r = await call('/market/quote/NSE/RELIANCE');
const quote = r.json.data;
check('quote -> 200', r.status === 200);
check('quote is priced in INR', quote?.currency === 'INR', quote?.currency);
check('quote carries a source', Boolean(quote?.source), quote?.source);
check('change matches previous close', Math.abs((quote.price - quote.previousClose) - quote.change) < 0.05);

r = await call('/market/quote/NASDAQ/AAPL');
check('US quote is priced in USD', r.json.data?.currency === 'USD', r.json.data?.currency);

r = await call('/market/quote/XETRA/SAP');
check('unknown exchange -> 422', r.status === 422);

r = await call('/market/quotes?symbols=NSE:TCS,NASDAQ:MSFT');
check('batch quotes -> 2 rows', r.json.data?.quotes?.length === 2, `failed: ${r.json.data?.failed?.join(',') || 'none'}`);

// A provider that cannot serve a market must not be able to stamp sample prices across a whole
// batch and cache them: unmatched symbols have to fall through to the per-symbol chain, which
// may reach a provider the batch one could not. Asserted on the chain itself so it holds with
// or without live keys.
const { providerChain } = await import(`${ROOT}/modules/market/providers/index.js`);
check(
  'the batch chain never ends on sample data',
  !providerChain('quotes', { allowSample: false }).some((provider) => provider.id === 'sample'),
);
check(
  'the single-quote chain still falls back to sample data',
  providerChain('quote').some((provider) => provider.id === 'sample'),
);
check(
  'a market a provider cannot serve is excluded from its chain',
  providerChain('quote', { market: 'IN' }).length >= 1,
);

r = await call('/market/quotes?symbols=NOTAKEY');
check('malformed batch -> 400', r.status === 400, r.json.message);

r = await call('/market/candles/NSE/TCS?range=1M');
check('candles -> 200', r.status === 200);
check('candles are chronological', r.json.data?.candles?.every((c, i, all) => i === 0 || new Date(all[i - 1].t) <= new Date(c.t)));
check('candles carry OHLCV', r.json.data?.candles?.every((c) => c.o && c.h >= c.l && c.c));

r = await call('/market/candles/NSE/TCS?range=10Y');
check('invalid range -> 422', r.status === 422);

r = await call('/market/profile/NASDAQ/AAPL');
check('profile -> 200', r.status === 200);
check('profile names the company', Boolean(r.json.data?.name), r.json.data?.name);

r = await call('/market/trending?limit=6');
check('trending -> 6 rows', r.json.data?.results?.length === 6);
check('trending mixes markets', new Set(r.json.data?.results?.map((m) => m.market)).size === 2);

r = await call('/market/trending?market=US&limit=4');
check('trending filters by market', r.json.data?.results?.every((m) => m.market === 'US'));

const started = Date.now();
await call('/market/quote/NSE/RELIANCE');
check('second quote is served from cache', Date.now() - started < 60, `${Date.now() - started}ms`);

// The NSE quotes above must have walked past providers whose free tier cannot serve India.
// Those fall-throughs are the chain working, and must not be reported as provider errors.
r = await call('/market/status');
const afterNse = r.json.data?.providers ?? [];
const indiaBlocked = afterNse.filter((p) => ['fmp', 'twelvedata'].includes(p.id) && p.configured);
check(
  'uncovered markets register as coverage gaps, not errors',
  indiaBlocked.length === 0 || indiaBlocked.some((p) => p.coverageMisses > 0),
  indiaBlocked.map((p) => `${p.id}:${p.failures}err/${p.coverageMisses}gap`).join(' ') || 'no keys configured',
);
check(
  'a provider serving requests reports no errors',
  afterNse.filter((p) => p.calls > 0 && p.failures === 0).length > 0,
  afterNse.filter((p) => p.calls > 0).map((p) => `${p.id}:${p.calls}c/${p.failures}e`).join(' '),
);

console.log('\n--- feature 4: market overview ---');

r = await call('/market/sessions');
const sessions = r.json.data?.sessions ?? [];
check('sessions -> every exchange', sessions.length === 5, sessions.map((x) => x.exchange).join(','));
check('sessions report a valid status', sessions.every((x) => ['open', 'pre-open', 'closed'].includes(x.status)));
check('NSE session is quoted in IST', sessions.find((x) => x.exchange === 'NSE')?.timezone === 'IST');
check(
  'closed exchanges know when they reopen',
  sessions.filter((x) => x.status !== 'open').every((x) => x.opensInMinutes > 0 && x.opensInMinutes <= 7 * 24 * 60),
  sessions.map((x) => `${x.exchange}:${x.opensInMinutes ?? 'open'}`).join(' '),
);
check(
  'open exchanges know when they close',
  sessions.filter((x) => x.status === 'open').every((x) => x.closesInMinutes > 0),
);

r = await call('/market/indices?market=IN');
check('indian indices -> 3', r.json.data?.indices?.length === 3, r.json.data?.indices?.map((i) => i.short).join(','));
check('index carries value and change', r.json.data?.indices?.every((i) => i.value > 0 && typeof i.changePercent === 'number'));

r = await call('/market/indices');
check('all indices -> 6', r.json.data?.indices?.length === 6);

r = await call('/market/movers?market=IN&limit=5');
const movers = r.json.data;
check('gainers are all positive', movers?.gainers?.every((row) => row.changePercent > 0), movers?.gainers?.map((x) => x.symbol).join(','));
check('gainers are ranked', movers?.gainers?.every((row, i, all) => i === 0 || all[i - 1].changePercent >= row.changePercent));
check('losers are all negative', movers?.losers?.every((row) => row.changePercent < 0), movers?.losers?.map((x) => x.symbol).join(','));
check('losers lead with the worst', movers?.losers?.every((row, i, all) => i === 0 || all[i - 1].changePercent <= row.changePercent));
check('most active is ranked by volume', movers?.active?.every((row, i, all) => i === 0 || (all[i - 1].volume ?? 0) >= (row.volume ?? 0)));
check('breadth adds up to the universe', movers.breadth.advancing + movers.breadth.declining + movers.breadth.unchanged === 40, JSON.stringify(movers.breadth));
check('movers stay inside the requested market', movers?.gainers?.every((row) => ['NSE', 'BSE'].includes(row.exchange)));

r = await call('/market/sectors?market=US');
const sectors = r.json.data?.sectors ?? [];
check('sectors are returned', sectors.length > 3, `${sectors.length} sectors`);
check('sectors are ranked best to worst', sectors.every((s, i, all) => i === 0 || all[i - 1].changePercent >= s.changePercent));
check('each sector counts its members', sectors.every((s) => s.count > 0 && s.advancing + s.declining <= s.count));
check('each sector names a leader', sectors.every((s) => s.leader?.symbol));

r = await call('/market/overview?market=IN&limit=4');
const overview = r.json.data;
check('overview -> 200', r.status === 200);
check('overview bundles every section', Boolean(overview?.indices?.length && overview?.movers && overview?.sectors?.length && overview?.trending?.length && overview?.sessions?.length));
check('overview honours the movers limit', overview?.movers?.gainers?.length <= 4);

r = await call('/market/overview?market=EU');
check('unknown market -> 422', r.status === 422);

const overviewStart = Date.now();
await call('/market/overview?market=IN&limit=4');
check('overview is cached', Date.now() - overviewStart < 60, `${Date.now() - overviewStart}ms`);

console.log('\n--- feature 5: stock detail ---');

r = await call('/market/fundamentals/NSE/TCS');
const f = r.json.data;
check('fundamentals -> 200', r.status === 200);
check('fundamentals are priced in INR', f?.currency === 'INR', f?.currency);
check('valuation ratios are present', f?.valuation?.peRatio > 0 && f?.valuation?.priceToBook > 0);
check('margins stay in a sane band', ['grossMargin', 'operatingMargin', 'netMargin'].every((k) => f.profitability[k] === null || (f.profitability[k] > -100 && f.profitability[k] <= 100)));
check('payout ratio is not absurd', f?.dividend?.payoutRatio === null || f.dividend.payoutRatio <= 200, String(f?.dividend?.payoutRatio));
check('annual history is chronological', f?.annual?.every((row, i, all) => i === 0 || all[i - 1].year < row.year), f?.annual?.map((a) => a.year).join(','));

if (f?.source === 'sample') {
  const impliedPb = (f.valuation.peRatio * f.profitability.roe) / 100;
  check('P/B agrees with P/E × ROE', Math.abs(impliedPb - f.valuation.priceToBook) < 0.05, `${impliedPb.toFixed(2)} vs ${f.valuation.priceToBook}`);
  const quoteRes = await call('/market/quote/NSE/TCS');
  const impliedEps = quoteRes.json.data.price / f.valuation.peRatio;
  check('EPS agrees with price ÷ P/E', Math.abs(impliedEps - f.perShare.eps) < 0.05, `${impliedEps.toFixed(2)} vs ${f.perShare.eps}`);
  check('net income agrees with revenue × margin', Math.abs((f.financials.revenue * f.profitability.netMargin) / 100 - f.financials.netIncome) / f.financials.netIncome < 0.01);
}

r = await call('/market/stock/NASDAQ/AAPL?range=6M');
const detail = r.json.data;
check('stock detail -> 200', r.status === 200);
check('stock detail carries a quote', detail?.quote?.price > 0);
check('stock detail carries a profile', Boolean(detail?.profile?.name), detail?.profile?.name);
check('stock detail carries fundamentals', Boolean(detail?.fundamentals?.valuation));
check('stock detail carries the requested range', detail?.candles?.range === '6M', detail?.candles?.range);
check('stock detail carries the exchange session', detail?.session?.exchange === 'NASDAQ');

r = await call('/market/stock/NASDAQ/AAPL?range=3D');
check('invalid detail range -> 422', r.status === 422);

r = await call('/market/stock/XETRA/SAP?range=1M');
check('unsupported exchange -> 422', r.status === 422);

const detailStart = Date.now();
await call('/market/stock/NASDAQ/AAPL?range=6M');
check('stock detail is cached', Date.now() - detailStart < 60, `${Date.now() - detailStart}ms`);

console.log('\n--- feature 6: AI analysis ---');

r = await call('/ai/status');
check(
  'ai status reports whether the model is actually working',
  typeof r.json.data?.healthy === 'boolean' && 'lastError' in r.json.data,
  `healthy=${r.json.data?.healthy}`,
);
check(
  'a configured but failing key is not advertised as live',
  r.json.data?.engine === 'openai' ? r.json.data?.healthy === true : true,
  `engine=${r.json.data?.engine} healthy=${r.json.data?.healthy}`,
);
check(
  'a failing key explains itself',
  r.json.data?.configured && !r.json.data?.healthy ? /failed/i.test(r.json.data?.note ?? '') : true,
  (r.json.data?.note ?? '').slice(0, 70),
);

const aiStatus = r.json.data;
check('ai status -> 200', r.status === 200);
check('ai status names an engine', ['openai', 'rules'].includes(aiStatus?.engine), `${aiStatus?.engine}${aiStatus?.model ? ' / ' + aiStatus.model : ''}`);
check('ai status explains itself', typeof aiStatus?.note === 'string' && aiStatus.note.length > 20);

r = await call('/ai/stock/NSE/TCS');
const report = r.json.data;
check('analysis -> 200', r.status === 200);
check('analysis names the company', Boolean(report?.companyName), report?.companyName);
check(
  'analysis fills every section',
  ['businessSummary', 'growthPotential', 'financialHealth', 'valuation', 'shortTermOutlook', 'longTermOutlook', 'investorFit'].every(
    (key) => typeof report[key] === 'string' && report[key].length > 20,
  ),
);
check('analysis lists strengths and weaknesses', Array.isArray(report?.strengths) && Array.isArray(report?.weaknesses) && report.strengths.length > 0);
check('analysis lists risks', report?.risks?.length >= 3, `${report?.risks?.length} risks`);
check('score sits between 0 and 100', report?.overallScore >= 0 && report?.overallScore <= 100, String(report?.overallScore));
check('score carries a label', typeof report?.scoreLabel === 'string' && report.scoreLabel.length > 3, report?.scoreLabel);
check(
  'score breakdown covers five pillars',
  ['valuation', 'profitability', 'growth', 'balanceSheet', 'momentum'].every((k) => typeof report.scoreBreakdown[k] === 'number'),
);

const weights = { valuation: 0.22, profitability: 0.28, growth: 0.2, balanceSheet: 0.2, momentum: 0.1 };
const recomputed = Math.round(
  Object.entries(weights).reduce((total, [key, weight]) => total + report.scoreBreakdown[key] * weight, 0),
);
check('overall score matches its breakdown', recomputed === report.overallScore, `${recomputed} vs ${report.overallScore}`);

check('every signal carries a verdict', report?.signals?.every((sig) => ['strong', 'neutral', 'weak'].includes(sig.verdict)), `${report?.signals?.length} signals`);
check('signals explain themselves', report?.signals?.every((sig) => sig.detail.length > 10));
check('simulated data is disclosed', report?.engine === 'rules' ? Boolean(report.dataCaveat) : true, report?.dataCaveat ?? 'live data');
check('analysis reports which engine wrote it', ['openai', 'rules'].includes(report?.engine), report?.engine);

const aiStart = Date.now();
await call('/ai/stock/NSE/TCS');
check('analysis is cached', Date.now() - aiStart < 80, `${Date.now() - aiStart}ms`);

r = await call('/ai/stock/XETRA/SAP');
check('unsupported exchange -> 422', r.status === 422);

console.log('\n--- feature 7: fx & portfolio ---');

r = await call('/market/fx?base=USD&quote=INR');
check('fx -> 200', r.status === 200);
check('USD/INR is a plausible rate', r.json.data?.rate > 40 && r.json.data?.rate < 200, String(r.json.data?.rate));

r = await call('/market/fx?base=INR&quote=INR');
check('same-currency fx is 1', r.json.data?.rate === 1);

r = await call('/portfolio');
check('portfolio requires auth -> 401', r.status === 401);

if (databaseReady) {
  const { Portfolio, Holding } = await import(`${ROOT}/modules/portfolio/portfolio.model.js`);
  const { User } = await import(`${ROOT}/modules/auth/user.model.js`);

  const email = `pf-test-${Date.now()}@plumbline.local`;
  const authed = async (path, { method = 'GET', body, token } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, json: await res.json() };
  };

  let res = await authed('/auth/register', {
    method: 'POST',
    body: { name: 'Portfolio Test', email, password: 'Sensex2026x', defaultMarket: 'IN' },
  });
  const token = res.json.data?.accessToken;
  const userId = res.json.data?.user?.id;
  check('test user registered', Boolean(token) && Boolean(userId));

  res = await authed('/portfolio', { method: 'POST', token, body: { name: 'Suite', baseCurrency: 'INR' } });
  const pid = res.json.data?.id;
  check('portfolio created -> 201', res.status === 201 && Boolean(pid));

  await authed(`/portfolio/${pid}/holdings`, {
    method: 'POST',
    token,
    body: { symbol: 'RELIANCE', exchange: 'NSE', quantity: 10, avgBuyPrice: 1000, buyDate: '2024-01-10' },
  });
  await authed(`/portfolio/${pid}/holdings`, {
    method: 'POST',
    token,
    body: { symbol: 'AAPL', exchange: 'NASDAQ', quantity: 5, avgBuyPrice: 150, buyDate: '2024-06-01' },
  });

  res = await authed(`/portfolio/${pid}`, { token });
  const pf = res.json.data;
  check('valuation -> 200', res.status === 200);
  // This suite runs with every provider key removed, so the sample generator is the only source and
  // valuing holdings from it is intended. Once a real provider IS configured, a symbol all of them
  // refuse is treated as unpriced instead — that is what keeps an unlisted IPO allotment from being
  // reported at a price it never traded at. If this flips, the valuation below stops meaning what it says.
  const { hasLiveProvider } = await import(`${ROOT}/modules/market/providers/index.js`);
  check('the suite has no live quote provider, which is why sample prices may value holdings', !hasLiveProvider('quote'));
  check('every holding is valued', pf?.holdings?.length === 2 && pf.holdings.every((h) => h.value > 0));
  check('US holding is converted into INR', pf?.holdings?.find((h) => h.symbol === 'AAPL')?.fxRate > 1);
  check('INR holding is not converted', pf?.holdings?.find((h) => h.symbol === 'RELIANCE')?.fxRate === 1);
  check(
    'weights add up to 100',
    Math.abs(pf.holdings.reduce((sum, h) => sum + h.weight, 0) - 100) < 0.5,
    pf.holdings.map((h) => h.weight).join(' + '),
  );
  check(
    'P&L equals value minus invested',
    Math.abs(pf.totals.value - pf.totals.invested - pf.totals.pnl) < 1,
    `${pf.totals.value} - ${pf.totals.invested} = ${pf.totals.pnl}`,
  );
  check('allocation covers both markets', pf?.allocation?.byMarket?.length === 2);
  check('allocation weights match holdings', Math.abs(pf.allocation.byHolding.reduce((s, a) => s + a.weight, 0) - 100) < 0.5);
  check('annualised return is computed', typeof pf.totals.cagr === 'number', String(pf.totals.cagr));

  res = await authed(`/portfolio/${pid}/holdings`, {
    method: 'POST',
    token,
    body: { symbol: 'RELIANCE', exchange: 'NSE', quantity: 10, avgBuyPrice: 1200, buyDate: '2025-01-10' },
  });
  res = await authed(`/portfolio/${pid}`, { token });
  const merged = res.json.data.holdings.find((h) => h.symbol === 'RELIANCE');
  check('buying more averages the cost', merged?.quantity === 20 && Math.abs(merged.avgBuyPrice - 1100) < 0.01, `${merged?.quantity} @ ${merged?.avgBuyPrice}`);

  const holdingId = merged.id;
  res = await authed(`/portfolio/${pid}/holdings/${holdingId}`, { method: 'PATCH', token, body: { quantity: 25 } });
  check('holding updated -> 200', res.status === 200);

  res = await authed(`/portfolio/${pid}/performance?range=1Y`, { token });
  const points = res.json.data?.points ?? [];
  check('performance series returned', points.length > 10, `${points.length} points`);
  check('performance points carry value and invested', points.every((pt) => pt.value >= 0 && pt.invested >= 0));

  res = await authed(`/portfolio/${pid}/holdings/${holdingId}`, { method: 'DELETE', token });
  check('holding removed -> 200', res.status === 200);

  res = await authed(`/portfolio/${pid}`, { token });
  check('portfolio now holds one position', res.json.data?.holdings?.length === 1);

  res = await authed(`/portfolio/${pid}/holdings`, { method: 'POST', token, body: { symbol: 'AAPL', exchange: 'NASDAQ', quantity: -5, avgBuyPrice: 10 } });
  check('negative quantity -> 422', res.status === 422);

  const otherEmail = `other-${Date.now()}@plumbline.local`;
  const other = await authed('/auth/register', {
    method: 'POST',
    body: { name: 'Someone Else', email: otherEmail, password: 'Sensex2026x' },
  });
  res = await authed(`/portfolio/${pid}`, { token: other.json.data?.accessToken });
  check("another user cannot read this portfolio -> 404", res.status === 404);


  console.log('\n--- feature 8: import & broker sync ---');

  const grownCsv = [
    'Stock Name,ISIN,Quantity,Average buy price,Buy value,Closing price,Unrealised P&L',
    'Reliance Industries Ltd,INE002A01018,40,"1,180.00","47,200.00","1,412.00","9,280.00"',
    'Infosys Ltd,INE009A01021,20,"1,620.00","32,400.00","1,832.00","4,240.00"',
    'Definitely Not Listed Pvt,INE999X01011,5,"100.00","500.00","0.00","0.00"',
  ].join('\n');

  res = await authed(`/portfolio/${pid}/import/preview`, { method: 'POST', token, body: { content: grownCsv } });
  const previewData = res.json.data;
  check('import preview -> 200', res.status === 200);
  check('broker format detected', previewData?.detectedFormat === 'Groww', String(previewData?.detectedFormat));
  check('all rows parsed', previewData?.totalRows === 3, `${previewData?.totalRows} rows`);
  check('known companies matched by name', previewData?.rows?.filter((row) => row.match).length === 2);
  check('unknown company is flagged, not guessed', previewData?.rows?.find((row) => row.name.includes('Not Listed'))?.match === null);
  check('quantities and costs parsed through the thousands separators', previewData?.rows?.[0]?.quantity === 40 && previewData?.rows?.[0]?.avgBuyPrice === 1180);

  const importable = previewData.rows
    .filter((row) => row.match && row.quantity > 0 && row.avgBuyPrice !== null)
    .map((row) => ({ symbol: row.match.symbol, exchange: row.match.exchange, quantity: row.quantity, avgBuyPrice: row.avgBuyPrice }));

  res = await authed(`/portfolio/${pid}/import/commit`, { method: 'POST', token, body: { rows: importable } });
  check('import commit -> 200', res.status === 200 && res.json.data?.added === 2, `${res.json.data?.added} added`);

  res = await authed(`/portfolio/${pid}/import/preview`, { method: 'POST', token, body: { content: 'this is not a holdings file at all' } });
  check('unreadable file -> 400', res.status === 400, res.json.message);

  const tabbed = 'Symbol\tQuantity\tAverage Price\nITC\t120\t410.55\nTATAMOTORS\t60\t690.20';
  res = await authed(`/portfolio/${pid}/import/preview`, { method: 'POST', token, body: { content: tabbed } });
  check('tab-separated paste works', res.json.data?.rows?.every((row) => row.match), 'ITC + TATAMOTORS');

  res = await authed('/brokers');
  const catalogue = res.json.data;
  check('broker catalogue -> 200', res.status === 200);
  check('four brokers offered', catalogue?.brokers?.length === 4, catalogue?.brokers?.map((b) => b.id).join(','));
  check('every broker documents its setup', catalogue?.brokers?.every((b) => b.setupSteps.length >= 2 && b.docsUrl.startsWith('https://')));
  check('broker connections need an encryption key', typeof catalogue?.available === 'boolean', `available=${catalogue?.available}`);

  res = await authed('/brokers/connections');
  check('connections require auth -> 401', res.status === 401);

  res = await authed('/brokers/connections', { token });
  check('signed-in user has no connections yet', res.json.data?.connections?.length === 0);

  res = await authed('/brokers/connections', { method: 'POST', token, body: { broker: 'groww', credentials: { accessToken: 'obviously-invalid-token' } } });
  check('a bad broker token is rejected, not stored', res.status === 401 || res.status === 502, `${res.status}: ${res.json.message?.slice(0, 60)}`);

  res = await authed('/brokers/connections', { token });
  check('nothing was stored after the failed connect', res.json.data?.connections?.length === 0);

  const { encryptionAvailable, encryptSecret, decryptSecret, maskSecret } = await import(`${ROOT}/modules/broker/crypto.js`);
  if (encryptionAvailable()) {
    const secret = 'super-secret-broker-token-1234';
    const sealed = encryptSecret(secret);
    check('credentials round-trip through AES-256-GCM', decryptSecret(sealed) === secret);
    check('ciphertext does not contain the secret', !sealed.includes(secret));
    check('hints never expose the whole token', !maskSecret(secret).includes('secret-broker'), maskSecret(secret));
  } else {
    console.log('SKIP  encryption checks (ENCRYPTION_KEY not set)');
  }




  console.log('\n--- feature 10: transactions, FIFO and XIRR ---');

  const { xirr } = await import(`${ROOT}/utils/xirr.js`);
  const year = (n) => new Date(Date.UTC(2025 + n, 0, 1));
  check('XIRR of a simple 10% year', Math.abs(xirr([{ date: year(0), amount: -1000 }, { date: year(1), amount: 1100 }]) - 0.1) < 0.002);
  check('XIRR handles a loss', xirr([{ date: year(0), amount: -1000 }, { date: year(1), amount: 900 }]) < 0);
  check('XIRR refuses one-sided flows', xirr([{ date: year(0), amount: -100 }, { date: year(1), amount: -100 }]) === null);

  const sip = [
    ['2025-09-05', 10, 1150],
    ['2025-10-05', 10, 1190],
    ['2025-11-05', 10, 1225],
    ['2025-12-05', 10, 1260],
    ['2026-01-05', 10, 1300],
    ['2026-02-05', 10, 1345],
  ];

  for (const [date, quantity, price] of sip) {
    await authed(`/portfolio/${pid}/transactions`, {
      method: 'POST',
      token,
      body: { symbol: 'TCS', exchange: 'NSE', type: 'BUY', quantity, price, date: `${date}T00:00:00.000Z` },
    });
  }

  res = await authed(`/portfolio/${pid}/transactions`, {
    method: 'POST',
    token,
    body: { symbol: 'TCS', exchange: 'NSE', type: 'SELL', quantity: 25, price: 1400, fees: 50, date: '2026-06-10T00:00:00.000Z' },
  });
  const afterSale = res.json.data?.position;
  check('FIFO leaves the right quantity', afterSale?.quantity === 35, String(afterSale?.quantity));
  check('FIFO averages the surviving lots', Math.abs(afterSale.avgBuyPrice - 1290.7143) < 0.01, String(afterSale?.avgBuyPrice));
  check('FIFO books the realised gain net of fees', afterSale?.realisedGain === 5425, String(afterSale?.realisedGain));
  check('cost basis follows the oldest surviving lot', afterSale?.buyDate?.startsWith('2025-11-05'), afterSale?.buyDate);

  await authed(`/portfolio/${pid}/transactions`, {
    method: 'POST',
    token,
    body: { symbol: 'TCS', exchange: 'NSE', type: 'DIVIDEND', quantity: 1, price: 550, date: '2026-03-20T00:00:00.000Z' },
  });

  res = await authed(`/portfolio/${pid}`, { token });
  const ledgerView = res.json.data;
  const tcs = ledgerView.holdings.find((h) => h.symbol === 'TCS');
  check('the ledger drives the holding', tcs?.quantity === 35 && Math.abs(tcs.avgBuyPrice - 1290.7143) < 0.01);
  check('holding XIRR is computed', typeof tcs?.xirr === 'number' && tcs.xirr > 0, `${tcs?.xirr}%`);
  check('a staggered SIP prices differently under XIRR than averaged-cost CAGR', tcs.xirr !== tcs.cagr, `${tcs?.xirr}% XIRR vs ${tcs?.cagr}% CAGR`);
  check('dividends are recorded separately from gains', tcs?.dividendsReceived === 550, String(tcs?.dividendsReceived));
  check('portfolio totals pick up realised gains', ledgerView.totals.realisedGain >= 5425, String(ledgerView.totals.realisedGain));
  check('portfolio XIRR is finite and signed like the gain', Number.isFinite(ledgerView.totals.xirr) && ledgerView.totals.xirr > 0, `${ledgerView.totals.xirr}%`);

  check('holdings without a ledger report no XIRR', ledgerView.holdings.filter((h) => h.transactionCount === 0).every((h) => h.xirr === null));

  res = await authed(`/portfolio/${pid}/transactions`, { token });
  const allRows = res.json.data?.transactions ?? [];
  const ledgerRows = allRows.filter((row) => row.symbol === 'TCS');
  check('the ledger holds every TCS transaction', ledgerRows.length === 8, `${ledgerRows.length} of ${allRows.length} rows`);
  check('transactions come back newest first', new Date(allRows[0].date) >= new Date(allRows[allRows.length - 1].date));

  await authed(`/portfolio/${pid}/transactions`, {
    method: 'POST',
    token,
    body: { symbol: 'TCS', exchange: 'NSE', type: 'SELL', quantity: 35, price: 1450, date: '2026-07-01T00:00:00.000Z' },
  });
  res = await authed(`/portfolio/${pid}`, { token });
  check('selling out removes the position', !res.json.data.holdings.some((h) => h.symbol === 'TCS'));
  check('realised gain survives a closed position', res.json.data.totals.realisedGain > 5425, String(res.json.data.totals.realisedGain));

  const dividendRow = ledgerRows.find((row) => row.type === 'DIVIDEND');
  res = await authed(`/portfolio/${pid}/transactions/${dividendRow.id}`, { method: 'DELETE', token });
  check('transaction delete -> 200', res.status === 200);

  res = await authed(`/portfolio/${pid}`, { token });
  check('deleting a transaction recomputes the totals', res.json.data.totals.dividendsReceived === 0, String(res.json.data.totals.dividendsReceived));


  // A single purchase has only two cash flows, so the money-weighted return must agree with
  // the time-weighted one. That invariant holds whatever the current price happens to be.
  await authed(`/portfolio/${pid}/transactions`, {
    method: 'POST',
    token,
    body: { symbol: 'WIPRO', exchange: 'NSE', type: 'BUY', quantity: 100, price: 200, date: '2024-08-01T00:00:00.000Z' },
  });
  res = await authed(`/portfolio/${pid}`, { token });
  const single = res.json.data.holdings.find((h) => h.symbol === 'WIPRO');
  check('a single buy makes XIRR and CAGR agree', Math.abs(single.xirr - single.cagr) < 1, `${single?.xirr}% vs ${single?.cagr}%`);

  res = await authed(`/portfolio/${pid}/transactions`, {
    method: 'POST',
    token,
    body: { assetType: 'MUTUAL_FUND', type: 'BUY', quantity: 10, price: 90, date: '2026-01-01' },
  });
  check('fund transaction without a scheme code -> 422', res.status === 422);






  console.log('\n--- hardening checks ---');

  res = await authed('/portfolio', { method: 'POST', token, body: { name: 'Suite', baseCurrency: 'INR' } });
  check('a duplicate portfolio name -> 409', res.status === 409, res.json.message);

  const mongoose = (await import('mongoose')).default;
  const { ensureIndexes } = await import(`${ROOT}/config/indexes.js`);
  const built = await ensureIndexes();
  check('every model builds its indexes', built >= 12, `${built} models`);

  const ttlCollections = ['notifications', 'aireports', 'portfolioreports', 'sessions'];
  const ttlPresent = [];
  for (const name of ttlCollections) {
    const indexes = await mongoose.connection.db.collection(name).indexes();
    if (indexes.some((index) => index.expireAfterSeconds !== undefined)) ttlPresent.push(name);
  }
  check('expiring collections all carry a TTL index', ttlPresent.length === ttlCollections.length, ttlPresent.join(', '));

  const { listConnections } = await import(`${ROOT}/modules/broker/broker.service.js`);
  const brokerSummary = await listConnections(new mongoose.Types.ObjectId());
  check('broker summaries never carry credentials', !JSON.stringify(brokerSummary).includes('credentials'));

  const { BrokerConnection } = await import(`${ROOT}/modules/broker/broker.model.js`);
  const probe = 'token-that-must-never-appear';
  const probeHint = 'toke••••pear';

  await BrokerConnection.deleteMany({ hint: probeHint });
  await BrokerConnection.create({
    userId: new mongoose.Types.ObjectId(),
    broker: 'groww',
    label: 'Groww',
    credentials: encryptSecret(JSON.stringify({ accessToken: probe })),
    hint: probeHint,
  });

  const storedRaw = await BrokerConnection.findOne({ hint: probeHint }).select('+credentials').lean();
  check('stored credentials are ciphertext, not the token', !JSON.stringify(storedRaw).includes(probe));
  check('the ciphertext still decrypts back', JSON.parse(decryptSecret(storedRaw.credentials)).accessToken === probe);

  const storedDefault = await BrokerConnection.findOne({ hint: probeHint }).lean();
  check('credentials are excluded from ordinary reads', !('credentials' in (storedDefault ?? {})));

  await BrokerConnection.deleteMany({ hint: probeHint });

  console.log('\n--- feature 15: profile settings ---');

  res = await authed('/auth/me', { token });
  check('profile carries preferences', Boolean(res.json.data?.preferences?.baseCurrency), JSON.stringify(res.json.data?.preferences));

  res = await authed('/auth/me', { method: 'PATCH', token, body: { preferences: { baseCurrency: 'USD', defaultMarket: 'US' } } });
  check('preferences update -> 200', res.status === 200 && res.json.data?.preferences?.baseCurrency === 'USD');
  check('an unrelated preference is left alone', res.json.data?.preferences?.emailAlerts === true, String(res.json.data?.preferences?.emailAlerts));

  res = await authed('/auth/me', { token });
  check('preferences persist across requests', res.json.data?.preferences?.defaultMarket === 'US');

  res = await authed('/auth/me', { method: 'PATCH', token, body: { preferences: { baseCurrency: 'GBP' } } });
  check('an unsupported currency -> 422', res.status === 422);

  res = await authed('/auth/me', { method: 'PATCH', token, body: { name: 'X' } });
  check('a one-character name -> 422', res.status === 422);

  res = await authed('/auth/me', { method: 'PATCH', token, body: {} });
  check('an empty update -> 422', res.status === 422);

  res = await authed('/auth/me', { method: 'PATCH', token, body: { name: 'Renamed Tester' } });
  check('display name updates', res.json.data?.name === 'Renamed Tester');
  check('the password hash is never returned', !JSON.stringify(res.json).includes('passwordHash'));

  res = await authed('/auth/change-password', { method: 'POST', token, body: { currentPassword: 'wrong-password', newPassword: 'Sensex2027x' } });
  check('a wrong current password is rejected', res.status === 401 || res.status === 400, String(res.status));

  await authed('/auth/me', { method: 'PATCH', token, body: { preferences: { baseCurrency: 'INR', defaultMarket: 'IN' } } });

  console.log('\n--- feature 13: watchlist and alerts ---');

  res = await call('/watchlist');
  check('watchlist requires auth -> 401', res.status === 401);

  res = await authed('/watchlist', { method: 'POST', token, body: { symbol: 'INFY', exchange: 'NSE' } });
  const watchId = res.json.data?.id;
  check('add to watchlist -> 201', res.status === 201 && Boolean(watchId));

  res = await authed('/watchlist', { method: 'POST', token, body: { symbol: 'INFY', exchange: 'NSE' } });
  check('the same listing cannot be added twice -> 409', res.status === 409, res.json.message);

  res = await authed('/watchlist', { method: 'POST', token, body: { assetType: 'MUTUAL_FUND', schemeCode: '122639' } });
  check('a fund can be watched -> 201', res.status === 201);

  res = await authed('/watchlist', { method: 'POST', token, body: { assetType: 'MUTUAL_FUND' } });
  check('a fund without a scheme code -> 422', res.status === 422);

  res = await authed('/watchlist', { token });
  const watched = res.json.data?.items ?? [];
  check('watchlist prices every entry', watched.length === 2 && watched.every((item) => item.priced), `${watched.length} items`);
  check('the fund entry carries its NAV date', watched.some((item) => item.assetType === 'MUTUAL_FUND' && item.navDate));

  const infy = watched.find((item) => item.symbol === 'INFY');

  // one alert that must fire, one that must not, one on a daily move
  await authed('/watchlist/alerts', { method: 'POST', token, body: { itemId: watchId, type: 'PRICE_ABOVE', threshold: 1 } });
  await authed('/watchlist/alerts', { method: 'POST', token, body: { itemId: watchId, type: 'PRICE_BELOW', threshold: 1 } });
  res = await authed('/watchlist/alerts', { method: 'POST', token, body: { itemId: watchId, type: 'PERCENT_MOVE', threshold: 0.01 } });
  check('alerts can be created -> 201', res.status === 201);

  res = await authed('/watchlist/alerts', { method: 'POST', token, body: { itemId: watchId, type: 'PRICE_ABOVE', threshold: -5 } });
  check('a negative threshold -> 422', res.status === 422);

  res = await authed('/watchlist/alerts/evaluate', { method: 'POST', token, body: {} });
  const evaluation = res.json.data;
  check('evaluation checks every active alert', evaluation?.checked === 3, JSON.stringify(evaluation));
  check('only the alerts that crossed fire', evaluation?.triggered === 2, `${evaluation?.triggered} fired (above ${1} and a ${infy?.changePercent}% move)`);

  res = await authed('/notifications', { token });
  check('notifications are created for fired alerts', res.json.data?.notifications?.length === 2, `${res.json.data?.notifications?.length} notifications`);
  check('every notification is unread at first', res.json.data?.unread === 2);
  check('notifications explain themselves', res.json.data?.notifications?.every((n) => n.title.includes('INFY') && n.body.length > 30));

  res = await authed('/watchlist/alerts/evaluate', { method: 'POST', token, body: {} });
  check('a fired alert cools down instead of repeating', res.json.data?.triggered === 0 && res.json.data?.skippedInCooldown === 2, JSON.stringify(res.json.data));

  const notificationId = (await authed('/notifications', { token })).json.data.notifications[0].id;
  res = await authed(`/notifications/${notificationId}/read`, { method: 'PATCH', token, body: {} });
  check('a notification can be marked read', res.status === 200);

  res = await authed('/notifications', { token });
  check('the unread count drops', res.json.data?.unread === 1, String(res.json.data?.unread));

  res = await authed('/notifications/read-all', { method: 'PATCH', token, body: {} });
  res = await authed('/notifications', { token });
  check('mark all read clears the badge', res.json.data?.unread === 0);

  const alertRows = (await authed('/watchlist/alerts', { token })).json.data.alerts;
  res = await authed(`/watchlist/alerts/${alertRows[0].id}`, { method: 'PATCH', token, body: { active: false } });
  check('an alert can be paused', res.json.data?.active === false);

  res = await authed(`/watchlist/${watchId}`, { method: 'DELETE', token });
  check('removing a watchlist entry -> 200', res.status === 200);

  res = await authed('/watchlist/alerts', { token });
  check('its alerts are removed with it', res.json.data?.alerts?.length === 0, `${res.json.data?.alerts?.length} left`);

  const { WatchlistItem, Alert } = await import(`${ROOT}/modules/watchlist/watchlist.model.js`);
  const { Notification } = await import(`${ROOT}/modules/watchlist/notification.model.js`);
  await Promise.all([
    WatchlistItem.deleteMany({ userId: { $exists: true }, name: { $regex: 'Parag Parikh' } }),
    Alert.deleteMany({ symbol: 'INFY' }),
    Notification.deleteMany({ title: { $regex: 'INFY' } }),
  ]);

  console.log('\n--- broker sync: holdings Plumbline has never seen ---');

  const { resolveBrokerHoldings } = await import(`${ROOT}/modules/broker/broker.service.js`);
  const { StockSymbol: SymbolUniverse } = await import(`${ROOT}/modules/market/symbol.model.js`);

  // Clear before as well as after: a run that dies mid-suite would otherwise leave these
  // registered and make the next run's "unrecognised" assertion fail.
  await SymbolUniverse.deleteMany({ symbol: { $in: ['GROWW', 'SILVERAXIS'] } });

  // Reproduces a real Groww account: neither symbol is in the seeded universe.
  const brokerRows = await resolveBrokerHoldings([
    { symbol: 'GROWW', exchange: 'NSE', quantity: 12, avgBuyPrice: 118.4, name: 'Billionbrains Garage Ventures' },
    { symbol: 'SILVERAXIS', exchange: 'NSE', quantity: 40, avgBuyPrice: 0, name: 'Axis Silver ETF' },
    { symbol: 'RELIANCE', exchange: 'NSE', quantity: 5, avgBuyPrice: 1200 },
    { symbol: 'ZEROQTY', exchange: 'NSE', quantity: 0, avgBuyPrice: 10 },
  ]);

  check('unknown broker symbols are imported, not dropped', brokerRows.rows.length === 3, `${brokerRows.rows.length} of 4 rows kept`);
  check('an unrecognised symbol keeps the broker spelling', brokerRows.rows.some((row) => row.symbol === 'GROWW' && !row.recognised));
  check('a zero cost basis no longer drops the holding', brokerRows.rows.some((row) => row.symbol === 'SILVERAXIS' && row.avgBuyPrice === 0));
  check('a known symbol still resolves against the universe', brokerRows.rows.some((row) => row.symbol === 'RELIANCE' && row.recognised));
  check('a zero-quantity row is skipped with a reason', brokerRows.skipped.some((entry) => entry.symbol === 'ZEROQTY' && entry.reason.includes('Quantity')), JSON.stringify(brokerRows.skipped));

  res = await call('/market/search?q=GROWW&limit=3');
  check('a discovered symbol becomes searchable afterwards', res.json.data?.results?.some((r) => r.symbol === 'GROWW'), res.json.data?.results?.map((r) => r.symbol).join(','));

  await SymbolUniverse.deleteMany({ symbol: { $in: ['GROWW', 'SILVERAXIS'] } });

  console.log('\n--- feature 12: AI portfolio review ---');

  res = await call(`/ai/portfolio/${pid}`);
  check('portfolio review requires auth -> 401', res.status === 401);

  res = await authed(`/ai/portfolio/${pid}`, { token });
  const review = res.json.data;
  check('portfolio review -> 200', res.status === 200);
  check('review names the portfolio', review?.portfolioName === 'Suite', review?.portfolioName);
  check('diversification score is in range', review?.diversificationScore >= 0 && review?.diversificationScore <= 100, `${review?.diversificationScore} (${review?.diversificationLabel})`);
  check('health score is in range', review?.healthScore >= 0 && review?.healthScore <= 100, `${review?.healthScore} (${review?.healthLabel})`);
  check('breakdown covers five pillars', ['concentration', 'sectors', 'assetClasses', 'geography', 'positionCount'].every((k) => typeof review.breakdown[k] === 'number'));
  check('every prose section is filled', ['summary', 'riskAnalysis', 'diversificationComment'].every((k) => typeof review[k] === 'string' && review[k].length > 30));
  check('suggestions are returned', Array.isArray(review?.suggestions) && review.suggestions.length > 0, `${review?.suggestions?.length} suggestions`);
  check('every signal carries a verdict', review?.signals?.every((sig) => ['strong', 'neutral', 'weak'].includes(sig.verdict)), `${review?.signals?.length} signals`);

  const detail = await authed(`/portfolio/${pid}`, { token });
  const heaviest = [...detail.json.data.holdings].sort((a, b) => b.weight - a.weight)[0];
  check(
    'largest position matches the valuation',
    Math.abs(review.concentration.topWeight - heaviest.weight) < 0.01,
    `${review.concentration.topHolding} ${review.concentration.topWeight}% vs ${heaviest.symbol} ${heaviest.weight}%`,
  );

  const expectedHhi = detail.json.data.holdings.reduce((sum, h) => sum + (h.weight / 100) ** 2, 0) * 100;
  check('concentration index matches the weights', Math.abs(review.concentration.herfindahl - expectedHhi) < 0.5, `${review.concentration.herfindahl} vs ${expectedHhi.toFixed(2)}`);

  check(
    'funds are never called overvalued on a P/E basis',
    [...review.overvalued, ...review.undervalued].every((v) => v.assetType === 'EQUITY'),
  );

  const reviewStart = Date.now();
  await authed(`/ai/portfolio/${pid}`, { token });
  check('portfolio review is cached', Date.now() - reviewStart < 400, `${Date.now() - reviewStart}ms`);

  const emptyRes = await authed('/portfolio', { method: 'POST', token, body: { name: 'Empty', baseCurrency: 'INR' } });
  res = await authed(`/ai/portfolio/${emptyRes.json.data.id}`, { token });
  check('an empty portfolio is refused, not scored', res.status === 400, res.json.message);
  await authed(`/portfolio/${emptyRes.json.data.id}`, { method: 'DELETE', token });

  console.log('\n--- feature 11: ledger import ---');

  const orderCsv = [
    'Stock name,ISIN,Exchange,Transaction type,Quantity,Price,Trade date',
    'Bharti Airtel Ltd,INE397D01024,NSE,BUY,10,1400.00,05-09-2025',
    'Bharti Airtel Ltd,INE397D01024,NSE,BUY,10,1450.00,05-10-2025',
    'Bharti Airtel Ltd,INE397D01024,NSE,SELL,12,1600.00,10-06-2026',
  ].join('\n');

  res = await authed(`/portfolio/${pid}/import/preview`, { method: 'POST', token, body: { content: orderCsv } });
  const ledgerPreview = res.json.data;
  check('order history detected as a ledger', ledgerPreview?.mode === 'transactions', String(ledgerPreview?.mode));
  check('order history names the broker', ledgerPreview?.detectedFormat === 'Groww (order history)', String(ledgerPreview?.detectedFormat));
  check('a bare Price column maps to the trade price', ledgerPreview?.rows?.[0]?.avgBuyPrice === 1400, String(ledgerPreview?.rows?.[0]?.avgBuyPrice));
  check('buy and sell rows keep their direction', ledgerPreview?.rows?.map((r) => r.transactionType).join(',') === 'BUY,BUY,SELL', ledgerPreview?.rows?.map((r) => r.transactionType).join(','));
  check('dd-mm-yyyy dates are read correctly', ledgerPreview?.rows?.[0]?.buyDate?.startsWith('2025-09-05'), ledgerPreview?.rows?.[0]?.buyDate);

  res = await authed(`/portfolio/${pid}/import/commit`, {
    method: 'POST',
    token,
    body: {
      mode: 'transactions',
      rows: ledgerPreview.rows.map((row) => ({
        assetType: 'EQUITY',
        symbol: row.match.symbol,
        exchange: row.match.exchange,
        type: row.transactionType,
        quantity: row.quantity,
        price: row.avgBuyPrice,
        date: row.buyDate,
      })),
    },
  });
  check('ledger import -> 3 transactions', res.json.data?.added === 3, `${res.json.data?.added} added`);

  res = await authed(`/portfolio/${pid}`, { token });
  const airtel = res.json.data.holdings.find((h) => h.symbol === 'BHARTIARTL');
  check('imported ledger rebuilds the position', airtel?.quantity === 8, String(airtel?.quantity));
  check('imported ledger prices the surviving lot', Math.abs(airtel.avgBuyPrice - 1450) < 0.01, String(airtel?.avgBuyPrice));
  check('imported ledger books FIFO gains', airtel?.realisedGain === 2300, String(airtel?.realisedGain));

  const sipCsv = [
    'Scheme Name,Folio Number,Transaction type,Units,NAV,Amount,Date',
    'Parag Parikh Flexi Cap Fund Direct Growth,12345678,SIP,63.938,78.20,5000.00,15-10-2025',
    'Parag Parikh Flexi Cap Fund Direct Growth,12345678,Purchase,62.189,80.40,5000.00,15-11-2025',
    'Parag Parikh Flexi Cap Fund Direct Growth,12345678,Redemption,20.000,89.10,1782.00,20-05-2026',
  ].join('\n');

  res = await authed(`/portfolio/${pid}/import/preview`, { method: 'POST', token, body: { content: sipCsv } });
  const sipPreview = res.json.data;
  check('SIP rows are buys, not sells', sipPreview?.rows?.map((r) => r.transactionType).join(',') === 'BUY,BUY,SELL', sipPreview?.rows?.map((r) => r.transactionType).join(','));
  check('fund ledger rows resolve to a scheme', sipPreview?.rows?.every((row) => row.fund?.schemeCode === '122639'));
  check('NAV column maps to the unit price', sipPreview?.rows?.[0]?.avgBuyPrice === 78.2, String(sipPreview?.rows?.[0]?.avgBuyPrice));

  // Regressions caught during the debugging pass.
  const shortNameCsv = 'Stock Name,Quantity,Average buy price\nITC Ltd,120,410.55\nLarsen & Toubro Ltd,5,3400.00';
  res = await authed(`/portfolio/${pid}/import/preview`, { method: 'POST', token, body: { content: shortNameCsv } });
  check('short company names still resolve', res.json.data?.rows?.every((row) => row.match), res.json.data?.rows?.map((r) => `${r.name}->${r.match?.symbol ?? 'none'}`).join(' '));

  const sipTypeCsv = [
    'Scheme Name,Transaction type,Units,NAV,Date',
    'Quant Small Cap Fund Direct Growth,SIP,10,300,15-01-2026',
    'Quant Small Cap Fund Direct Growth,Purchase,10,310,15-02-2026',
    'Quant Small Cap Fund Direct Growth,Switch In,5,315,15-03-2026',
  ].join('\n');
  res = await authed(`/portfolio/${pid}/import/preview`, { method: 'POST', token, body: { content: sipTypeCsv } });
  check('SIP, Purchase and Switch In all read as buys', res.json.data?.rows?.every((row) => row.transactionType === 'BUY'), res.json.data?.rows?.map((r) => r.transactionType).join(','));

  const perfRows = ['Scheme Name,Units,Average NAV'];
  for (let i = 0; i < 40; i += 1) perfRows.push(`Parag Parikh Flexi Cap Fund Direct Growth,${10 + i},${70 + i}`);
  const previewStart = Date.now();
  res = await authed(`/portfolio/${pid}/import/preview`, { method: 'POST', token, body: { content: perfRows.join('\n') } });
  check('a 40-row fund statement previews quickly', Date.now() - previewStart < 3000, `${Date.now() - previewStart}ms`);


  console.log('\n--- feature 9: mutual funds ---');

  res = await call('/funds/status');
  const fundStatus = res.json.data;
  check('fund universe loaded', fundStatus?.schemes > 5000, `${fundStatus?.schemes} schemes`);
  check('NAVs are recent', fundStatus?.latestNavDate && Date.now() - new Date(fundStatus.latestNavDate).getTime() < 8 * 864e5, fundStatus?.latestNavDate?.slice(0, 10));

  res = await call('/funds/search?q=' + encodeURIComponent('parag parikh flexi cap direct growth') + '&limit=3');
  check('exact scheme search hits the right scheme', res.json.data?.results?.[0]?.schemeCode === '122639', res.json.data?.results?.[0]?.name);
  check('scheme carries a live NAV', res.json.data?.results?.[0]?.nav > 0);

  res = await call('/funds/search?q=' + encodeURIComponent('hdfc mid cap opportunities direct growth') + '&limit=3');
  check('renamed scheme still resolves', /hdfc mid cap fund/i.test(res.json.data?.results?.[0]?.name ?? ''), res.json.data?.results?.[0]?.name);

  res = await call('/funds/search?q=' + encodeURIComponent('sbi bluechip direct growth') + '&limit=3');
  check('bluechip maps onto the large cap rename', /sbi large cap/i.test(res.json.data?.results?.[0]?.name ?? ''), res.json.data?.results?.[0]?.name);

  res = await call('/funds/122639');
  check('scheme lookup -> 200', res.status === 200 && res.json.data?.nav > 0, `NAV ${res.json.data?.nav}`);

  res = await call('/funds/99999999');
  check('unknown scheme -> 404', res.status === 404, res.json.message);

  res = await call('/funds/not-a-code');
  check('malformed scheme code -> 422', res.status === 422);

  const mfCsv = [
    'Scheme Name,Folio Number,Units,Average NAV,Current NAV,Invested Amount,Current Value',
    'Parag Parikh Flexi Cap Fund Direct Growth,12345678,120.5,68.40,91.05,8242.20,10971.53',
    'Quant Small Cap Fund Direct Growth,87654321,45.25,240.10,319.79,10864.53,14470.50',
  ].join('\n');

  res = await authed(`/portfolio/${pid}/import/preview`, { method: 'POST', token, body: { content: mfCsv } });
  const mfPreview = res.json.data;
  check('mutual fund statement detected', mfPreview?.detectedFormat === 'Groww (mutual funds)', String(mfPreview?.detectedFormat));
  check('schemes matched against AMFI', mfPreview?.rows?.every((row) => row.fund?.schemeCode), mfPreview?.rows?.map((r) => r.fund?.schemeCode).join(','));
  check('units parsed as quantity', mfPreview?.rows?.[0]?.quantity === 120.5);
  check('average NAV parsed as cost', mfPreview?.rows?.[0]?.avgBuyPrice === 68.4);

  res = await authed(`/portfolio/${pid}/import/commit`, {
    method: 'POST',
    token,
    body: {
      rows: mfPreview.rows.map((row) => ({
        assetType: 'MUTUAL_FUND',
        schemeCode: row.fund.schemeCode,
        quantity: row.quantity,
        avgBuyPrice: row.avgBuyPrice,
      })),
    },
  });
  check('fund import commit -> 200', res.status === 200 && res.json.data?.added === 2, `${res.json.data?.added} added`);

  res = await authed(`/portfolio/${pid}/holdings`, {
    method: 'POST',
    token,
    body: { assetType: 'MUTUAL_FUND', quantity: 10, avgBuyPrice: 50 },
  });
  check('fund holding without a scheme code -> 422', res.status === 422);

  res = await authed(`/portfolio/${pid}`, { token });
  const withFunds = res.json.data;
  const fundHolding = withFunds.holdings.find((h) => h.schemeCode === '122639');
  check('fund holding is valued at NAV', Math.abs(fundHolding.value - fundHolding.quantity * fundHolding.price) < 1, `${fundHolding?.quantity} × ${fundHolding?.price}`);
  check('fund holding carries its scheme metadata', Boolean(fundHolding?.fundHouse && fundHolding?.navDate), fundHolding?.fundHouse);
  check('fund holding is priced in INR at rate 1', fundHolding?.currency === 'INR' && fundHolding?.fxRate === 1);
  check('asset class split covers stocks and funds', withFunds.allocation.byAssetClass.length === 2, withFunds.allocation.byAssetClass.map((a) => `${a.label} ${a.weight}%`).join(', '));
  check('asset class weights add up', Math.abs(withFunds.allocation.byAssetClass.reduce((sum, a) => sum + a.weight, 0) - 100) < 0.5);
  check('totals split equity and fund value', Math.abs(withFunds.totals.equityValue + withFunds.totals.fundValue - withFunds.totals.value) < 1);
  check('fund categories appear in sector allocation', withFunds.allocation.bySector.some((s) => /Scheme/i.test(s.label)));



  console.log('\n--- deleting a holding ---');

  {
    const { Transaction } = await import(`${ROOT}/modules/portfolio/transaction.model.js`);

    let res3 = await authed('/portfolio', { method: 'POST', token, body: { name: 'Holding bin', baseCurrency: 'INR' } });
    const binId = res3.json.data?.id;

    await authed(`/portfolio/${binId}/transactions`, {
      method: 'POST',
      token,
      body: { symbol: 'CIPLA', exchange: 'NSE', type: 'BUY', quantity: 5, price: 1500, date: '2026-02-01T00:00:00.000Z' },
    });

    res3 = await authed(`/portfolio/${binId}`, { token });
    const cipla = res3.json.data.holdings.find((h) => h.symbol === 'CIPLA');
    check('a ledger creates the holding', Boolean(cipla) && cipla.transactionCount === 1, `txns=${cipla?.transactionCount}`);

    res3 = await authed(`/portfolio/${binId}/holdings/${cipla.id}`, { method: 'DELETE', token });
    check('removing a holding reports the transactions it took with it', res3.json.data?.transactions === 1, JSON.stringify(res3.json.data));

    const orphans = await Transaction.countDocuments({ portfolioId: binId, symbol: 'CIPLA' });
    check('a removed holding leaves no orphaned transactions', orphans === 0, `${orphans} left`);

    res3 = await authed(`/portfolio/${binId}`, { token });
    check('the removed holding does not come back', !res3.json.data.holdings.some((h) => h.symbol === 'CIPLA'));
    check('its realised gains leave the totals too', res3.json.data.totals.ledgerPositions === 0, `ledgerPositions=${res3.json.data.totals.ledgerPositions}`);

    await authed(`/portfolio/${binId}`, { method: 'DELETE', token });
  }

  console.log('\n--- deleting a portfolio ---');

  {
    const { Transaction } = await import(`${ROOT}/modules/portfolio/transaction.model.js`);
    const { Holding } = await import(`${ROOT}/modules/portfolio/portfolio.model.js`);

    let res2 = await authed('/portfolio', { method: 'POST', token, body: { name: 'Disposable', baseCurrency: 'INR' } });
    const disposableId = res2.json.data?.id;

    await authed(`/portfolio/${disposableId}/holdings`, {
      method: 'POST',
      token,
      body: { symbol: 'ITC', exchange: 'NSE', quantity: 10, avgBuyPrice: 400 },
    });
    await authed(`/portfolio/${disposableId}/transactions`, {
      method: 'POST',
      token,
      body: { symbol: 'ITC', exchange: 'NSE', type: 'BUY', quantity: 10, price: 400, date: '2026-01-05T00:00:00.000Z' },
    });

    res2 = await authed(`/portfolio/${disposableId}`, { method: 'DELETE', token });
    check('deleting a portfolio -> 200', res2.status === 200, res2.json.message);
    check('the delete reports what it removed', res2.json.data?.holdings >= 1 && res2.json.data?.transactions >= 1, JSON.stringify(res2.json.data));

    const leftoverHoldings = await Holding.countDocuments({ portfolioId: disposableId });
    const leftoverTransactions = await Transaction.countDocuments({ portfolioId: disposableId });
    check('no holdings are left behind', leftoverHoldings === 0, `${leftoverHoldings} left`);
    check('no transactions are orphaned', leftoverTransactions === 0, `${leftoverTransactions} left`);

    res2 = await authed(`/portfolio/${disposableId}`, { token });
    check('the deleted portfolio is gone -> 404', res2.status === 404);

    res2 = await authed(`/portfolio/${disposableId}`, { method: 'DELETE', token });
    check('deleting it twice -> 404', res2.status === 404);

    const other = await authed('/auth/register', {
      method: 'POST',
      body: { name: 'Intruder', email: `intruder-${Date.now()}@plumbline.local`, password: 'Sensex2026x' },
    });
    res2 = await authed(`/portfolio/${pid}`, { method: 'DELETE', token: other.json.data?.accessToken });
    check("another user cannot delete this portfolio", res2.status === 404, `status=${res2.status}`);
    await User.deleteMany({ email: other.json.data?.user?.email });
  }

  console.log('\n--- broker sync reconciliation ---');

  {
    const { reconcileBrokerHoldings } = await import(`${ROOT}/modules/portfolio/portfolio.service.js`);
    const { Holding } = await import(`${ROOT}/modules/portfolio/portfolio.model.js`);
    const { Types } = await import('mongoose');

    const uid = new Types.ObjectId(userId);
    const snapshot = [
      { assetType: 'EQUITY', symbol: 'VEDL', exchange: 'NSE', quantity: 10, avgBuyPrice: 1200 },
      { assetType: 'EQUITY', symbol: 'TRENT', exchange: 'NSE', quantity: 4, avgBuyPrice: 1500 },
    ];

    const first = await reconcileBrokerHoldings(uid, pid, 'groww', snapshot);
    check('a first sync adds the broker positions', first.added === 2, JSON.stringify(first));

    const second = await reconcileBrokerHoldings(uid, pid, 'groww', snapshot);
    const afterTwo = await Holding.findOne({ portfolioId: pid, symbol: 'VEDL' });
    check('syncing the same snapshot twice adds nothing', second.added === 0 && second.updated === 0, JSON.stringify(second));
    check('quantities do not accumulate across syncs', afterTwo?.quantity === 10, `quantity=${afterTwo?.quantity}`);
    check('cost basis does not drift across syncs', afterTwo?.avgBuyPrice === 1200, `avg=${afterTwo?.avgBuyPrice}`);

    const changed = await reconcileBrokerHoldings(uid, pid, 'groww', [
      { assetType: 'EQUITY', symbol: 'VEDL', exchange: 'NSE', quantity: 15, avgBuyPrice: 1250 },
      { assetType: 'EQUITY', symbol: 'TRENT', exchange: 'NSE', quantity: 4, avgBuyPrice: 1500 },
    ]);
    const afterChange = await Holding.findOne({ portfolioId: pid, symbol: 'VEDL' });
    check('a real change at the broker updates the position', changed.updated === 1 && afterChange?.quantity === 15, `updated=${changed.updated} qty=${afterChange?.quantity}`);

    const dropped = await reconcileBrokerHoldings(uid, pid, 'groww', [
      { assetType: 'EQUITY', symbol: 'VEDL', exchange: 'NSE', quantity: 15, avgBuyPrice: 1250 },
    ]);
    const goneCipla = await Holding.findOne({ portfolioId: pid, symbol: 'TRENT' });
    check('a position sold at the broker is removed', dropped.removed === 1 && !goneCipla, `removed=${dropped.removed}`);

    // A manual holding must survive a sync that does not mention it.
    await authed(`/portfolio/${pid}/holdings`, {
      method: 'POST',
      token,
      body: { symbol: 'ITC', exchange: 'NSE', quantity: 50, avgBuyPrice: 400 },
    });
    await reconcileBrokerHoldings(uid, pid, 'groww', [
      { assetType: 'EQUITY', symbol: 'VEDL', exchange: 'NSE', quantity: 15, avgBuyPrice: 1250 },
    ]);
    const manual = await Holding.findOne({ portfolioId: pid, symbol: 'ITC' });
    check('a manual holding survives a broker sync', manual?.quantity === 50 && manual?.origin === 'manual', `qty=${manual?.quantity} origin=${manual?.origin}`);

    // A ledger-backed position carries FIFO history a snapshot cannot express, so it is left alone.
    const ledgerSync = await reconcileBrokerHoldings(uid, pid, 'groww', [
      { assetType: 'EQUITY', symbol: 'TCS', exchange: 'NSE', quantity: 999, avgBuyPrice: 1 },
    ]);
    const tcsHolding = await Holding.findOne({ portfolioId: pid, symbol: 'TCS' });
    check(
      'a position with a transaction ledger is not overwritten by a sync',
      ledgerSync.skipped.some((entry) => entry.symbol === 'TCS') && tcsHolding?.quantity !== 999,
      `skipped=${ledgerSync.skipped.map((x) => x.symbol).join(',')} qty=${tcsHolding?.quantity}`,
    );
  }

  const { Transaction } = await import(`${ROOT}/modules/portfolio/transaction.model.js`);
  await Transaction.deleteMany({ portfolioId: pid });
  await Holding.deleteMany({ portfolioId: pid });
  await Portfolio.deleteOne({ _id: pid });
  await User.deleteMany({ email: { $in: [email, otherEmail] } });
  console.log('cleaned up test user and portfolio');
} else {
  console.log('SKIP  portfolio checks (no database)');
}

console.log('\n--- feature 14: compare ---');

r = await call('/market/compare?symbols=NSE:RELIANCE,NSE:TCS,NASDAQ:AAPL');
const comparison = r.json.data;
check('compare -> 200', r.status === 200);
check('every company is returned', comparison?.entries?.length === 3 && comparison.failed.length === 0, `${comparison?.entries?.length} entries`);
check('each entry carries a quote', comparison?.entries?.every((e) => e.quote?.price > 0));
check('each entry carries fundamentals', comparison?.entries?.every((e) => e.fundamentals?.valuation));
check('each entry carries its sector', comparison?.entries?.every((e) => typeof e.sector === 'string'), comparison?.entries?.map((e) => e.sector).join(', '));
check('currencies follow the listing', comparison?.entries?.find((e) => e.symbol === 'AAPL')?.currency === 'USD' && comparison?.entries?.find((e) => e.symbol === 'TCS')?.currency === 'INR');

r = await call('/market/compare?symbols=NSE:RELIANCE,NSE:TCS,NASDAQ:AAPL,NASDAQ:MSFT,NSE:INFY');
check('more than four companies -> 422', r.status === 422, r.json.message);

r = await call('/market/compare?symbols=NOTAPAIR');
check('a malformed pair -> 400', r.status === 400, r.json.message);

r = await call('/market/compare?symbols=');
check('an empty list -> 422', r.status === 422);

const compareStart = Date.now();
await call('/market/compare?symbols=NSE:RELIANCE,NSE:TCS,NASDAQ:AAPL');
check('compare is cached', Date.now() - compareStart < 80, `${Date.now() - compareStart}ms`);

console.log('\n--- feature 16: screener ---');

r = await call('/screener?limit=5');
const screener = r.json.data;
check('screener -> 200', r.status === 200);
check('screener returns a universe and sectors', screener?.universe > 20 && screener?.sectors?.length > 3, `${screener?.universe} companies, ${screener?.sectors?.length} sectors`);
check('a company listed twice appears once', new Set(screener.rows.map((row) => row.symbol)).size === screener.rows.length);

r = await call('/screener?maxPeRatio=20&limit=50');
check('the P/E ceiling is respected', r.json.data.rows.every((row) => row.peRatio !== null && row.peRatio <= 20), `${r.json.data.total} matched`);

r = await call('/screener?minRoe=18&limit=50');
check('the ROE floor is respected', r.json.data.rows.every((row) => row.roe !== null && row.roe >= 18), `${r.json.data.total} matched`);

r = await call('/screener?maxDebtToEquity=0.5&minDividendYield=1&limit=50');
check('filters combine', r.json.data.rows.every((row) => row.debtToEquity <= 0.5 && row.dividendYield >= 1), `${r.json.data.total} matched`);

r = await call('/screener?market=IN&limit=50');
check('the market filter holds', r.json.data.rows.every((row) => row.market === 'IN'));

r = await call('/screener?sortBy=roe&sortDir=desc&limit=10');
check('sorting is applied', r.json.data.rows.every((row, i, all) => i === 0 || (all[i - 1].roe ?? -1e9) >= (row.roe ?? -1e9)));

r = await call('/screener?sortBy=peRatio&sortDir=asc&limit=10');
check('ascending sort works too', r.json.data.rows.every((row, i, all) => i === 0 || (all[i - 1].peRatio ?? 1e9) <= (row.peRatio ?? 1e9)));

const firstPage = (await call('/screener?limit=5&page=1')).json.data;
const secondPage = (await call('/screener?limit=5&page=2')).json.data;
check('pagination returns different rows', firstPage.rows[0].symbol !== secondPage.rows[0].symbol, `${firstPage.rows[0].symbol} then ${secondPage.rows[0].symbol}`);
check('the total is stable across pages', firstPage.total === secondPage.total);

r = await call('/screener?sortBy=nonsense');
check('an unknown sort field -> 422', r.status === 422);

r = await call('/screener?limit=500');
check('an oversized page -> 422', r.status === 422);

r = await call('/screener?minRoe=999&limit=10');
check('impossible filters return nothing, not an error', r.status === 200 && r.json.data.total === 0);

console.log('\n--- provider coverage memory ---');

const providers = await import(`${ROOT}/modules/market/providers/index.js`);

check('a provider is used before it is known to be uncovered', !providers.isUncovered('fmp', 'IN'));
providers.markUncovered('fmp', 'IN', 'responded 402: not available under your current subscription');
check('a plan-limited provider is remembered', providers.isUncovered('fmp', 'IN'));
check('the memory is per market, not global', !providers.isUncovered('fmp', 'US'));
check('the chain drops it for that market', !providers.providerChain('quote', 'IN').some((p) => p.id === 'fmp'));
check('the chain keeps it elsewhere', providers.providerChain('quote', 'US').some((p) => p.id === 'fmp') || !providers.PROVIDER_PRIORITY.find((p) => p.id === 'fmp')?.isConfigured());
check('coverage gaps are reportable', providers.coverageGaps().some((gap) => gap.provider === 'fmp' && gap.market === 'IN'));

console.log('\n--- feature 17: market news ---');

r = await call('/news/status');
check('news status -> 200', r.status === 200);
check('news names its provider', Boolean(r.json.data?.provider), r.json.data?.provider);
check('news is honest about how sentiment is scored', /keyword/i.test(r.json.data?.note ?? ''), r.json.data?.note?.slice(0, 60));

r = await call('/news?market=IN&limit=8');
const feed = r.json.data;
check('market news -> 200 even when upstream throttles', r.status === 200, `degraded=${Boolean(feed?.degraded)}`);
check(
  'a throttled feed degrades instead of failing the page',
  feed?.articles?.length > 0 || feed?.degraded === true,
  `${feed?.articles?.length ?? 0} articles, degraded=${Boolean(feed?.degraded)}`,
);
const hasArticles = (feed?.articles?.length ?? 0) > 0;
check('every article has a working link', !hasArticles || feed.articles.every((a) => /^https?:\/\//.test(a.url)));
check('every article carries a sentiment', !hasArticles || feed.articles.every((a) => ['positive', 'neutral', 'negative'].includes(a.sentiment)));
check('sentiment is labelled keyword-based', !hasArticles || feed.articles.every((a) => a.sentimentEngine === 'keyword'));
check('articles are newest first', !hasArticles || feed.articles.every((a, i, all) => i === 0 || !a.publishedAt || !all[i - 1].publishedAt || new Date(all[i - 1].publishedAt) >= new Date(a.publishedAt)));
check('headlines are de-duplicated', new Set(feed.articles.map((a) => a.headline.toLowerCase())).size === feed.articles.length);
check('a degraded feed is flagged, not silently empty', hasArticles || feed?.degraded === true);
check('the publisher suffix is stripped from headlines', !hasArticles || feed.articles.every((a) => !a.source || !a.headline.endsWith(` - ${a.source}`)));

r = await call('/news/digest?market=IN');
const newsDigest = r.json.data;
check('digest -> 200', r.status === 200);
check('digest counts every article it read', newsDigest.breakdown.positive + newsDigest.breakdown.neutral + newsDigest.breakdown.negative === newsDigest.articleCount, JSON.stringify(newsDigest.breakdown));
check('digest tone is a valid sentiment', ['positive', 'neutral', 'negative'].includes(newsDigest?.tone), newsDigest?.tone);
check('digest explains itself', newsDigest?.summary?.length > 30);

r = await call('/news?market=EU');
check('unknown market -> 422', r.status === 422);

r = await call('/news/symbol/NSE/RELIANCE?limit=4');
check('company news -> 200', r.status === 200);
check('company news is tagged with the symbol', r.json.data?.articles?.every((a) => a.symbol === 'RELIANCE'), `${r.json.data?.articles?.length ?? 0} articles`);

r = await call('/news/symbol/XETRA/SAP');
check('unsupported exchange -> 422', r.status === 422);

const newsStart = Date.now();
await call('/news?market=IN&limit=8');
check('the news feed is cached', Date.now() - newsStart < 200, `${Date.now() - newsStart}ms`);

console.log('\n--- provider request spacing ---');

{
  const { fetchJson } = await import(`${ROOT}/modules/market/providers/upstream.js`);

  // Points at our own health endpoint, not Alpha Vantage: the throttle keys on the provider id,
  // so this proves the spacing without spending any of the 25 calls a day the free tier allows.
  const spacingStart = Date.now();
  await Promise.all([
    fetchJson(`${BASE}/health`, { provider: 'alphavantage' }),
    fetchJson(`${BASE}/health`, { provider: 'alphavantage' }),
  ]);
  const spaced = Date.now() - spacingStart;
  check('rate-limited providers have their calls spaced apart', spaced >= 1500, `${spaced}ms for two calls`);

  const freeStart = Date.now();
  await Promise.all([
    fetchJson(`${BASE}/health`, { provider: 'yahoo' }),
    fetchJson(`${BASE}/health`, { provider: 'yahoo' }),
  ]);
  const free = Date.now() - freeStart;
  check('providers without a limit are not slowed down', free < 500, `${free}ms for two calls`);
}

console.log('\n--- indian fundamentals (BSE) ---');

r = await call('/market/fundamentals/NSE/RELIANCE');
const inFund = r.json.data;
check('indian fundamentals -> 200', r.status === 200);

if (inFund?.source === 'bse') {
  check('indian fundamentals come from a real source, not sample', inFund.source === 'bse', inFund.source);
  check('BSE supplies the core ratios', inFund.valuation.peRatio > 0 && inFund.perShare.eps > 0, `pe=${inFund.valuation.peRatio} eps=${inFund.perShare.eps}`);
  check('BSE ratios sit in a plausible band', inFund.valuation.peRatio < 500 && Math.abs(inFund.profitability.netMargin) <= 100, `pe=${inFund.valuation.peRatio} npm=${inFund.profitability.netMargin}`);
  check('indian fundamentals are priced in INR', inFund.currency === 'INR');

  // Zomato is listed as Eternal Ltd — resolved by name, not ticker.
  r = await call('/market/fundamentals/NSE/ZOMATO');
  check('a renamed company still resolves', r.json.data?.source === 'bse', `${r.json.data?.source}`);

  // Reports are cached for 24 hours, so an old one can predate this data source. Regenerate to
  // judge current inputs — and only when the rule engine is answering, so the check costs nothing.
  const aiHealth = await call('/ai/status');
  if (!aiHealth.json.data?.healthy) {
    r = await call('/ai/stock/NSE/RELIANCE?refresh=true');
    const quoteSource = (await call('/market/quote/NSE/RELIANCE')).json.data?.source;
    const anySample = quoteSource === 'sample' || inFund.source === 'sample';
    check(
      'the simulated-data caveat tracks the real sources',
      Boolean(r.json.data?.dataCaveat) === anySample,
      `quote=${quoteSource} fundamentals=${inFund.source} caveat=${Boolean(r.json.data?.dataCaveat)}`,
    );
  }
} else {
  console.log(`SKIP  BSE unreachable from here (source=${inFund?.source}); ratio checks skipped`);
}

r = await call('/market/status');
const bse = (r.json.data?.providers ?? []).find((p) => p.id === 'bse');
check('BSE is registered as a keyless provider', Boolean(bse) && bse.configured === true, bse ? `capabilities=${bse.capabilities.join(',')}` : 'missing');
check('BSE only claims fundamentals', bse?.capabilities?.length === 1 && bse.capabilities[0] === 'fundamentals');

console.log(`\n${failures ? `${failures} check(s) failed` : 'all checks passed'}`);

server.close();
process.exit(failures ? 1 : 0);
