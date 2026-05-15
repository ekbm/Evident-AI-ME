import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Send,
  Loader2,
  TrendingUp,
  BarChart3,
  Star,
  GitCompare,
  ChevronDown,
  ChevronUp,
  Printer,
  Download,
  PenLine,
  UserPlus,
  Search,
  List,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface FinanceMessage {
  id: string;
  type: "question" | "answer";
  content: string;
  financialData?: {
    ticker?: string;
    companyName?: string;
    analysisType?: string;
    metrics?: any[];
    priceSnapshot?: any;
    dataUsed?: any;
    hybridMode?: boolean;
  };
  citations?: any[];
  evidencePreview?: any[];
}

interface FinanceQuerySectionProps {
  onAskFinance: (question: string) => void;
  isAsking: boolean;
  messages: FinanceMessage[];
  askError?: string;
  hasDocumentsSelected?: boolean;
}

const FINANCE_PROMPTS = [
  { title: "Profit Margins", prompt: "Analyse the profit margins including gross margin, operating margin, and net margin for ", needsCompany: true },
  { title: "Debt to Equity", prompt: "Calculate and analyse the debt-to-equity ratio, break down short-term vs long-term debt, and assess leverage risk for ", needsCompany: true },
  { title: "Quarterly Earnings", prompt: "Summarise the latest quarterly earnings including revenue, EPS, and year-over-year growth for ", needsCompany: true },
  { title: "Cash Flow Analysis", prompt: "Analyse the cash flow statement including operating, investing, and financing cash flows for ", needsCompany: true },
  { title: "Revenue Breakdown", prompt: "Break down revenue by segment, geography, and product line for ", needsCompany: true },
  { title: "Valuation Ratios", prompt: "Calculate key valuation ratios including P/E, P/S, P/B, and EV/EBITDA for ", needsCompany: true },
  { title: "Undervalued Screen", prompt: "Analyse whether this company appears undervalued using P/E, P/B, EV/EBITDA ratios, intrinsic value, and margin of safety for ", needsCompany: true },
  { title: "Full Breakdown", prompt: "Provide a comprehensive financial breakdown covering revenue, margins, balance sheet, cash flow, valuation, and key risks for ", needsCompany: true },
  { title: "Build Thesis", prompt: "Build a structured investment thesis with bull case, bear case, financial highlights, valuation assessment, and conviction level for ", needsCompany: true },
  { title: "Buy or Sell?", prompt: "Based on available financial data, provide a Buy, Hold, or Sell signal with valuation, growth, financial health, and risk analysis for ", needsCompany: true },
  { title: "Head-to-Head Comparison", prompt: "Compare the revenue, profit margins, valuation ratios, and financial health of Apple (AAPL) vs Microsoft (MSFT). Show a side-by-side breakdown.", needsCompany: false },
  { title: "Sector Showdown", prompt: "Compare the financials of Google (GOOGL) vs Meta (META). Analyse revenue growth, operating margins, R&D spend, and valuation multiples.", needsCompany: false },
  { title: "Growth vs Value", prompt: "Compare a high-growth company like Tesla (TSLA) against a value play like Johnson & Johnson (JNJ). Show growth rates, margins, debt levels, and valuation.", needsCompany: false },
  { title: "Custom Comparison", prompt: "Compare the revenue, margins, debt-to-equity, cash flow, and valuation of ", needsCompany: true },
  { title: "Dividend Champions", prompt: "Compare the dividend yields, payout ratios, and financial stability of Coca-Cola (KO), Procter & Gamble (PG), and Johnson & Johnson (JNJ).", needsCompany: false },
  { title: "FAANG Overview", prompt: "Provide a financial overview of all FAANG stocks (Meta, Apple, Amazon, Netflix, Google). Compare revenue, margins, and growth rates in a table.", needsCompany: false },
  { title: "EV Industry", prompt: "Compare the financials of Tesla (TSLA), Rivian (RIVN), and Ford (F). Analyse revenue, cash burn, margins, and delivery trends.", needsCompany: false },
  { title: "Banking Sector", prompt: "Compare the financials of JPMorgan Chase (JPM), Bank of America (BAC), and Goldman Sachs (GS). Focus on net interest income, efficiency ratio, and capital ratios.", needsCompany: false },
  { title: "Crypto Market Overview", prompt: "Give a comprehensive overview of the top 20 cryptocurrencies by market cap. Include current prices, 24h changes, and notable movers.", needsCompany: false },
  { title: "Crypto Deep Dive", prompt: "Provide an in-depth analysis of Bitcoin including price action, market cap ranking, trading volume, supply metrics, and recent performance trends.", needsCompany: false },
];

const QUICK_QUERIES = [
  { label: "Revenue trend", query: "What is the revenue trend over the past year for ", icon: TrendingUp, needsCompany: true },
  { label: "Compare margins", query: "Compare the profit margins and growth rates for ", icon: GitCompare, needsCompany: true },
  { label: "Financial health", query: "What is the debt-to-equity ratio and financial health of ", icon: BarChart3, needsCompany: true },
  { label: "Valuation comparison", query: "Compare the valuation ratios and market performance of ", icon: GitCompare, needsCompany: true },
  { label: "AAPL vs MSFT", query: "Compare the revenue, margins, and valuation of Apple (AAPL) vs Microsoft (MSFT) side by side", icon: GitCompare, needsCompany: false },
  { label: "GOOGL vs META", query: "Compare the financials of Google (GOOGL) vs Meta (META) including revenue growth, margins, and R&D spend", icon: GitCompare, needsCompany: false },
  { label: "FAANG overview", query: "Provide a financial overview of all FAANG stocks (Meta, Apple, Amazon, Netflix, Google). Compare revenue, margins, and growth in a table.", icon: BarChart3, needsCompany: false },
  { label: "Compare two companies", query: "Compare the revenue, margins, debt, cash flow, and valuation of ", icon: GitCompare, needsCompany: true },
  { label: "Bitcoin price", query: "What is the current price of Bitcoin? Include 24h, 7d, and 30d changes", icon: TrendingUp, needsCompany: false },
  { label: "Ethereum price", query: "What is the current price of Ethereum? Include market cap and volume", icon: TrendingUp, needsCompany: false },
  { label: "Top 20 crypto", query: "Show the top 20 cryptocurrencies by market cap with prices and 24h changes", icon: BarChart3, needsCompany: false },
  { label: "BTC vs ETH", query: "Compare Bitcoin vs Ethereum: price performance, market cap, volume, and 30d trend", icon: GitCompare, needsCompany: false },
  { label: "Solana analysis", query: "Analyse Solana (SOL) price, market cap, volume, and recent performance", icon: TrendingUp, needsCompany: false },
  { label: "DeFi tokens", query: "Compare the prices and market caps of AAVE, UNI, and LINK", icon: GitCompare, needsCompany: false },
  { label: "Crypto vs S&P", query: "Compare the performance of Bitcoin against the S&P 500 this year", icon: GitCompare, needsCompany: false },
  { label: "Why is crypto falling?", query: "Why is Bitcoin falling today? What are the key factors?", icon: TrendingUp, needsCompany: false },
  { label: "Undervalued screen", query: "Screen for undervalued indicators for ", icon: TrendingUp, needsCompany: true },
  { label: "Full breakdown", query: "Provide a comprehensive financial breakdown for ", icon: BarChart3, needsCompany: true },
  { label: "Build thesis", query: "Build a structured investment thesis for ", icon: GitCompare, needsCompany: true },
  { label: "Buy or Sell?", query: "Based on the financial data, give a Buy, Hold, or Sell signal for ", icon: TrendingUp, needsCompany: true },
];

const CONSECUTIVE_ERRORS_FOR_NUDGE = 2;

export function FinanceQuerySection({
  onAskFinance,
  isAsking,
  messages,
  askError,
  hasDocumentsSelected = false,
}: FinanceQuerySectionProps) {
  const [question, setQuestion] = useState("");
  const [showPrompts, setShowPrompts] = useState(false);
  const [showAllQueries, setShowAllQueries] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const [browseSearch, setBrowseSearch] = useState("");
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [showSignUpNudge, setShowSignUpNudge] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(messages.length);
  const prevErrorRef = useRef<string | undefined>(undefined);

  const { data: tickerData } = useQuery<{
    stocks: { category: string; stocks: { ticker: string; name: string }[] }[];
    cryptos: { symbol: string; name: string; id: string }[];
  }>({
    queryKey: ["/api/finance/available-tickers"],
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (askError && askError !== prevErrorRef.current) {
      const newCount = consecutiveErrors + 1;
      setConsecutiveErrors(newCount);
    } else if (!askError && prevErrorRef.current) {
      setConsecutiveErrors(0);
      setShowSignUpNudge(false);
    }
    prevErrorRef.current = askError;
  }, [askError]);

  useEffect(() => {
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [messages]);


  const handleSubmit = useCallback(() => {
    if (!question.trim() || isAsking) return;
    onAskFinance(question.trim());
    setQuestion("");
  }, [question, isAsking, onAskFinance]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickQuery = (query: string, needsCompany: boolean) => {
    if (isAsking) return;
    if (needsCompany) {
      setQuestion(query);
      setTimeout(() => textareaRef.current?.focus(), 50);
      return;
    }
    onAskFinance(query);
  };

  const handlePromptSelect = (prompt: string, needsCompany: boolean) => {
    if (isAsking) return;
    setShowPrompts(false);
    if (needsCompany) {
      setQuestion(prompt);
      setTimeout(() => textareaRef.current?.focus(), 50);
      return;
    }
    onAskFinance(prompt);
  };

  const handleTickerSelect = (ticker: string, name: string, isCrypto: boolean) => {
    const prefix = question.trim();
    const tickerLabel = `${name} (${ticker})`;
    if (prefix) {
      setQuestion(prev => prev.trimEnd() + " " + tickerLabel);
    } else {
      setQuestion(tickerLabel + " ");
    }
    setShowBrowse(false);
    setBrowseSearch("");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const filteredStocks = tickerData?.stocks?.map(cat => ({
    ...cat,
    stocks: cat.stocks.filter(s => {
      if (!browseSearch) return true;
      const q = browseSearch.toLowerCase();
      return s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
    })
  })).filter(cat => cat.stocks.length > 0) || [];

  const filteredCryptos = tickerData?.cryptos?.filter(c => {
    if (!browseSearch) return true;
    const q = browseSearch.toLowerCase();
    return c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  }) || [];

  const renderFormattedAnswer = (content: string) => {
    const lines = content.split("\n");
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc ml-4 space-y-0.5">
            {listItems.map((item, i) => (
              <li key={i} className="text-xs">{renderInline(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    const renderInline = (text: string) => {
      const parts: (string | JSX.Element)[] = [];
      let remaining = text;
      let keyIdx = 0;
      while (remaining.length > 0) {
        const linkMatch = remaining.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
        const boldMatch = remaining.match(/\*\*(.*?)\*\*/);

        let firstMatch: { type: "link" | "bold"; index: number; length: number; content: string; url?: string } | null = null;

        if (linkMatch && linkMatch.index !== undefined) {
          firstMatch = { type: "link", index: linkMatch.index, length: linkMatch[0].length, content: linkMatch[1], url: linkMatch[2] };
        }
        if (boldMatch && boldMatch.index !== undefined) {
          if (!firstMatch || boldMatch.index < firstMatch.index) {
            firstMatch = { type: "bold", index: boldMatch.index, length: boldMatch[0].length, content: boldMatch[1] };
          }
        }

        if (firstMatch) {
          if (firstMatch.index > 0) {
            parts.push(remaining.substring(0, firstMatch.index));
          }
          if (firstMatch.type === "link") {
            parts.push(
              <a key={keyIdx++} href={firstMatch.url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-700 dark:hover:text-emerald-300">
                {firstMatch.content}
              </a>
            );
          } else {
            parts.push(<strong key={keyIdx++}>{firstMatch.content}</strong>);
          }
          remaining = remaining.substring(firstMatch.index + firstMatch.length);
        } else {
          parts.push(remaining);
          break;
        }
      }
      return <>{parts}</>;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^##\s+(.*)/);
      const listMatch = line.match(/^[-*]\s+(.*)/);
      const hrMatch = line.match(/^---+$/);

      if (headingMatch) {
        flushList();
        elements.push(<h3 key={`h-${i}`} className="text-sm font-semibold mt-3 mb-1">{headingMatch[1]}</h3>);
      } else if (listMatch) {
        listItems.push(listMatch[1]);
      } else if (hrMatch) {
        flushList();
        elements.push(<hr key={`hr-${i}`} className="my-2 border-border/50" />);
      } else if (line.trim() === "") {
        flushList();
      } else {
        flushList();
        elements.push(<p key={`p-${i}`} className="text-xs leading-relaxed">{renderInline(line)}</p>);
      }
    }
    flushList();
    return <div className="space-y-1">{elements}</div>;
  };

  const handlePrint = useCallback((msg: FinanceMessage, questionText?: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const company = msg.financialData?.companyName 
      ? `${msg.financialData.companyName} (${msg.financialData.ticker})`
      : '';
    const title = company ? `Financial Analysis — ${company}` : 'Financial Analysis';
    const content = msg.content
      .replace(/^## (.*)/gm, '<h2 style="margin-top:16px;margin-bottom:8px;font-size:16px;font-weight:600;">$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^[-*] (.*)/gm, '<li style="margin-bottom:4px;">$1</li>')
      .replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul style="margin:8px 0;padding-left:20px;">${match}</ul>`)
      .replace(/\n/g, '<br/>');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;padding:40px 20px;color:#222;font-size:14px;line-height:1.6}
      h1{font-size:20px;margin-bottom:4px}h2{font-size:16px;margin-top:16px}
      .meta{color:#666;font-size:12px;margin-bottom:16px;border-bottom:1px solid #eee;padding-bottom:12px}
      .query{background:#f0fdf4;border-left:3px solid #16a34a;padding:8px 12px;margin-bottom:16px;font-size:13px;color:#166534}
      @media print{body{padding:20px}}</style></head><body>
      <h1>${title}</h1>
      <div class="meta">Generated by Evident Finance · ${new Date().toLocaleDateString()}</div>
      ${questionText ? `<div class="query"><strong>Query:</strong> ${questionText}</div>` : ''}
      <div>${content}</div></body></html>`);
    printWindow.document.close();
    printWindow.print();
  }, []);

  const handleSave = useCallback((msg: FinanceMessage, questionText?: string) => {
    const company = msg.financialData?.companyName 
      ? `${msg.financialData.companyName} (${msg.financialData.ticker})`
      : 'Financial Analysis';
    const header = `${company}\nGenerated by Evident Finance · ${new Date().toLocaleDateString()}\n`;
    const queryLine = questionText ? `\nQuery: ${questionText}\n` : '';
    const separator = '\n' + '─'.repeat(50) + '\n\n';
    const text = header + queryLine + separator + msg.content;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (msg.financialData?.ticker || 'finance').replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `evident_${safeName}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const MOBILE_QUICK_QUERY_LIMIT = 6;
  const visibleQueries = showAllQueries ? QUICK_QUERIES : QUICK_QUERIES.slice(0, MOBILE_QUICK_QUERY_LIMIT);
  const hasMoreQueries = QUICK_QUERIES.length > MOBILE_QUICK_QUERY_LIMIT;

  const [inputCollapsed, setInputCollapsed] = useState(false);
  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (hasMessages && !isAsking) {
      setInputCollapsed(true);
    }
  }, [messages.length]);

  return (
    <div className="flex flex-col h-full" data-testid="finance-query-section">
      <div className="shrink-0 pb-2">
        {inputCollapsed && hasMessages ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-start gap-2 text-xs text-muted-foreground border-emerald-200 dark:border-emerald-800"
              onClick={() => setInputCollapsed(false)}
              data-testid="button-finance-expand-input"
            >
              <PenLine className="w-3.5 h-3.5 text-emerald-500" />
              New finance query...
            </Button>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {Math.floor(messages.length / 2)} {Math.floor(messages.length / 2) === 1 ? 'query' : 'queries'}
            </Badge>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400">
                Live SEC Data
              </Badge>
              <Badge variant="outline" className="text-[10px] border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400">
                US Exchanges Only
              </Badge>
              {hasDocumentsSelected && (
                <Badge variant="outline" className="text-[10px] border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400">
                  Hybrid Mode
                </Badge>
              )}
              {hasMessages && (
                <Badge variant="secondary" className="text-[10px]">
                  {Math.floor(messages.length / 2)} {Math.floor(messages.length / 2) === 1 ? 'query' : 'queries'}
                </Badge>
              )}
            </div>
            {!hasMessages && (
              <p className="text-[10px] text-muted-foreground">
                Covers 200+ US-listed stocks (NYSE/NASDAQ), international ADRs, ETFs, and 100+ cryptocurrencies.
              </p>
            )}

            <div className="space-y-1.5">
              <Textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasDocumentsSelected
                  ? "Type a company name, e.g. 'Apple revenue'..."
                  : "Type company + query, e.g. 'Apple profit margins'"
                }
                className="w-full text-sm resize-none h-[72px]"
                disabled={isAsking}
                data-testid="input-finance-query"
              />
              <div className="flex items-center gap-2">
                <div className="flex gap-1 shrink-0">
                  <Popover open={showBrowse} onOpenChange={(open) => { setShowBrowse(open); if (!open) setBrowseSearch(""); }}>
                    <PopoverTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-emerald-500"
                        data-testid="button-finance-browse"
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-80 p-0">
                      <div className="p-2 border-b border-border/50">
                        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50">
                          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <input
                            type="text"
                            value={browseSearch}
                            onChange={(e) => setBrowseSearch(e.target.value)}
                            placeholder="Search stocks or crypto..."
                            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                            data-testid="input-browse-search"
                          />
                        </div>
                      </div>
                      <div className="h-72 overflow-y-auto p-2" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
                        {filteredStocks.length > 0 && (
                          <div className="space-y-2">
                            {filteredStocks.map((cat) => (
                              <div key={cat.category}>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">{cat.category}</p>
                                <div className="flex flex-wrap gap-1">
                                  {cat.stocks.map((s) => (
                                    <button
                                      key={s.ticker}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-muted/60 hover-elevate"
                                      onClick={() => handleTickerSelect(s.ticker, s.name, false)}
                                      data-testid={`button-browse-stock-${s.ticker}`}
                                    >
                                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{s.ticker}</span>
                                      <span className="text-muted-foreground">{s.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {filteredCryptos.length > 0 && (
                          <div className={filteredStocks.length > 0 ? "mt-3" : ""}>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">Cryptocurrencies</p>
                            <div className="flex flex-wrap gap-1">
                              {filteredCryptos.slice(0, browseSearch ? 50 : 30).map((c) => (
                                <button
                                  key={c.symbol}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-muted/60 hover-elevate"
                                  onClick={() => handleTickerSelect(c.symbol, c.name, true)}
                                  data-testid={`button-browse-crypto-${c.symbol}`}
                                >
                                  <span className="font-semibold text-amber-600 dark:text-amber-400">{c.symbol}</span>
                                  <span className="text-muted-foreground">{c.name}</span>
                                </button>
                              ))}
                              {!browseSearch && (filteredCryptos.length > 30) && (
                                <span className="text-[10px] text-muted-foreground px-1 py-1">+{filteredCryptos.length - 30} more (search to find)</span>
                              )}
                            </div>
                          </div>
                        )}
                        {filteredStocks.length === 0 && filteredCryptos.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">No matches found</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover open={showPrompts} onOpenChange={setShowPrompts}>
                    <PopoverTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-emerald-500"
                        data-testid="button-finance-prompts"
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="end" className="w-72 p-2">
                      <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                        <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Finance Prompts</span>
                      </div>
                      <div className="h-56 overflow-y-auto" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
                        {FINANCE_PROMPTS.map((p, i) => (
                          <button
                            key={i}
                            className="w-full text-left px-2 py-1.5 rounded text-xs hover-elevate"
                            onClick={() => handlePromptSelect(p.prompt, p.needsCompany)}
                            data-testid={`button-finance-prompt-${i}`}
                          >
                            <span className="font-medium">{p.title}</span>
                            <p className="text-muted-foreground line-clamp-1 mt-0.5">{p.prompt}</p>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant={question.trim() ? "default" : "ghost"}
                        className={question.trim() ? "bg-emerald-600 text-white" : ""}
                        onClick={handleSubmit}
                        disabled={!question.trim() || isAsking}
                        data-testid="button-finance-submit"
                      >
                        {isAsking ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Query SEC financial data</p>
                    </TooltipContent>
                  </Tooltip>

                  {hasMessages && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setInputCollapsed(true)}
                          data-testid="button-finance-collapse-input"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Collapse input</p></TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {!hasMessages && (
                  <p className="text-[10px] text-muted-foreground truncate">Add a company name or ask any finance question</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {visibleQueries.map((q, i) => (
                <Button
                  key={i}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 sm:h-7 text-[11px] sm:text-xs gap-1 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-2 sm:px-3"
                  onClick={() => handleQuickQuery(q.query, q.needsCompany)}
                  disabled={isAsking}
                  data-testid={`button-finance-quick-${i}`}
                >
                  <q.icon className="w-3 h-3 hidden sm:block" />
                  {q.label}
                </Button>
              ))}
              {hasMoreQueries && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 sm:h-7 text-[11px] sm:text-xs gap-0.5 text-muted-foreground"
                  onClick={() => setShowAllQueries(!showAllQueries)}
                  data-testid="button-finance-toggle-queries"
                >
                  {showAllQueries ? (
                    <>Less <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>{QUICK_QUERIES.length - MOBILE_QUICK_QUERY_LIMIT} more <ChevronDown className="w-3 h-3" /></>
                  )}
                </Button>
              )}
            </div>

            {!hasMessages && hasDocumentsSelected && (
              <p className="text-[11px] text-blue-500 dark:text-blue-400 flex items-center gap-1">
                <GitCompare className="w-3 h-3" />
                Docs will be compared with live SEC data.
              </p>
            )}
          </div>
        )}

        {isAsking && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 mt-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Fetching live financial data...</span>
          </div>
        )}

        {askError && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 space-y-1 mt-2" data-testid="finance-error">
            <p className="text-xs font-medium text-destructive">
              {askError.includes("assetId") || askError.includes("assetIds")
                ? "Please include a company name or ticker in your query"
                : askError.includes("not found") && !askError.includes("company name")
                ? "Company not found. Try using the ticker symbol (e.g. AAPL, MSFT)"
                : askError.includes("rate limit") || askError.includes("429")
                ? "Just a moment — please try again shortly"
                : askError}
            </p>
            {!askError.includes("company name") && !askError.includes("ticker symbol") && (
              <p className="text-[11px] text-muted-foreground">
                {askError.includes("assetId") || askError.includes("assetIds")
                  ? 'Try: "Buy or sell Apple?" or "TSLA revenue trend" instead of generic prompts'
                  : askError.includes("not found")
                  ? "We cover 200+ stocks (S&P 500, ETFs, ADRs) and 100+ cryptocurrencies"
                  : "If this keeps happening, try a different query or check back shortly"}
              </p>
            )}
          </div>
        )}

        {showSignUpNudge && (
          <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2.5 mt-2" data-testid="finance-signup-nudge">
            <div className="flex items-start gap-2">
              <UserPlus className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">
                  Sign in for better results
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Evident needs your account details to access deeper financial data, personalised insights, and more reliable answers.
                </p>
                <Button
                  size="sm"
                  variant="default"
                  className="mt-1"
                  data-testid="button-signup-from-finance"
                  onClick={() => window.location.href = "/api/login"}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Sign up free
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {messages.length > 0 && (
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-2 pt-2 border-t border-emerald-200/30 dark:border-emerald-800/30" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
          {(() => {
            const pairs: FinanceMessage[][] = [];
            for (let i = 0; i < messages.length; i += 2) {
              pairs.push(messages.slice(i, i + 2));
            }
            return pairs.reverse().flatMap(pair => pair);
          })().map((msg, idx, arr) => {
            const questionText = msg.type === "answer" 
              ? arr[idx - 1]?.type === "question" ? arr[idx - 1].content : undefined
              : undefined;
            return (
            <div
              key={msg.id}
              className={`text-xs rounded-md px-3 py-2 ${
                msg.type === "question"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 font-medium"
                  : "bg-muted/50 text-foreground"
              }`}
              data-testid={`finance-message-${msg.id}`}
            >
              {msg.type === "question" ? (
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3 h-3 shrink-0" />
                  <span>{msg.content}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {msg.financialData && (
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      {msg.financialData.companyName && (
                        <Badge variant="outline" className="text-[10px] border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400">
                          {msg.financialData.companyName} ({msg.financialData.ticker})
                        </Badge>
                      )}
                      {msg.financialData.hybridMode && (
                        <Badge variant="outline" className="text-[10px] border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400">
                          Hybrid
                        </Badge>
                      )}
                      {msg.financialData.dataUsed?.statements > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {msg.financialData.dataUsed.statements} statements
                        </span>
                      )}
                    </div>
                  )}
                  {renderFormattedAnswer(msg.content)}
                  <div className="flex items-center gap-1 pt-1.5 mt-1.5 border-t border-border/30">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePrint(msg, questionText)}
                          data-testid={`button-finance-print-${msg.id}`}
                        >
                          <Printer className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">Print</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Print analysis</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSave(msg, questionText)}
                          data-testid={`button-finance-save-${msg.id}`}
                        >
                          <Download className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">Save</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Save as file</p></TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
