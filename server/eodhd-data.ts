const EODHD_BASE = "https://eodhd.com/api";
const API_TOKEN = process.env.EODHD_API_KEY || "";
const CACHE_TTL = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 12000;
const DAILY_CALL_LIMIT = 20;
const RATE_LIMIT_PER_MINUTE = 20;
const RATE_WINDOW_MS = 60 * 1000;

function safeNum(val: any): number {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return typeof n === "number" && !isNaN(n) ? n : 0;
}

function safeFix(val: any, digits = 2): string {
  return safeNum(val).toFixed(digits);
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

let dailyCallCount = 0;
let dailyResetDate = getTodayDateString();
const minuteCallTimestamps: number[] = [];

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

function checkAndResetDaily(): void {
  const today = getTodayDateString();
  if (today !== dailyResetDate) {
    dailyCallCount = 0;
    dailyResetDate = today;
    console.log(`[EODHD] Daily call counter reset for ${today}`);
  }
}

function pruneMinuteWindow(): void {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  while (minuteCallTimestamps.length > 0 && minuteCallTimestamps[0] < cutoff) {
    minuteCallTimestamps.shift();
  }
}

function canMakeCall(): boolean {
  checkAndResetDaily();
  if (dailyCallCount >= DAILY_CALL_LIMIT) return false;
  pruneMinuteWindow();
  if (minuteCallTimestamps.length >= RATE_LIMIT_PER_MINUTE) return false;
  return true;
}

function recordCall(): void {
  checkAndResetDaily();
  dailyCallCount++;
  minuteCallTimestamps.push(Date.now());
  const remaining = DAILY_CALL_LIMIT - dailyCallCount;
  if (remaining <= 5) {
    console.log(`[EODHD] API call used (${dailyCallCount}/${DAILY_CALL_LIMIT}). ${remaining} remaining today.`);
  }
}

export function getUsageStats(): { used: number; limit: number; remaining: number; resetDate: string } {
  checkAndResetDaily();
  return {
    used: dailyCallCount,
    limit: DAILY_CALL_LIMIT,
    remaining: DAILY_CALL_LIMIT - dailyCallCount,
    resetDate: dailyResetDate,
  };
}

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

async function fetchEODHD(url: string): Promise<any> {
  if (!canMakeCall()) {
    const stats = getUsageStats();
    console.log(`[EODHD] Daily limit reached (${stats.used}/${stats.limit}). Skipping API call.`);
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const separator = url.includes("?") ? "&" : "?";
    const fullUrl = `${url}${separator}api_token=${API_TOKEN}&fmt=json`;
    const response = await fetch(fullUrl, { signal: controller.signal });
    recordCall();
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export interface EODHDFundamentals {
  General?: {
    Code?: string;
    Name?: string;
    Exchange?: string;
    CurrencyCode?: string;
    Sector?: string;
    Industry?: string;
    Description?: string;
    MarketCapitalization?: number;
    [key: string]: any;
  };
  Highlights?: {
    MarketCapitalization?: number;
    EBITDA?: number;
    PERatio?: number;
    PEGRatio?: number;
    WallStreetTargetPrice?: number;
    BookValue?: number;
    DividendShare?: number;
    DividendYield?: number;
    EarningsShare?: number;
    EPSEstimateCurrentYear?: number;
    EPSEstimateNextYear?: number;
    MostRecentQuarter?: string;
    ProfitMargin?: number;
    OperatingMarginTTM?: number;
    ReturnOnAssetsTTM?: number;
    ReturnOnEquityTTM?: number;
    RevenueTTM?: number;
    RevenuePerShareTTM?: number;
    GrossProfitTTM?: number;
    DilutedEpsTTM?: number;
    QuarterlyEarningsGrowthYOY?: number;
    QuarterlyRevenueGrowthYOY?: number;
    [key: string]: any;
  };
  Valuation?: {
    TrailingPE?: number;
    ForwardPE?: number;
    PriceSalesTTM?: number;
    PriceBookMRQ?: number;
    EnterpriseValue?: number;
    EnterpriseValueRevenue?: number;
    EnterpriseValueEbitda?: number;
    [key: string]: any;
  };
  Financials?: {
    Income_Statement?: { yearly?: Record<string, any>; quarterly?: Record<string, any> };
    Balance_Sheet?: { yearly?: Record<string, any>; quarterly?: Record<string, any> };
    Cash_Flow?: { yearly?: Record<string, any>; quarterly?: Record<string, any> };
  };
  [key: string]: any;
}

export interface EODHDQuote {
  code: string;
  timestamp: number;
  gmtoffset: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  previousClose: number;
  change: number;
  change_p: number;
}

export interface EODHDNewsItem {
  date: string;
  title: string;
  content: string;
  link: string;
  symbols: string[];
  tags: string[];
  sentiment?: { polarity: number; neg: number; neu: number; pos: number };
}

export function isConfigured(): boolean {
  return !!API_TOKEN;
}

export async function getFundamentals(_ticker: string): Promise<EODHDFundamentals | null> {
  return null;
}

export async function getRealTimeQuote(ticker: string): Promise<EODHDQuote | null> {
  if (!API_TOKEN) return null;
  const cacheKey = `eodhd:quote:${ticker}`;
  const cached = getCached<EODHDQuote>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchEODHD(`${EODHD_BASE}/real-time/${ticker}.US`);
    if (data && data.close) {
      setCache(cacheKey, data);
      return data;
    }
    return null;
  } catch (error) {
    console.error(`[EODHD] Real-time quote error for ${ticker}:`, error);
    return null;
  }
}

export async function getNews(ticker: string, limit: number = 5): Promise<EODHDNewsItem[]> {
  if (!API_TOKEN) return [];
  const cacheKey = `eodhd:news:${ticker}:${limit}`;
  const cached = getCached<EODHDNewsItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchEODHD(`${EODHD_BASE}/news?s=${ticker}.US&limit=${limit}&offset=0`);
    if (Array.isArray(data)) {
      setCache(cacheKey, data);
      return data;
    }
    return [];
  } catch (error) {
    console.error(`[EODHD] News error for ${ticker}:`, error);
    return [];
  }
}

export async function getHistoricalPrices(
  ticker: string,
  period: "d" | "w" | "m" = "d",
  fromDate?: string,
  toDate?: string
): Promise<Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>> {
  if (!API_TOKEN) return [];
  const today = new Date().toISOString().split("T")[0];
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  let from = fromDate || oneYearAgo;
  const to = toDate || today;
  if (from < oneYearAgo) {
    from = oneYearAgo;
  }
  const cacheKey = `eodhd:eod:${ticker}:${period}:${from}:${to}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchEODHD(`${EODHD_BASE}/eod/${ticker}.US?from=${from}&to=${to}&period=${period}`);
    if (Array.isArray(data)) {
      setCache(cacheKey, data);
      return data;
    }
    return [];
  } catch (error) {
    console.error(`[EODHD] Historical prices error for ${ticker}:`, error);
    return [];
  }
}

export function formatFundamentalsForAI(fundamentals: EODHDFundamentals): string {
  const parts: string[] = [];
  const g = fundamentals.General;
  const h = fundamentals.Highlights;
  const v = fundamentals.Valuation;

  if (g) {
    parts.push(`## ${g.Name} (${g.Code})`);
    parts.push(`**Sector:** ${g.Sector || "N/A"} | **Industry:** ${g.Industry || "N/A"}`);
    if (g.Description) {
      parts.push(`**Description:** ${g.Description.slice(0, 300)}...`);
    }
  }

  if (h) {
    parts.push("\n### Key Highlights");
    if (h.MarketCapitalization) parts.push(`- Market Cap: $${safeFix(safeNum(h.MarketCapitalization) / 1e9)}B`);
    if (h.RevenueTTM) parts.push(`- Revenue (TTM): $${safeFix(safeNum(h.RevenueTTM) / 1e9)}B`);
    if (h.EBITDA) parts.push(`- EBITDA: $${safeFix(safeNum(h.EBITDA) / 1e9)}B`);
    if (h.GrossProfitTTM) parts.push(`- Gross Profit (TTM): $${safeFix(safeNum(h.GrossProfitTTM) / 1e9)}B`);
    if (h.DilutedEpsTTM) parts.push(`- EPS (Diluted TTM): $${safeFix(h.DilutedEpsTTM)}`);
    if (h.PERatio) parts.push(`- P/E Ratio: ${safeFix(h.PERatio)}`);
    if (h.PEGRatio) parts.push(`- PEG Ratio: ${safeFix(h.PEGRatio)}`);
    if (h.DividendYield) parts.push(`- Dividend Yield: ${safeFix(safeNum(h.DividendYield) * 100)}%`);
    if (h.ProfitMargin) parts.push(`- Profit Margin: ${safeFix(safeNum(h.ProfitMargin) * 100)}%`);
    if (h.OperatingMarginTTM) parts.push(`- Operating Margin (TTM): ${safeFix(safeNum(h.OperatingMarginTTM) * 100)}%`);
    if (h.ReturnOnEquityTTM) parts.push(`- ROE (TTM): ${safeFix(safeNum(h.ReturnOnEquityTTM) * 100)}%`);
    if (h.ReturnOnAssetsTTM) parts.push(`- ROA (TTM): ${safeFix(safeNum(h.ReturnOnAssetsTTM) * 100)}%`);
    if (h.QuarterlyRevenueGrowthYOY) parts.push(`- Revenue Growth (QoQ YoY): ${safeFix(safeNum(h.QuarterlyRevenueGrowthYOY) * 100)}%`);
    if (h.QuarterlyEarningsGrowthYOY) parts.push(`- Earnings Growth (QoQ YoY): ${safeFix(safeNum(h.QuarterlyEarningsGrowthYOY) * 100)}%`);
    if (h.WallStreetTargetPrice) parts.push(`- Analyst Target Price: $${safeFix(h.WallStreetTargetPrice)}`);
  }

  if (v) {
    parts.push("\n### Valuation Metrics");
    if (v.TrailingPE) parts.push(`- Trailing P/E: ${safeFix(v.TrailingPE)}`);
    if (v.ForwardPE) parts.push(`- Forward P/E: ${safeFix(v.ForwardPE)}`);
    if (v.PriceSalesTTM) parts.push(`- Price/Sales (TTM): ${safeFix(v.PriceSalesTTM)}`);
    if (v.PriceBookMRQ) parts.push(`- Price/Book (MRQ): ${safeFix(v.PriceBookMRQ)}`);
    if (v.EnterpriseValue) parts.push(`- Enterprise Value: $${safeFix(safeNum(v.EnterpriseValue) / 1e9)}B`);
    if (v.EnterpriseValueRevenue) parts.push(`- EV/Revenue: ${safeFix(v.EnterpriseValueRevenue)}`);
    if (v.EnterpriseValueEbitda) parts.push(`- EV/EBITDA: ${safeFix(v.EnterpriseValueEbitda)}`);
  }

  return parts.join("\n");
}

export function formatQuoteForAI(quote: EODHDQuote): string {
  const close = safeNum(quote.close);
  const change = safeNum(quote.change);
  const change_p = safeNum(quote.change_p);
  const open = safeNum(quote.open);
  const high = safeNum(quote.high);
  const low = safeNum(quote.low);
  const volume = safeNum(quote.volume);
  return `**Live Price:** $${close.toFixed(2)} (${change >= 0 ? "+" : ""}${change.toFixed(2)}, ${change_p >= 0 ? "+" : ""}${change_p.toFixed(2)}%) | Open: $${open.toFixed(2)} | High: $${high.toFixed(2)} | Low: $${low.toFixed(2)} | Vol: ${(volume / 1e6).toFixed(2)}M`;
}

export function formatNewsForAI(news: EODHDNewsItem[]): string {
  if (news.length === 0) return "";
  const items = news.slice(0, 5).map((n, i) => {
    const date = new Date(n.date).toLocaleDateString();
    const sentiment = n.sentiment
      ? ` (Sentiment: ${n.sentiment.polarity > 0.1 ? "Positive" : n.sentiment.polarity < -0.1 ? "Negative" : "Neutral"})`
      : "";
    return `${i + 1}. **${n.title}** (${date})${sentiment}\n   ${n.content.slice(0, 150)}...`;
  });
  return `## Recent News\n\n${items.join("\n\n")}`;
}
