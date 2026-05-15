export {
  MODE_CONFIGS,
  getModeConfig,
  getEffectiveIntentDetection,
  shouldRunIntentDetection,
} from "./mode-configs/index";

export type { ModeConfig, IntentDetectionLevel } from "./mode-configs/types";

export interface FinanceModeContext {
  question: string;
  idsToQuery: string[];
  validatedAssets: any[];
  topK: number;
  responseFormat: string | null;
  financeQueryEnabled: boolean;
  ownerId: string;
  answerQuestion: Function;
}

export interface FinanceModeResult {
  handled: boolean;
  error?: { status: number; message: string };
  response?: {
    answer: string;
    citations: any[];
    evidencePreview?: any[];
    confidence?: number;
    needsExternalSearch?: boolean;
    financialData: any;
  };
}

export async function handleFinanceMode(ctx: FinanceModeContext): Promise<FinanceModeResult> {
  const { question, idsToQuery, validatedAssets, topK, responseFormat, financeQueryEnabled, ownerId, answerQuestion } = ctx;

  if (!financeQueryEnabled) {
    if (idsToQuery.length === 0) {
      const isFinancialQuestion = /\b(stock|share|ticker|price|market|trading|invest|portfolio|dividend|earnings|revenue|profit|balance sheet|income statement|cash flow|SEC|filing|10-K|10-Q|annual report|quarterly|P\/E|ratio|valuation|crypto|bitcoin|ethereum)\b/i.test(question);
      if (isFinancialQuestion) {
        return {
          handled: true,
          error: { status: 400, message: "Please upload a document to analyse, or turn on External Finance Query for live stock and crypto data." },
        };
      }
      console.log(`[FinanceMode] Non-financial question with no docs — passing through to platform handler`);
      return { handled: false };
    }
    console.log(`[FinanceMode] External query OFF — using documents only`);
    return { handled: false };
  }

  const { detectFinancialIntent } = await import("./financial-analysis");
  const { detectCryptoIntent } = await import("./crypto-data");

  const financialIntent = detectFinancialIntent(question);
  const cryptoIntent = detectCryptoIntent(question);

  const hasExplicitCryptoKeyword = /\b(crypto|cryptocurrency|bitcoin|ethereum|blockchain|defi|token|altcoin)\b/i.test(question);
  const hasExactCryptoMatch = cryptoIntent.isCrypto && cryptoIntent.cryptoIds.length > 0;
  const hasStockMatch = financialIntent.isFinancial && !!financialIntent.ticker;

  const isCryptoQuery = hasExactCryptoMatch || (cryptoIntent.isCrypto && hasExplicitCryptoKeyword);
  const isFinancialQuery = hasStockMatch && !isCryptoQuery;

  console.log(`[FinanceMode] Intent detection: stock=${hasStockMatch} (${financialIntent.ticker}), crypto=${hasExactCryptoMatch} (${cryptoIntent.cryptoIds.join(',')}), cryptoKeyword=${hasExplicitCryptoKeyword}, route=${isCryptoQuery ? 'crypto' : isFinancialQuery ? 'stock' : 'general'}`);

  if (isCryptoQuery) {
    return handleCryptoQuery(question, cryptoIntent, validatedAssets, idsToQuery);
  }

  if (isFinancialQuery && financialIntent.ticker) {
    return handleStockQuery(question, financialIntent, validatedAssets, idsToQuery, topK, responseFormat, ownerId, answerQuestion);
  }

  if (idsToQuery.length === 0) {
    return handleGeneralFinanceQuery(question);
  }

  return { handled: false };
}

async function handleCryptoQuery(
  question: string,
  cryptoIntent: { isCrypto: boolean; cryptoIds: string[]; cryptoNames: string[] },
  validatedAssets: any[],
  idsToQuery: string[]
): Promise<FinanceModeResult> {
  const { getMultipleCryptoPrices, getTopCryptos, formatCryptoDataForAI } = await import("./crypto-data");
  const { fetchMarketNewsContext } = await import("./financial-analysis");

  const isTopQuery = /\b(top|biggest|largest|major|leading|overview|market)\b.*\b(crypto|coin|token|cryptocurrency)/i.test(question) || cryptoIntent.cryptoIds.length === 0;
  let cryptoSnapshots;
  if (isTopQuery && cryptoIntent.cryptoIds.length === 0) {
    cryptoSnapshots = await getTopCryptos(20);
  } else if (cryptoIntent.cryptoIds.length > 0) {
    cryptoSnapshots = await getMultipleCryptoPrices(cryptoIntent.cryptoIds);
  } else {
    cryptoSnapshots = await getTopCryptos(20);
  }

  const cryptoDataContext = formatCryptoDataForAI(cryptoSnapshots);
  const needsNews = /\b(why|falling|rising|dropping|surging|crashing|news|recent|latest|crash|rally|plunge|soar|pump|dump)\b/i.test(question);
  const newsContext = needsNews && cryptoSnapshots.length > 0
    ? await fetchMarketNewsContext(cryptoSnapshots[0].symbol, cryptoSnapshots[0].name, question).catch(() => null)
    : null;

  const systemPrompt = `You are a cryptocurrency analyst providing data-driven insights. You have access to live market data from CoinGecko.

Guidelines:
- Use exact figures from the data provided
- Highlight key trends (24h, 7d, 30d changes)
- Compare market caps and volumes when relevant
- Use markdown formatting with ## headings and bullet points
- Keep paragraphs short (2-3 sentences max)
- If asked for investment advice, provide data-driven analysis but ALWAYS end with: "**Disclaimer:** This analysis is based solely on publicly available market data and is for informational purposes only. It does not constitute financial advice. Evident is not responsible for investment decisions. Always do your own research before investing in cryptocurrencies."`;

  const { chat } = await import("./openai");
  let userMessage = `Live cryptocurrency data:\n\n${cryptoDataContext}\n\nUser question: ${question}`;
  if (newsContext) {
    userMessage += `\n\nRecent news context:\n${newsContext}`;
  }

  const answer = await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ]);

  let fullAnswer = answer;
  if (newsContext) {
    fullAnswer += `\n\n---\n\n## Recent News & Market Context\n\n${newsContext}`;
  }

  if (cryptoSnapshots.length > 0 && cryptoSnapshots.length <= 3) {
    const { generateResourceLinks } = await import("./financial-analysis");
    const cryptoLinks = cryptoSnapshots.map((s: any) =>
      generateResourceLinks(s.id, s.name, true)
    ).join("");
    fullAnswer += cryptoLinks;
  }

  return {
    handled: true,
    response: {
      answer: fullAnswer,
      citations: [],
      confidence: 0.9,
      financialData: {
        ticker: cryptoSnapshots.map((s: any) => s.symbol).join(", "),
        companyName: cryptoSnapshots.map((s: any) => s.name).join(", "),
        analysisType: "crypto",
        cryptoData: cryptoSnapshots,
      },
    },
  };
}

async function handleStockQuery(
  question: string,
  financialIntent: any,
  validatedAssets: any[],
  idsToQuery: string[],
  topK: number,
  responseFormat: string | null,
  ownerId: string,
  answerQuestion: Function
): Promise<FinanceModeResult> {
  const { getFinancials, getPriceSnapshot, calculateMetrics } = await import("./financial-data");
  const { generateFinancialAnalysis, generateComparisonAnalysis, fetchMarketNewsContext } = await import("./financial-analysis");
  const eodhd = await import("./eodhd-data");

  const hasDocuments = validatedAssets.length > 0;
  const isComparison = financialIntent.analysisType === "comparison" && financialIntent.comparisonTickers && financialIntent.comparisonTickers.length > 0;

  let documentResponse: any = null;
  if (hasDocuments) {
    try {
      documentResponse = await answerQuestion(
        idsToQuery.length === 1 ? idsToQuery[0] : idsToQuery,
        question, topK, "finance" as any, ownerId,
        undefined, undefined, undefined, undefined, responseFormat
      );
    } catch (e) { documentResponse = null; }
  }

  let hybridAnswer: string | undefined;
  let responseFinancialData: any;

  if (isComparison) {
    const allTickers = [
      { ticker: financialIntent.ticker!, companyName: financialIntent.companyName! },
      ...financialIntent.comparisonTickers!,
    ];

    const companyDataPromises = allTickers.map(async (t: any) => {
      const [financials, priceSnapshot] = await Promise.all([
        getFinancials(t.ticker, "quarterly", 8).catch(() => ({ income_statements: [], balance_sheets: [], cash_flow_statements: [] })),
        getPriceSnapshot(t.ticker).catch(() => null),
      ]);
      const metrics = calculateMetrics(financials);
      return {
        intent: { ...financialIntent, ticker: t.ticker, companyName: t.companyName } as any,
        financials, metrics, priceSnapshot,
      };
    });

    const companiesData = await Promise.all(companyDataPromises);
    const comparisonResult = await generateComparisonAnalysis(companiesData, question, documentResponse?.answer);

    hybridAnswer = comparisonResult.answer;
    if (hasDocuments && documentResponse) {
      hybridAnswer += `\n\n---\n\n**From Your Uploaded Documents:**\n\n${documentResponse.answer}`;
    }

    responseFinancialData = {
      ticker: allTickers.map((t: any) => t.ticker).join(" vs "),
      companyName: allTickers.map((t: any) => t.companyName).join(" vs "),
      analysisType: "comparison",
      metrics: companiesData.flatMap((c: any) => c.metrics),
      priceSnapshot: companiesData[0].priceSnapshot,
      dataUsed: comparisonResult.dataUsed,
      hybridMode: hasDocuments,
    };
  } else {
    const needsNewsContext = /\b(why|falling|rising|dropping|surging|crashing|tanking|up today|down today|what happened|news|recent|latest|analyst|sentiment|outlook|forecast|crash|rally|plunge|soar|spike|dip|decline|jump|tumble)\b/i.test(question);

    const [financials, priceSnapshot, newsContext, eodhdFundamentals, eodhdQuote, eodhdNews] = await Promise.all([
      getFinancials(financialIntent.ticker, "quarterly", 8).catch(() => ({ income_statements: [], balance_sheets: [], cash_flow_statements: [] })),
      getPriceSnapshot(financialIntent.ticker).catch(() => null),
      needsNewsContext ? fetchMarketNewsContext(financialIntent.ticker!, financialIntent.companyName || financialIntent.ticker!, question).catch(() => null) : Promise.resolve(null),
      eodhd.isConfigured() ? eodhd.getFundamentals(financialIntent.ticker).catch(() => null) : Promise.resolve(null),
      eodhd.isConfigured() ? eodhd.getRealTimeQuote(financialIntent.ticker).catch(() => null) : Promise.resolve(null),
      eodhd.isConfigured() && needsNewsContext ? eodhd.getNews(financialIntent.ticker, 5).catch(() => []) : Promise.resolve([]),
    ]);

    const eodhdUsage = eodhd.getUsageStats();
    const hasPrimaryData = financials.income_statements.length > 0 || financials.balance_sheets.length > 0 || !!priceSnapshot;
    const hasEodhdData = !!eodhdQuote;
    const hasNoData = !hasPrimaryData && !hasEodhdData && !eodhdFundamentals;
    if (hasNoData && financialIntent.needsLookup) {
      const companyName = financialIntent.companyName || financialIntent.ticker || "this company";
      const searchName = encodeURIComponent(companyName);
      const notFoundAnswer = `## Company Not Found\n\n` +
        `I couldn't find financial data for **"${companyName}"** in our database. This company may not be listed on US exchanges, may use a different ticker symbol, or may be privately held.\n\n` +
        `**Try these tips:**\n` +
        `- Use the stock ticker directly (e.g., AAPL for Apple, MSFT for Microsoft)\n` +
        `- Check if the company trades under a different name or parent company\n` +
        `- Upload the company's financial documents and ask questions about them directly\n\n` +
        `## Look Up This Company\n` +
        `- [Search SEC EDGAR Filings](https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${searchName}&type=10-K&dateb=&owner=include&count=10&search_text=&action=getcompany)\n` +
        `- [Search Yahoo Finance](https://finance.yahoo.com/lookup/?s=${searchName})\n` +
        `- [Search Google Finance](https://www.google.com/finance/?q=${searchName})\n` +
        `- [Search Bloomberg](https://www.bloomberg.com/search?query=${searchName})\n`;

      return {
        handled: true,
        response: {
          answer: notFoundAnswer,
          citations: [],
          confidence: 0,
          financialData: {
            ticker: financialIntent.ticker,
            companyName,
            analysisType: "not_found",
          },
        },
      };
    }

    if (hasNoData) {
      return { handled: false };
    }

    const metrics = calculateMetrics(financials);

    let eodhdContext = "";
    if (eodhdFundamentals) {
      eodhdContext += eodhd.formatFundamentalsForAI(eodhdFundamentals);
    }
    if (eodhdQuote) {
      eodhdContext += "\n\n" + eodhd.formatQuoteForAI(eodhdQuote);
    }

    if (!hasPrimaryData && hasEodhdData) {
      const eodhdHistory = await eodhd.getHistoricalPrices(financialIntent.ticker, "d").catch(() => []);
      if (eodhdHistory.length > 0) {
        const recent = eodhdHistory.slice(-30);
        eodhdContext += "\n\n## Historical Prices (Last 30 Trading Days)\n";
        eodhdContext += recent.map(d => `${d.date}: O:$${d.open} H:$${d.high} L:$${d.low} C:$${d.close} V:${d.volume}`).join("\n");
      }
    }

    const analysisResult = await generateFinancialAnalysis(
      financialIntent, financials, metrics, priceSnapshot, question,
      documentResponse ? documentResponse.answer : undefined,
      eodhdContext || undefined
    );

    let fullAnswer = analysisResult.answer;

    if (newsContext) {
      fullAnswer += `\n\n---\n\n## Recent News & Market Context\n\n${newsContext}`;
    }
    if (!newsContext && eodhdNews && eodhdNews.length > 0) {
      fullAnswer += `\n\n---\n\n${eodhd.formatNewsForAI(eodhdNews)}`;
    }

    const { generateResourceLinks } = await import("./financial-analysis");
    const resourceLinks = generateResourceLinks(financialIntent.ticker!, financialIntent.companyName || undefined, false);

    const isTrial = ownerId === 'guest-trial-user';
    if (hasDocuments && documentResponse) {
      hybridAnswer = `${fullAnswer}${resourceLinks}\n\n---\n\n**From Your Uploaded Documents:**\n\n${documentResponse.answer}`;
    } else if (isTrial) {
      hybridAnswer = `${fullAnswer}${resourceLinks}\n\n---\n\n*This analysis uses publicly available SEC filings and real-time market data. Sign up free to upload your own financial documents for deeper analysis.*`;
    } else {
      hybridAnswer = `${fullAnswer}${resourceLinks}\n\n---\n\n*This analysis uses publicly available SEC filings and real-time market data. You can also upload your own financial documents to compare against this live data.*`;
    }

    responseFinancialData = {
      ticker: financialIntent.ticker,
      companyName: financialIntent.companyName,
      analysisType: financialIntent.analysisType,
      metrics,
      priceSnapshot,
      dataUsed: analysisResult.dataUsed,
      hybridMode: hasDocuments,
    };
  }

  if (hybridAnswer) {
    return {
      handled: true,
      response: {
        answer: hybridAnswer,
        citations: documentResponse?.citations || [],
        evidencePreview: documentResponse?.evidencePreview || [],
        needsExternalSearch: false,
        financialData: responseFinancialData,
      },
    };
  }

  return { handled: false };
}

async function handleGeneralFinanceQuery(question: string): Promise<FinanceModeResult> {
  const { chat } = await import("./openai");
  const generalAnswer = await chat([
    { role: "system", content: `You are a financial analyst assistant on the Evident platform. You have access to BOTH live stock/company data (SEC filings, financial statements, real-time prices for 200+ US-listed companies including Apple, Microsoft, Google, Amazon, Tesla, NVIDIA, etc.) AND live cryptocurrency data (100+ coins via CoinGecko).

Answer the user's finance question using your knowledge. Use markdown formatting with ## headings and bullet points. Keep paragraphs short.

IMPORTANT: If the user asks about a specific company or stock, encourage them to ask by name or ticker (e.g., "Tell me about Apple" or "AAPL revenue") so the system can pull live SEC filing data and real-time prices. Similarly for crypto, they can ask about specific coins (e.g., "Bitcoin price" or "Ethereum analysis").

If asked for investment advice, provide data-driven analysis but end with a disclaimer that this is for informational purposes only and does not constitute financial advice.` },
    { role: "user", content: question },
  ]);

  return {
    handled: true,
    response: {
      answer: generalAnswer + `\n\n---\n\n*For live SEC filings and real-time data, try asking about a specific company (e.g., "Apple revenue") or cryptocurrency (e.g., "Bitcoin price").*`,
      citations: [],
      confidence: 0.8,
      financialData: null,
    },
  };
}
