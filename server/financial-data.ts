const API_BASE = "https://api.financialdatasets.ai";
const API_KEY = process.env.FINANCIAL_DATASETS_API_KEY || "";
const CACHE_TTL = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 10000;

export interface IncomeStatement {
  ticker: string;
  report_period: string;
  period: string;
  revenue: number;
  cost_of_revenue: number;
  gross_profit: number;
  operating_expense: number;
  operating_income: number;
  net_income: number;
  eps_basic: number;
  eps_diluted: number;
  weighted_average_shares_outstanding: number;
  weighted_average_shares_outstanding_diluted: number;
  interest_expense: number;
  income_tax_expense: number;
  ebitda: number;
  research_and_development: number;
  selling_general_and_administrative: number;
  [key: string]: any;
}

export interface BalanceSheet {
  ticker: string;
  report_period: string;
  period: string;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  cash_and_equivalents: number;
  total_debt: number;
  current_assets: number;
  current_liabilities: number;
  shareholders_equity: number;
  retained_earnings: number;
  total_investments: number;
  inventory: number;
  accounts_receivable: number;
  accounts_payable: number;
  goodwill_and_intangible_assets: number;
  [key: string]: any;
}

export interface CashFlowStatement {
  ticker: string;
  report_period: string;
  period: string;
  operating_cash_flow: number;
  capital_expenditure: number;
  free_cash_flow: number;
  investing_cash_flow: number;
  financing_cash_flow: number;
  net_change_in_cash: number;
  dividends_paid: number;
  share_repurchase: number;
  depreciation_and_amortization: number;
  [key: string]: any;
}

export interface PriceSnapshot {
  ticker: string;
  price: number;
  day_change: number;
  day_change_percent: number;
  market_cap: number;
  time: string;
}

export interface FinancialData {
  income_statements: IncomeStatement[];
  balance_sheets: BalanceSheet[];
  cash_flow_statements: CashFlowStatement[];
}

export interface FinancialMetrics {
  ticker: string;
  period: string;
  report_period: string;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  revenueGrowth: number | null;
  netIncomeGrowth: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  freeCashFlowMargin: number | null;
  eps: number | null;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, {
      headers: { "X-API-KEY": API_KEY },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getFinancials(
  ticker: string,
  period: "annual" | "quarterly" = "annual",
  limit: number = 4
): Promise<FinancialData> {
  const cacheKey = `financials:${ticker}:${period}:${limit}`;
  const cached = getCached<FinancialData>(cacheKey);
  if (cached) return cached;

  const url = `${API_BASE}/financials/?ticker=${encodeURIComponent(ticker)}&period=${period}&limit=${limit}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Financial data API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const financials: FinancialData = {
    income_statements: json.financials?.income_statements || [],
    balance_sheets: json.financials?.balance_sheets || [],
    cash_flow_statements: json.financials?.cash_flow_statements || [],
  };

  setCache(cacheKey, financials);
  return financials;
}

export async function getPriceSnapshot(ticker: string): Promise<PriceSnapshot | null> {
  const cacheKey = `snapshot:${ticker}`;
  const cached = getCached<PriceSnapshot>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE}/prices/snapshot?ticker=${encodeURIComponent(ticker)}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) return null;

    const json = await response.json();
    const snapshot: PriceSnapshot | null = json.snapshot || null;

    if (snapshot) {
      setCache(cacheKey, snapshot);
    }
    return snapshot;
  } catch {
    return null;
  }
}

export async function getAvailableTickers(): Promise<string[]> {
  return [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B", "UNH", "JNJ",
    "V", "XOM", "JPM", "WMT", "MA", "PG", "LLY", "HD", "CVX", "MRK",
    "ABBV", "KO", "PEP", "AVGO", "COST", "TMO", "MCD", "CSCO", "ACN", "ABT",
    "CRM", "DHR", "NKE", "TXN", "NEE", "LIN", "BMY", "AMD", "UPS", "PM",
    "ORCL", "INTC", "QCOM", "LOW", "MS", "GS", "BA", "CAT", "DIS", "AMGN",
  ];
}

function safeDiv(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

export function calculateMetrics(financials: FinancialData): FinancialMetrics[] {
  const { income_statements, balance_sheets, cash_flow_statements } = financials;

  return income_statements.map((inc, i) => {
    const bs = balance_sheets.find(b => b.report_period === inc.report_period) || balance_sheets[i];
    const cf = cash_flow_statements.find(c => c.report_period === inc.report_period) || cash_flow_statements[i];
    const prevInc = income_statements[i + 1];

    const grossMargin = safeDiv(inc.gross_profit, inc.revenue);
    const operatingMargin = safeDiv(inc.operating_income, inc.revenue);
    const netMargin = safeDiv(inc.net_income, inc.revenue);

    let revenueGrowth: number | null = null;
    if (prevInc && prevInc.revenue && prevInc.revenue !== 0) {
      revenueGrowth = (inc.revenue - prevInc.revenue) / Math.abs(prevInc.revenue);
    }

    let netIncomeGrowth: number | null = null;
    if (prevInc && prevInc.net_income && prevInc.net_income !== 0) {
      netIncomeGrowth = (inc.net_income - prevInc.net_income) / Math.abs(prevInc.net_income);
    }

    const debtToEquity = bs ? safeDiv(bs.total_debt, bs.total_equity) : null;
    const currentRatio = bs ? safeDiv(bs.current_assets, bs.current_liabilities) : null;
    const returnOnEquity = bs ? safeDiv(inc.net_income, bs.total_equity) : null;
    const returnOnAssets = bs ? safeDiv(inc.net_income, bs.total_assets) : null;
    const freeCashFlowMargin = cf ? safeDiv(cf.free_cash_flow, inc.revenue) : null;

    return {
      ticker: inc.ticker,
      period: inc.period,
      report_period: inc.report_period,
      grossMargin,
      operatingMargin,
      netMargin,
      revenueGrowth,
      netIncomeGrowth,
      debtToEquity,
      currentRatio,
      returnOnEquity,
      returnOnAssets,
      freeCashFlowMargin,
      eps: inc.eps_diluted ?? inc.eps_basic ?? null,
    };
  });
}
