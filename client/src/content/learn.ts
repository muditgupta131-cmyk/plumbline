export interface LearnEntry {
  slug: string;
  title: string;
  category: 'Valuation' | 'Profitability' | 'Risk' | 'Instruments' | 'Returns';
  oneLiner: string;
  formula?: string;
  body: string[];
  howToRead: string;
  watchOut: string;
  whereInApp: string;
  related: string[];
}

export const LEARN_ENTRIES: LearnEntry[] = [
  {
    slug: 'market-cap',
    title: 'Market capitalisation',
    category: 'Valuation',
    oneLiner: 'What the market says the whole company is worth.',
    formula: 'Share price × number of shares outstanding',
    body: [
      'Market cap is the price tag the market puts on the entire business. A ₹500 share price tells you nothing on its own — a company with 10 crore shares at ₹500 is worth ₹5,000 crore, while one with 100 crore shares at ₹50 is worth exactly the same.',
      'It is the first number to look at, because it sets the context for every other number. A 20% revenue increase means something very different at a ₹500 crore company than at a ₹5 lakh crore one.',
    ],
    howToRead:
      'Use it to compare like with like. Indian reporting usually talks in crore; Plumbline shows ₹19.10L Cr for large caps and $3.52T for US ones, following each market\'s own convention.',
    watchOut:
      'Market cap ignores debt. Two companies can be worth the same on paper while one owes nothing and the other is buried in borrowings — which is why enterprise value exists.',
    whereInApp: 'Every stock page, the screener, and the compare table.',
    related: ['ev-ebitda', 'pe-ratio'],
  },
  {
    slug: 'pe-ratio',
    title: 'P/E ratio',
    category: 'Valuation',
    oneLiner: 'How many rupees you pay for one rupee of annual profit.',
    formula: 'Share price ÷ earnings per share',
    body: [
      'A P/E of 25 means you are paying ₹25 for every ₹1 the company earns in a year. Put another way, at today\'s profit it would take 25 years to earn back the price — which is why a high P/E only makes sense if you expect profits to grow.',
      'P/E is the most quoted valuation number and the most misused. It is only meaningful against something: the same company\'s history, or its sector. A software company at 30× and a bank at 30× are not comparable.',
    ],
    howToRead:
      'Compare against the sector, which Plumbline does for you on the stock page — "P/E of 34.8 against a Technology benchmark of 28" is a far more useful sentence than the number alone.',
    watchOut:
      'A low P/E is not automatically a bargain. It usually means the market expects earnings to fall, and quite often the market is right. Cheap and doomed look identical on this measure.',
    whereInApp: 'Stock detail, screener filters, compare table, and the AI report\'s valuation section.',
    related: ['eps', 'peg-ratio', 'market-cap'],
  },
  {
    slug: 'eps',
    title: 'Earnings per share',
    category: 'Profitability',
    oneLiner: 'The company\'s profit, divided by the number of shares.',
    formula: 'Net profit ÷ shares outstanding',
    body: [
      'EPS turns a company-wide profit figure into something per-share, so it can be compared to a share price. It is the denominator in the P/E ratio and the number most quarterly results headlines lead with.',
      'Rising EPS can come from genuinely higher profit, or from the share count falling through buybacks. Both raise EPS; only one means the business improved.',
    ],
    howToRead:
      'Look at the trend across several years rather than a single quarter, and check whether revenue moved with it. Profit rising while revenue is flat means margins improved — that has limits.',
    watchOut:
      'One-off items — an asset sale, a legal settlement, a tax writeback — can inflate a single year\'s EPS and make the P/E look artificially cheap.',
    whereInApp: 'Stock detail key statistics, and the growth section of the compare table.',
    related: ['pe-ratio', 'net-margin'],
  },
  {
    slug: 'peg-ratio',
    title: 'PEG ratio',
    category: 'Valuation',
    oneLiner: 'P/E adjusted for how fast earnings are growing.',
    formula: 'P/E ratio ÷ earnings growth rate',
    body: [
      'PEG tries to answer the obvious objection to P/E: a fast-growing company deserves a higher multiple. A P/E of 40 with 40% growth gives a PEG of 1; a P/E of 15 with 5% growth gives 3.',
      'By that logic the "expensive" company is the better value. It is a rough tool, not a precise one, but it stops you dismissing growth outright.',
    ],
    howToRead: 'Below 1 is the traditional rule of thumb for a company growing into its valuation. Around 1 to 2 is ordinary.',
    watchOut:
      'PEG depends entirely on the growth number you feed it, and growth rates are the least reliable figure on any statement. A single strong year can make a mediocre business look cheap.',
    whereInApp: 'Stock detail valuation group and the compare table.',
    related: ['pe-ratio', 'eps'],
  },
  {
    slug: 'roe',
    title: 'Return on equity',
    category: 'Profitability',
    oneLiner: 'How much profit the company makes on the money shareholders put in.',
    formula: 'Net profit ÷ shareholder equity',
    body: [
      'ROE is the closest thing to a single measure of business quality. It asks: for every ₹100 of shareholder capital in this business, how much profit comes back each year?',
      'A company sustaining 20%+ ROE is doing something genuinely difficult — it has a position competitors cannot easily copy. Most businesses drift toward the cost of capital over time.',
    ],
    howToRead:
      'Compare to the sector and look for consistency. Five years above the sector average matters far more than one spectacular year.',
    watchOut:
      'Debt flatters ROE. Borrowing shrinks the equity denominator, so a heavily indebted company can post a high ROE while being fragile. Always read it next to debt to equity.',
    whereInApp: 'Stock detail profitability group, the screener, and the AI report\'s quality signals.',
    related: ['debt-to-equity', 'net-margin'],
  },
  {
    slug: 'net-margin',
    title: 'Net margin',
    category: 'Profitability',
    oneLiner: 'How much of each rupee of sales survives as profit.',
    formula: 'Net profit ÷ revenue',
    body: [
      'Revenue is vanity, profit is sanity. Net margin tells you what fraction of everything the company sold actually reached the bottom line after costs, interest and tax.',
      'Margins are mostly a property of the industry. Software keeps 20-30%; grocery retail keeps 2-3%. Neither is better — they are different businesses with different capital needs.',
    ],
    howToRead:
      'Judge a margin against its own sector and its own history. A margin that has been rising for years usually means pricing power.',
    watchOut:
      'Margin can be improved by cutting things that matter — research, maintenance, marketing. That flatters this year and costs later years.',
    whereInApp: 'Stock detail profitability group, screener filters, and the compare table.',
    related: ['roe', 'eps'],
  },
  {
    slug: 'debt-to-equity',
    title: 'Debt to equity',
    category: 'Risk',
    oneLiner: 'How much the company has borrowed against what shareholders own.',
    formula: 'Total borrowings ÷ shareholder equity',
    body: [
      'Debt magnifies outcomes in both directions. In good years borrowed money boosts returns; in bad ones the interest still has to be paid, and it is paid before shareholders see anything.',
      'What counts as high depends entirely on the business. Banks and lenders run leverage as their model — a debt-to-equity of 2 is normal there. A software company at 2 would be alarming.',
    ],
    howToRead: 'Read it alongside interest coverage. A high debt load matters much less if profits cover the interest many times over.',
    watchOut:
      'Plumbline compares each company to a broad sector average. That is a rough guide — a capital-intensive manufacturer inside a light-asset sector will look worse than it is.',
    whereInApp: 'Stock detail balance sheet group, screener filters, and the AI portfolio review.',
    related: ['interest-coverage', 'roe'],
  },
  {
    slug: 'interest-coverage',
    title: 'Interest coverage',
    category: 'Risk',
    oneLiner: 'How many times over the company can pay the interest on its debt.',
    formula: 'Operating profit ÷ interest expense',
    body: [
      'This is the practical companion to debt-to-equity. Debt is only dangerous when you cannot service it, and coverage measures exactly that.',
      'A coverage of 10 means operating profit is ten times the interest bill — profits could fall dramatically and the company would still pay its lenders.',
    ],
    howToRead: 'Above 5 is comfortable for most businesses. Below 2 leaves very little room if trading turns down.',
    watchOut:
      'Coverage is calculated on operating profit, which can be seasonal or cyclical. A comfortable annual figure can hide a difficult quarter.',
    whereInApp: 'Stock detail balance sheet group and the compare table.',
    related: ['debt-to-equity', 'cash-flow'],
  },
  {
    slug: 'cash-flow',
    title: 'Free cash flow',
    category: 'Profitability',
    oneLiner: 'The cash left after running the business and maintaining it.',
    formula: 'Operating cash flow − capital expenditure',
    body: [
      'Profit is an accounting opinion; cash is a fact. Free cash flow is what remains after the company has paid its bills and spent what it needs to keep the lights on and the machines running.',
      'It is the money genuinely available for dividends, buybacks, paying down debt or acquisitions. A company can report profit for years while free cash flow stays negative — that gap is where most accounting problems hide.',
    ],
    howToRead: 'Compare it to net profit. When cash flow consistently tracks or exceeds profit, the earnings are real.',
    watchOut:
      'A company can flatter free cash flow by underinvesting. Cutting capital expenditure raises it this year at the cost of the business later.',
    whereInApp: 'Stock detail balance sheet group, where the connected provider reports it.',
    related: ['net-margin', 'intrinsic-value'],
  },
  {
    slug: 'dividend',
    title: 'Dividends and yield',
    category: 'Returns',
    oneLiner: 'Cash paid out to shareholders, as a percentage of the share price.',
    formula: 'Annual dividend per share ÷ share price',
    body: [
      'A dividend is profit handed back rather than reinvested. Yield expresses it against the price you pay, so a ₹20 dividend on a ₹500 share is a 4% yield.',
      'Mature businesses with limited reinvestment opportunities tend to pay more. Fast-growing ones usually pay nothing, because reinvesting at a high return beats handing cash back.',
    ],
    howToRead:
      'Read yield next to the payout ratio — the share of profit being distributed. A high yield funded by 90% of earnings is far more fragile than a modest one funded by 30%.',
    watchOut:
      'Yield rises when the price falls. An unusually high yield is often the market predicting the dividend is about to be cut, not a bargain.',
    whereInApp: 'Stock detail, screener filters, and estimated dividend income on your portfolio.',
    related: ['eps', 'cash-flow'],
  },
  {
    slug: 'beta',
    title: 'Beta',
    category: 'Risk',
    oneLiner: 'How much a stock moves relative to the market.',
    body: [
      'A beta of 1 means the stock has historically moved roughly with the index. Above 1 means it amplifies market moves in both directions; below 1 means it is steadier.',
      'A beta of 1.4 suggests that when the index falls 10%, this stock has tended to fall about 14%. It is a description of past volatility, not a prediction.',
    ],
    howToRead: 'Use it to understand what a portfolio will feel like in a downturn, not to pick individual stocks.',
    watchOut:
      'Beta measures volatility, not risk of permanent loss. A stable, slowly failing company can have a low beta right up until it fails.',
    whereInApp: 'Stock detail balance sheet and risk group, and the compare table.',
    related: ['alpha', 'sharpe-ratio'],
  },
  {
    slug: 'alpha',
    title: 'Alpha',
    category: 'Returns',
    oneLiner: 'Return beyond what the market alone would have given you.',
    body: [
      'If the market returned 12% and your portfolio returned 15% while taking the same risk, the extra 3 points is alpha. It is the part of a return that cannot be explained by simply being invested.',
      'Alpha is the entire justification for active management, and most of the evidence says it is rare and hard to sustain after costs.',
    ],
    howToRead: 'Meaningful only over long periods and after fees. Three good years is usually luck rather than skill.',
    watchOut:
      'Apparent alpha often turns out to be hidden risk — leverage, concentration, or an illiquid position that has not been tested yet.',
    whereInApp: 'Not yet computed. Plumbline reports XIRR, the return you actually earned, rather than a market-relative figure.',
    related: ['beta', 'xirr', 'sharpe-ratio'],
  },
  {
    slug: 'sharpe-ratio',
    title: 'Sharpe ratio',
    category: 'Returns',
    oneLiner: 'Return earned per unit of volatility endured.',
    formula: '(Portfolio return − risk-free rate) ÷ standard deviation of returns',
    body: [
      'Two portfolios both returning 14% are not equally good if one moved smoothly and the other swung wildly. Sharpe divides excess return by volatility to compare them fairly.',
      'It answers: how much did you get paid for the discomfort you absorbed?',
    ],
    howToRead: 'Higher is better. Around 1 is respectable, above 2 is excellent, and anything remarkable deserves suspicion.',
    watchOut:
      'Sharpe treats upside and downside volatility identically, so it penalises a portfolio that occasionally jumps sharply upward. It also assumes a distribution of returns that markets do not really follow.',
    whereInApp: 'Not yet computed. The portfolio review reports maximum drawdown instead, which is more intuitive.',
    related: ['beta', 'alpha'],
  },
  {
    slug: 'intrinsic-value',
    title: 'Intrinsic value and DCF',
    category: 'Valuation',
    oneLiner: 'What a business is worth based on the cash it will produce.',
    body: [
      'Intrinsic value is the idea that a company is worth the cash it will generate over its life, discounted back to today because money now is worth more than money later.',
      'A discounted cash flow model is the formal version: project future free cash flow, pick a discount rate, add it all up. It is the most theoretically correct valuation method and the easiest to fool yourself with.',
    ],
    howToRead:
      'Treat any DCF output as a range, not a number. Change the growth rate by one point or the discount rate by half a point and the answer moves enormously.',
    watchOut:
      'A DCF is arithmetic applied to guesses. It lends false precision to a forecast, and it is trivially easy to reverse-engineer assumptions that justify a price you already like.',
    whereInApp:
      'Not built. Plumbline deliberately compares reported figures against sector benchmarks rather than publishing a single "fair value" number it cannot stand behind.',
    related: ['cash-flow', 'pe-ratio'],
  },
  {
    slug: 'mutual-fund',
    title: 'Mutual funds',
    category: 'Instruments',
    oneLiner: 'A pooled vehicle that invests on your behalf, priced once a day.',
    body: [
      'You buy units, not shares. The fund invests the pool according to its stated mandate, and your units are worth the fund\'s net asset value, published once each trading day by the AMC and collected by AMFI.',
      'Direct plans cut out distributor commission and cost less than regular plans for the identical portfolio — over decades that difference compounds into a substantial amount.',
    ],
    howToRead:
      'Judge a fund on mandate, cost and consistency, not on last year\'s return. Category matters more than the manager\'s recent record.',
    watchOut:
      'A fund cannot be called overvalued on a P/E basis the way a company can — it holds dozens of companies. Plumbline deliberately excludes funds from valuation verdicts for that reason.',
    whereInApp: 'Search, portfolio holdings, watchlist, and Groww statement imports. NAVs come from AMFI daily, no API key needed.',
    related: ['etf', 'nav', 'expense-ratio'],
  },
  {
    slug: 'etf',
    title: 'ETFs',
    category: 'Instruments',
    oneLiner: 'A fund that trades on an exchange like a share.',
    body: [
      'An ETF holds a basket — usually tracking an index — but trades continuously on the exchange rather than being priced once a day. You buy and sell it through your broker at a live price.',
      'Because most ETFs track an index rather than picking stocks, they are typically far cheaper to own than an actively managed fund.',
    ],
    howToRead: 'Look at the tracking difference and the trading spread, not just the expense ratio.',
    watchOut:
      'A thinly traded ETF can trade away from the value of what it holds. In Indian markets some ETFs have wide spreads that quietly cost more than the expense ratio saves.',
    whereInApp:
      'ETFs behave as exchange-listed instruments here, so they import from a broker and price like a stock — SILVERAXIS in a Groww sync is an example.',
    related: ['mutual-fund', 'nav'],
  },
  {
    slug: 'nav',
    title: 'Net asset value',
    category: 'Instruments',
    oneLiner: 'What one unit of a fund is worth.',
    formula: '(Value of everything the fund holds − its liabilities) ÷ units outstanding',
    body: [
      'NAV is a fund\'s price per unit, published once per trading day. Unlike a share price it is not set by supply and demand for the fund itself — it is simply the value of the underlying holdings divided up.',
      'A NAV of ₹320 is not "expensive" against one of ₹32. It reflects how long the fund has existed and how it has compounded, nothing more.',
    ],
    howToRead: 'Only the percentage change matters. The absolute NAV carries no information about value.',
    watchOut:
      'People routinely pick funds with low NAVs believing they are cheaper. They are not — you simply get more units of a smaller value each.',
    whereInApp: 'Fund holdings in your portfolio, watchlist rows and search results, dated to the AMFI publication.',
    related: ['mutual-fund', 'etf'],
  },
  {
    slug: 'expense-ratio',
    title: 'Expense ratio',
    category: 'Instruments',
    oneLiner: 'The annual percentage a fund charges to run itself.',
    body: [
      'The expense ratio is deducted from the fund\'s assets before the NAV is published, so you never see it as a charge — it simply makes the return slightly lower every single day.',
      'A 1% difference sounds trivial. Over 20 years on a growing balance it commonly costs a fifth of the final amount.',
    ],
    howToRead: 'Compare within a category. Index funds should be very cheap; active equity funds cost more and must justify it.',
    watchOut: 'Regular plans embed distributor commission. The direct plan of the same scheme holds identical assets for less.',
    whereInApp: 'Not yet shown — AMFI\'s daily NAV file does not carry expense ratios.',
    related: ['mutual-fund', 'nav'],
  },
  {
    slug: 'xirr',
    title: 'XIRR',
    category: 'Returns',
    oneLiner: 'The annualised return on money that went in at different times.',
    body: [
      'If you invest a lump sum and it grows, a simple annual return describes it fine. If you invest monthly through a SIP, it does not — each instalment has been invested for a different length of time.',
      'XIRR solves for the single annual rate that makes every dated cash flow reconcile with what the holding is worth today. It is the return you actually earned.',
    ],
    howToRead:
      'XIRR is the honest number for any staggered investment. On one Plumbline test portfolio a six-month SIP showed 21.09% XIRR against 11.74% by averaged cost — the averaged figure was badly understating it.',
    watchOut:
      'XIRR needs a real transaction history. A holding entered as a single average cost has only two cash flows, so its XIRR and its simple CAGR agree by definition.',
    whereInApp: 'Portfolio summary and per holding, once you record transactions or import a broker statement.',
    related: ['cagr', 'fifo'],
  },
  {
    slug: 'cagr',
    title: 'CAGR',
    category: 'Returns',
    oneLiner: 'The smooth annual rate that gets you from start value to end value.',
    formula: '(End ÷ Start)^(1 ÷ years) − 1',
    body: [
      'CAGR describes the constant yearly rate that would have produced the same result. It smooths away everything that happened in between.',
      'It is the right measure for a single investment held over a period, and the wrong one for anything you added to along the way.',
    ],
    howToRead: 'Use it to compare one-off investments across different holding periods.',
    watchOut:
      'CAGR hides the path. Two investments with identical CAGR can feel completely different — one steady, one halving before recovering.',
    whereInApp: 'Portfolio and holdings, shown when there is no transaction history to compute XIRR from.',
    related: ['xirr'],
  },
  {
    slug: 'fifo',
    title: 'FIFO and realised gains',
    category: 'Returns',
    oneLiner: 'When you sell part of a holding, the oldest units are treated as sold first.',
    body: [
      'If you bought 10 shares at ₹100, 10 more at ₹120, then sold 15, which did you sell? First in, first out says the 10 oldest plus 5 of the next — giving a realised gain measured against ₹100 and ₹120 respectively.',
      'Indian capital gains reporting assumes FIFO, so matching it means your realised gains reconcile with your broker\'s tax statement.',
    ],
    howToRead:
      'Realised gain is booked profit from units you sold. Unrealised is paper profit on what you still hold. They are different things and tax treats them differently.',
    watchOut:
      'Your average cost changes after a partial sale, because the remaining units are the more recently bought ones. This surprises people looking at a portfolio after selling.',
    whereInApp: 'Portfolio realised P&L, and every holding built from recorded transactions.',
    related: ['xirr'],
  },
];

export const LEARN_CATEGORIES = ['Valuation', 'Profitability', 'Risk', 'Returns', 'Instruments'] as const;

export function findEntry(slug: string): LearnEntry | undefined {
  return LEARN_ENTRIES.find((entry) => entry.slug === slug);
}
