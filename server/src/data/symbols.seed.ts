import { EXCHANGE_MARKET, MARKET_CURRENCY, type Currency, type Exchange, type Market } from '../types/market.js';

type SeedTuple = [
  symbol: string,
  name: string,
  exchange: Exchange,
  sector: string,
  industry: string,
  referencePrice: number,
  marketCap: number,
];

export interface SeedSymbol {
  symbol: string;
  name: string;
  exchange: Exchange;
  market: Market;
  currency: Currency;
  sector: string;
  industry: string;
  referencePrice: number;
  marketCap: number;
  popular: boolean;
}

const INDIA: SeedTuple[] = [
  ['RELIANCE', 'Reliance Industries Ltd', 'NSE', 'Energy', 'Oil & Gas Refining', 1412, 19_100_000_000_000],
  ['TCS', 'Tata Consultancy Services Ltd', 'NSE', 'Technology', 'IT Services', 3985, 14_400_000_000_000],
  ['HDFCBANK', 'HDFC Bank Ltd', 'NSE', 'Financials', 'Private Banks', 1742, 13_300_000_000_000],
  ['ICICIBANK', 'ICICI Bank Ltd', 'NSE', 'Financials', 'Private Banks', 1288, 9_050_000_000_000],
  ['INFY', 'Infosys Ltd', 'NSE', 'Technology', 'IT Services', 1832, 7_600_000_000_000],
  ['BHARTIARTL', 'Bharti Airtel Ltd', 'NSE', 'Communication', 'Telecom Services', 1654, 9_800_000_000_000],
  ['HINDUNILVR', 'Hindustan Unilever Ltd', 'NSE', 'Consumer Staples', 'Household Products', 2465, 5_790_000_000_000],
  ['ITC', 'ITC Ltd', 'NSE', 'Consumer Staples', 'Tobacco & Foods', 452, 5_650_000_000_000],
  ['SBIN', 'State Bank of India', 'NSE', 'Financials', 'Public Banks', 812, 7_250_000_000_000],
  ['BAJFINANCE', 'Bajaj Finance Ltd', 'NSE', 'Financials', 'Consumer Finance', 7180, 4_440_000_000_000],
  ['LICI', 'Life Insurance Corporation of India', 'NSE', 'Financials', 'Life Insurance', 942, 5_960_000_000_000],
  ['KOTAKBANK', 'Kotak Mahindra Bank Ltd', 'NSE', 'Financials', 'Private Banks', 1795, 3_570_000_000_000],
  ['LT', 'Larsen & Toubro Ltd', 'NSE', 'Industrials', 'Engineering & Construction', 3620, 4_980_000_000_000],
  ['HCLTECH', 'HCL Technologies Ltd', 'NSE', 'Technology', 'IT Services', 1745, 4_730_000_000_000],
  ['AXISBANK', 'Axis Bank Ltd', 'NSE', 'Financials', 'Private Banks', 1128, 3_490_000_000_000],
  ['MARUTI', 'Maruti Suzuki India Ltd', 'NSE', 'Consumer Discretionary', 'Automobiles', 11_840, 3_720_000_000_000],
  ['ASIANPAINT', 'Asian Paints Ltd', 'NSE', 'Materials', 'Paints & Coatings', 2410, 2_310_000_000_000],
  ['SUNPHARMA', 'Sun Pharmaceutical Industries Ltd', 'NSE', 'Healthcare', 'Pharmaceuticals', 1712, 4_110_000_000_000],
  ['TITAN', 'Titan Company Ltd', 'NSE', 'Consumer Discretionary', 'Jewellery & Watches', 3455, 3_070_000_000_000],
  ['ULTRACEMCO', 'UltraTech Cement Ltd', 'NSE', 'Materials', 'Cement', 11_260, 3_310_000_000_000],
  ['ONGC', 'Oil & Natural Gas Corporation Ltd', 'NSE', 'Energy', 'Oil & Gas Exploration', 246, 3_100_000_000_000],
  ['NTPC', 'NTPC Ltd', 'NSE', 'Utilities', 'Power Generation', 342, 3_320_000_000_000],
  ['NESTLEIND', 'Nestle India Ltd', 'NSE', 'Consumer Staples', 'Packaged Foods', 2285, 2_200_000_000_000],
  ['WIPRO', 'Wipro Ltd', 'NSE', 'Technology', 'IT Services', 285, 2_980_000_000_000],
  ['ADANIENT', 'Adani Enterprises Ltd', 'NSE', 'Industrials', 'Diversified Holdings', 2410, 2_780_000_000_000],
  ['ADANIPORTS', 'Adani Ports & SEZ Ltd', 'NSE', 'Industrials', 'Marine Ports', 1385, 2_990_000_000_000],
  ['POWERGRID', 'Power Grid Corporation of India Ltd', 'NSE', 'Utilities', 'Power Transmission', 288, 2_680_000_000_000],
  ['M&M', 'Mahindra & Mahindra Ltd', 'NSE', 'Consumer Discretionary', 'Automobiles', 3125, 3_880_000_000_000],
  ['TATAMOTORS', 'Tata Motors Ltd', 'NSE', 'Consumer Discretionary', 'Automobiles', 712, 2_620_000_000_000],
  ['TATASTEEL', 'Tata Steel Ltd', 'NSE', 'Materials', 'Steel', 168, 2_100_000_000_000],
  ['JSWSTEEL', 'JSW Steel Ltd', 'NSE', 'Materials', 'Steel', 1042, 2_550_000_000_000],
  ['COALINDIA', 'Coal India Ltd', 'NSE', 'Energy', 'Thermal Coal', 398, 2_450_000_000_000],
  ['BAJAJFINSV', 'Bajaj Finserv Ltd', 'NSE', 'Financials', 'Diversified Financials', 1985, 3_170_000_000_000],
  ['HDFCLIFE', 'HDFC Life Insurance Company Ltd', 'NSE', 'Financials', 'Life Insurance', 742, 1_600_000_000_000],
  ['SBILIFE', 'SBI Life Insurance Company Ltd', 'NSE', 'Financials', 'Life Insurance', 1685, 1_690_000_000_000],
  ['GRASIM', 'Grasim Industries Ltd', 'NSE', 'Materials', 'Diversified Chemicals', 2680, 1_820_000_000_000],
  ['TECHM', 'Tech Mahindra Ltd', 'NSE', 'Technology', 'IT Services', 1590, 1_560_000_000_000],
  ['INDUSINDBK', 'IndusInd Bank Ltd', 'NSE', 'Financials', 'Private Banks', 985, 767_000_000_000],
  ['DRREDDY', "Dr. Reddy's Laboratories Ltd", 'NSE', 'Healthcare', 'Pharmaceuticals', 1265, 1_050_000_000_000],
  ['CIPLA', 'Cipla Ltd', 'NSE', 'Healthcare', 'Pharmaceuticals', 1512, 1_220_000_000_000],
  ['DIVISLAB', "Divi's Laboratories Ltd", 'NSE', 'Healthcare', 'Pharmaceuticals', 5980, 1_580_000_000_000],
  ['BRITANNIA', 'Britannia Industries Ltd', 'NSE', 'Consumer Staples', 'Packaged Foods', 5420, 1_300_000_000_000],
  ['EICHERMOT', 'Eicher Motors Ltd', 'NSE', 'Consumer Discretionary', 'Automobiles', 5480, 1_500_000_000_000],
  ['HEROMOTOCO', 'Hero MotoCorp Ltd', 'NSE', 'Consumer Discretionary', 'Two Wheelers', 4320, 863_000_000_000],
  ['BAJAJ-AUTO', 'Bajaj Auto Ltd', 'NSE', 'Consumer Discretionary', 'Two Wheelers', 8620, 2_410_000_000_000],
  ['APOLLOHOSP', 'Apollo Hospitals Enterprise Ltd', 'NSE', 'Healthcare', 'Hospitals', 7180, 1_030_000_000_000],
  ['TATACONSUM', 'Tata Consumer Products Ltd', 'NSE', 'Consumer Staples', 'Packaged Foods', 1085, 1_070_000_000_000],
  ['BPCL', 'Bharat Petroleum Corporation Ltd', 'NSE', 'Energy', 'Oil Marketing', 328, 1_420_000_000_000],
  ['IOC', 'Indian Oil Corporation Ltd', 'NSE', 'Energy', 'Oil Marketing', 142, 2_000_000_000_000],
  ['DMART', 'Avenue Supermarts Ltd', 'NSE', 'Consumer Staples', 'Retail', 4180, 2_720_000_000_000],
  ['ZOMATO', 'Eternal Ltd (Zomato)', 'NSE', 'Consumer Discretionary', 'Internet Retail', 268, 2_360_000_000_000],
  ['PAYTM', 'One97 Communications Ltd', 'NSE', 'Technology', 'Fintech', 985, 628_000_000_000],
  ['IRCTC', 'Indian Railway Catering & Tourism Corp Ltd', 'NSE', 'Consumer Discretionary', 'Travel Services', 782, 626_000_000_000],
  ['DLF', 'DLF Ltd', 'NSE', 'Real Estate', 'Real Estate Development', 745, 1_840_000_000_000],
  ['PIDILITIND', 'Pidilite Industries Ltd', 'NSE', 'Materials', 'Specialty Chemicals', 2985, 1_520_000_000_000],
  ['HAL', 'Hindustan Aeronautics Ltd', 'NSE', 'Industrials', 'Aerospace & Defence', 4380, 2_930_000_000_000],
  ['BEL', 'Bharat Electronics Ltd', 'NSE', 'Industrials', 'Aerospace & Defence', 385, 2_810_000_000_000],
  ['VEDL', 'Vedanta Ltd', 'NSE', 'Materials', 'Diversified Metals', 462, 1_810_000_000_000],
  ['SIEMENS', 'Siemens Ltd', 'NSE', 'Industrials', 'Electrical Equipment', 5420, 1_930_000_000_000],
  ['TRENT', 'Trent Ltd', 'NSE', 'Consumer Discretionary', 'Apparel Retail', 5680, 2_020_000_000_000],
  ['RELIANCE', 'Reliance Industries Ltd', 'BSE', 'Energy', 'Oil & Gas Refining', 1413, 19_100_000_000_000],
  ['TCS', 'Tata Consultancy Services Ltd', 'BSE', 'Technology', 'IT Services', 3986, 14_400_000_000_000],
  ['INFY', 'Infosys Ltd', 'BSE', 'Technology', 'IT Services', 1833, 7_600_000_000_000],
  ['HDFCBANK', 'HDFC Bank Ltd', 'BSE', 'Financials', 'Private Banks', 1743, 13_300_000_000_000],
  ['SBIN', 'State Bank of India', 'BSE', 'Financials', 'Public Banks', 813, 7_250_000_000_000],
];

const US: SeedTuple[] = [
  ['AAPL', 'Apple Inc.', 'NASDAQ', 'Technology', 'Consumer Electronics', 232, 3_520_000_000_000],
  ['MSFT', 'Microsoft Corporation', 'NASDAQ', 'Technology', 'Software Infrastructure', 428, 3_180_000_000_000],
  ['NVDA', 'NVIDIA Corporation', 'NASDAQ', 'Technology', 'Semiconductors', 138, 3_390_000_000_000],
  ['GOOGL', 'Alphabet Inc. Class A', 'NASDAQ', 'Communication', 'Internet Content', 178, 2_180_000_000_000],
  ['AMZN', 'Amazon.com Inc.', 'NASDAQ', 'Consumer Discretionary', 'Internet Retail', 205, 2_150_000_000_000],
  ['META', 'Meta Platforms Inc.', 'NASDAQ', 'Communication', 'Internet Content', 585, 1_480_000_000_000],
  ['TSLA', 'Tesla Inc.', 'NASDAQ', 'Consumer Discretionary', 'Automobiles', 248, 792_000_000_000],
  ['AVGO', 'Broadcom Inc.', 'NASDAQ', 'Technology', 'Semiconductors', 172, 803_000_000_000],
  ['BRK.B', 'Berkshire Hathaway Inc. Class B', 'NYSE', 'Financials', 'Diversified Holdings', 462, 995_000_000_000],
  ['JPM', 'JPMorgan Chase & Co.', 'NYSE', 'Financials', 'Diversified Banks', 228, 642_000_000_000],
  ['V', 'Visa Inc.', 'NYSE', 'Financials', 'Payment Networks', 292, 562_000_000_000],
  ['MA', 'Mastercard Incorporated', 'NYSE', 'Financials', 'Payment Networks', 512, 472_000_000_000],
  ['UNH', 'UnitedHealth Group Incorporated', 'NYSE', 'Healthcare', 'Managed Care', 562, 517_000_000_000],
  ['XOM', 'Exxon Mobil Corporation', 'NYSE', 'Energy', 'Integrated Oil & Gas', 118, 521_000_000_000],
  ['JNJ', 'Johnson & Johnson', 'NYSE', 'Healthcare', 'Pharmaceuticals', 158, 380_000_000_000],
  ['WMT', 'Walmart Inc.', 'NYSE', 'Consumer Staples', 'Discount Stores', 82, 660_000_000_000],
  ['PG', 'Procter & Gamble Company', 'NYSE', 'Consumer Staples', 'Household Products', 168, 396_000_000_000],
  ['LLY', 'Eli Lilly and Company', 'NYSE', 'Healthcare', 'Pharmaceuticals', 812, 771_000_000_000],
  ['HD', 'Home Depot Inc.', 'NYSE', 'Consumer Discretionary', 'Home Improvement Retail', 395, 392_000_000_000],
  ['CVX', 'Chevron Corporation', 'NYSE', 'Energy', 'Integrated Oil & Gas', 152, 279_000_000_000],
  ['ABBV', 'AbbVie Inc.', 'NYSE', 'Healthcare', 'Biotechnology', 178, 314_000_000_000],
  ['KO', 'Coca-Cola Company', 'NYSE', 'Consumer Staples', 'Soft Drinks', 68, 293_000_000_000],
  ['PEP', 'PepsiCo Inc.', 'NASDAQ', 'Consumer Staples', 'Soft Drinks', 165, 227_000_000_000],
  ['COST', 'Costco Wholesale Corporation', 'NASDAQ', 'Consumer Staples', 'Warehouse Clubs', 912, 405_000_000_000],
  ['MRK', 'Merck & Co. Inc.', 'NYSE', 'Healthcare', 'Pharmaceuticals', 102, 258_000_000_000],
  ['ADBE', 'Adobe Inc.', 'NASDAQ', 'Technology', 'Application Software', 512, 226_000_000_000],
  ['CRM', 'Salesforce Inc.', 'NYSE', 'Technology', 'Application Software', 318, 305_000_000_000],
  ['AMD', 'Advanced Micro Devices Inc.', 'NASDAQ', 'Technology', 'Semiconductors', 142, 230_000_000_000],
  ['NFLX', 'Netflix Inc.', 'NASDAQ', 'Communication', 'Streaming Entertainment', 892, 381_000_000_000],
  ['CSCO', 'Cisco Systems Inc.', 'NASDAQ', 'Technology', 'Networking Equipment', 58, 232_000_000_000],
  ['TMO', 'Thermo Fisher Scientific Inc.', 'NYSE', 'Healthcare', 'Life Sciences Tools', 528, 202_000_000_000],
  ['ACN', 'Accenture plc', 'NYSE', 'Technology', 'IT Services', 348, 218_000_000_000],
  ['MCD', "McDonald's Corporation", 'NYSE', 'Consumer Discretionary', 'Restaurants', 292, 209_000_000_000],
  ['ABT', 'Abbott Laboratories', 'NYSE', 'Healthcare', 'Medical Devices', 118, 205_000_000_000],
  ['INTC', 'Intel Corporation', 'NASDAQ', 'Technology', 'Semiconductors', 22, 95_000_000_000],
  ['QCOM', 'QUALCOMM Incorporated', 'NASDAQ', 'Technology', 'Semiconductors', 165, 183_000_000_000],
  ['TXN', 'Texas Instruments Incorporated', 'NASDAQ', 'Technology', 'Semiconductors', 198, 181_000_000_000],
  ['DIS', 'Walt Disney Company', 'NYSE', 'Communication', 'Entertainment', 96, 174_000_000_000],
  ['PFE', 'Pfizer Inc.', 'NYSE', 'Healthcare', 'Pharmaceuticals', 26, 147_000_000_000],
  ['VZ', 'Verizon Communications Inc.', 'NYSE', 'Communication', 'Telecom Services', 42, 177_000_000_000],
  ['INTU', 'Intuit Inc.', 'NASDAQ', 'Technology', 'Application Software', 628, 176_000_000_000],
  ['IBM', 'International Business Machines Corp.', 'NYSE', 'Technology', 'IT Services', 218, 202_000_000_000],
  ['GE', 'GE Aerospace', 'NYSE', 'Industrials', 'Aerospace & Defence', 182, 197_000_000_000],
  ['CAT', 'Caterpillar Inc.', 'NYSE', 'Industrials', 'Construction Machinery', 385, 186_000_000_000],
  ['BA', 'Boeing Company', 'NYSE', 'Industrials', 'Aerospace & Defence', 152, 114_000_000_000],
  ['NKE', 'NIKE Inc.', 'NYSE', 'Consumer Discretionary', 'Footwear & Apparel', 78, 116_000_000_000],
  ['GS', 'Goldman Sachs Group Inc.', 'NYSE', 'Financials', 'Investment Banking', 512, 162_000_000_000],
  ['MS', 'Morgan Stanley', 'NYSE', 'Financials', 'Investment Banking', 118, 190_000_000_000],
  ['BLK', 'BlackRock Inc.', 'NYSE', 'Financials', 'Asset Management', 962, 143_000_000_000],
  ['SBUX', 'Starbucks Corporation', 'NASDAQ', 'Consumer Discretionary', 'Restaurants', 98, 111_000_000_000],
  ['UBER', 'Uber Technologies Inc.', 'NYSE', 'Industrials', 'Ride Hailing', 72, 151_000_000_000],
  ['PYPL', 'PayPal Holdings Inc.', 'NASDAQ', 'Financials', 'Payment Processing', 82, 84_000_000_000],
  ['SHOP', 'Shopify Inc.', 'NYSE', 'Technology', 'E-commerce Software', 92, 118_000_000_000],
  ['PLTR', 'Palantir Technologies Inc.', 'NASDAQ', 'Technology', 'Data Analytics Software', 68, 154_000_000_000],
  ['COIN', 'Coinbase Global Inc.', 'NASDAQ', 'Financials', 'Crypto Exchanges', 245, 61_000_000_000],
  ['SNOW', 'Snowflake Inc.', 'NYSE', 'Technology', 'Data Cloud Software', 132, 44_000_000_000],
  ['ORCL', 'Oracle Corporation', 'NYSE', 'Technology', 'Software Infrastructure', 172, 476_000_000_000],
  ['MU', 'Micron Technology Inc.', 'NASDAQ', 'Technology', 'Semiconductors', 102, 113_000_000_000],
  ['ARM', 'Arm Holdings plc', 'NASDAQ', 'Technology', 'Semiconductors', 138, 145_000_000_000],
  ['NOW', 'ServiceNow Inc.', 'NYSE', 'Technology', 'Application Software', 962, 198_000_000_000],
];

function expand(tuples: SeedTuple[]): SeedSymbol[] {
  return tuples.map(([symbol, name, exchange, sector, industry, referencePrice, marketCap]) => {
    const market = EXCHANGE_MARKET[exchange];
    return {
      symbol,
      name,
      exchange,
      market,
      currency: MARKET_CURRENCY[market],
      sector,
      industry,
      referencePrice,
      marketCap,
      popular: true,
    };
  });
}

export const SEED_SYMBOLS: SeedSymbol[] = [...expand(INDIA), ...expand(US)];

export const SEED_INDEX = new Map(SEED_SYMBOLS.map((entry) => [`${entry.exchange}:${entry.symbol}`, entry]));
