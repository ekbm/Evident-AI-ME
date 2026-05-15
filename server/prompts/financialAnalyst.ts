export const FINANCIAL_ANALYST_SYSTEM_PROMPT = `You are Evident, acting as a Senior Financial Analyst with expertise in corporate finance, annual reports, SEC filings, and AGM (Annual General Meeting) analysis.

Your role is to:
1. Analyze financial documents with the precision of a senior analyst
2. Extract key financial metrics and trends
3. Identify risks, opportunities, and material changes
4. Compare year-over-year and quarter-over-quarter performance
5. Highlight items that investors and stakeholders should pay attention to

When analyzing financial documents:
- Focus on revenue, profit margins, cash flow, and key ratios
- Identify significant changes from prior periods
- Note any management commentary on outlook or guidance
- Flag any unusual items, one-time charges, or accounting changes
- Consider industry context where relevant

Citation Rules:
1. Use ONLY the evidence provided - no external knowledge about specific companies
2. Cite your sources using [1], [2], etc. for each claim
3. If information isn't in the documents, say so clearly
4. Be precise with numbers - use exact figures from the documents

Output Style:
- Use clear, professional language suitable for executives
- Structure answers with clear sections when appropriate
- Lead with the most important findings
- Quantify everything possible

PROFESSIONAL READABILITY FORMAT (follow strictly):
- HEADINGS: Use ## or ### markdown headings to organize sections. Every answer with more than one topic must use headings.
- BOLD: Only use **bold** for important terms, key metrics, or critical findings. Never bold entire sentences, paragraphs, or explanations. Most text must be plain/regular weight.
- LISTS: Always use bullet points or numbered lists when presenting multiple items, metrics, or findings. Never write lists as long paragraphs.
- PARAGRAPHS: Keep paragraphs short — maximum 3-4 lines each. Break up long explanations into multiple short paragraphs.
- NO WALL OF TEXT: Never write dense blocks of text. Use whitespace, headings, and lists to make the answer scannable.
- CLARITY OVER VERBOSITY: Be clear and concise. Say what needs to be said without filler or repetition.`;

export const FINANCIAL_QUESTION_TEMPLATES = [
  {
    id: "revenue_analysis",
    label: "Revenue Analysis",
    prompt: "Analyze the revenue performance. What was the total revenue? How did it compare to the prior year? What were the main revenue drivers and any notable changes in revenue mix?"
  },
  {
    id: "profitability",
    label: "Profitability Review", 
    prompt: "Review the profitability metrics. What were the gross margin, operating margin, and net profit margin? How did these compare to prior periods? What factors affected profitability?"
  },
  {
    id: "cash_flow",
    label: "Cash Flow Analysis",
    prompt: "Analyze the cash flow statement. What was the operating cash flow? How did it compare to net income? What were the major uses of cash? Is the company generating or consuming cash?"
  },
  {
    id: "balance_sheet",
    label: "Balance Sheet Health",
    prompt: "Assess the balance sheet health. What are the key assets and liabilities? What is the debt-to-equity ratio? How is the company's liquidity position? Any concerns about the capital structure?"
  },
  {
    id: "yoy_comparison",
    label: "YoY Comparison",
    prompt: "Provide a year-over-year comparison of key metrics. What improved? What declined? What are the main drivers of changes? Create a summary table of key metrics compared to last year."
  },
  {
    id: "risk_factors",
    label: "Risk Analysis",
    prompt: "What are the key risk factors disclosed? Are there any new risks compared to prior filings? What operational, financial, or market risks should stakeholders be aware of?"
  },
  {
    id: "management_outlook",
    label: "Management Outlook",
    prompt: "What is management's outlook for the business? What guidance has been provided? What are the strategic priorities? Are there any notable changes in strategy or focus areas?"
  },
  {
    id: "agm_summary",
    label: "AGM Summary",
    prompt: "Summarize the key AGM (Annual General Meeting) items. What resolutions were proposed? What were the voting results? Were there any notable shareholder proposals or management responses?"
  },
  {
    id: "key_metrics",
    label: "Key Metrics Dashboard",
    prompt: "Create a summary of the most important financial metrics: Revenue, Net Income, EPS, EBITDA, Operating Cash Flow, Total Debt, Cash Position, and any key ratios. Present as a structured overview."
  },
  {
    id: "segment_analysis",
    label: "Segment Analysis",
    prompt: "Break down performance by business segment or geography. Which segments are growing? Which are declining? How does profitability vary across segments?"
  }
];

export const AGM_DOCUMENT_KEYWORDS = [
  "agm", "annual general meeting", "shareholder meeting", "proxy statement",
  "voting", "resolution", "shareholder proposal", "board of directors",
  "director election", "executive compensation", "say on pay", "audit committee",
  "nomination committee", "remuneration report", "articles of association",
  "dividend proposal", "capital allocation", "buyback", "stock repurchase"
];

export const FINANCIAL_DOCUMENT_TYPES = {
  ANNUAL_REPORT: "annual_report",
  QUARTERLY_REPORT: "quarterly_report",
  SEC_FILING_10K: "10k",
  SEC_FILING_10Q: "10q",
  AGM_MATERIALS: "agm",
  INVESTOR_PRESENTATION: "investor_presentation",
  EARNINGS_CALL: "earnings_call",
  PROXY_STATEMENT: "proxy_statement"
} as const;

export function detectFinancialDocumentType(filename: string, content: string): string | null {
  const lowerFilename = filename.toLowerCase();
  const lowerContent = content.toLowerCase().slice(0, 5000);
  
  if (/10-?k|annual.*report/i.test(lowerFilename) || lowerContent.includes("form 10-k")) {
    return FINANCIAL_DOCUMENT_TYPES.SEC_FILING_10K;
  }
  if (/10-?q|quarterly.*report/i.test(lowerFilename) || lowerContent.includes("form 10-q")) {
    return FINANCIAL_DOCUMENT_TYPES.SEC_FILING_10Q;
  }
  if (/agm|annual.*general.*meeting|proxy/i.test(lowerFilename) || 
      AGM_DOCUMENT_KEYWORDS.some(k => lowerContent.includes(k))) {
    return FINANCIAL_DOCUMENT_TYPES.AGM_MATERIALS;
  }
  if (/investor.*presentation|earnings.*presentation/i.test(lowerFilename)) {
    return FINANCIAL_DOCUMENT_TYPES.INVESTOR_PRESENTATION;
  }
  if (/earnings.*call|transcript/i.test(lowerFilename) && lowerContent.includes("earnings")) {
    return FINANCIAL_DOCUMENT_TYPES.EARNINGS_CALL;
  }
  
  return null;
}

export function getFinancialPlaceholderHints(documentType: string | null): string[] {
  const baseHints = [
    "What was the revenue and how did it compare to last year?",
    "Summarize the key financial metrics...",
    "What are the main risks disclosed?",
    "How is the company performing overall?"
  ];
  
  switch (documentType) {
    case FINANCIAL_DOCUMENT_TYPES.AGM_MATERIALS:
      return [
        "What resolutions were proposed at the AGM?",
        "How did shareholders vote on key proposals?",
        "What was the board's recommendation on each resolution?",
        ...baseHints.slice(0, 2)
      ];
    case FINANCIAL_DOCUMENT_TYPES.SEC_FILING_10K:
    case FINANCIAL_DOCUMENT_TYPES.SEC_FILING_10Q:
      return [
        "What were the key financial highlights?",
        "How did revenue and profit change year-over-year?",
        "What are the major risk factors disclosed?",
        "Summarize management's discussion and analysis..."
      ];
    case FINANCIAL_DOCUMENT_TYPES.EARNINGS_CALL:
      return [
        "What guidance did management provide?",
        "What were the key Q&A topics?",
        "What surprised analysts on the call?",
        "Summarize the CEO's opening remarks..."
      ];
    default:
      return baseHints;
  }
}
