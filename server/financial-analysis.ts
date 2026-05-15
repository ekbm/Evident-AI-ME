import { chat, chatFinance } from "./openai";
import type { FinancialData, FinancialMetrics, PriceSnapshot } from "./financial-data";
import { metrics } from "./metrics";

export async function fetchMarketNewsContext(ticker: string, companyName: string, question: string): Promise<string | null> {
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) return null;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: `You are a financial news analyst. Provide a concise summary of recent news, market events, and analyst commentary that is directly relevant to the user's question about ${companyName} (${ticker}). Focus on the most recent and impactful events. Be factual and cite specific events with approximate dates.` },
          { role: 'user', content: `${question}\n\nProvide the most recent and relevant news, events, or market developments for ${companyName} (${ticker}) that help answer this question. Include analyst opinions if available.` },
        ],
        max_tokens: 1500,
        temperature: 0.3,
        return_citations: true,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const citations = data.citations || [];
      metrics.recordApiCost('perplexity');

      if (content) {
        let newsSection = content;
        if (citations.length > 0) {
          newsSection += "\n\n**Sources:** " + citations.slice(0, 5).map((url: string, i: number) => `[${i + 1}](${url})`).join(" | ");
        }
        return newsSection;
      }
    }
  } catch (error) {
    console.error("[FinancialAnalysis] News context fetch error:", error);
  }
  return null;
}

function isNewsOrSentimentQuery(question: string): boolean {
  const patterns = /\b(why|falling|rising|dropping|surging|crashing|tanking|mooning|up today|down today|what happened|news|recent|latest|analyst|sentiment|outlook|forecast|predict|crash|rally|plunge|soar|spike|dip|decline|jump|tumble)\b/i;
  return patterns.test(question);
}

export interface FinancialIntent {
  isFinancial: boolean;
  ticker: string | null;
  companyName: string | null;
  analysisType: "overview" | "profitability" | "growth" | "comparison" | "valuation" | "cashflow" | "debt" | "general";
  originalQuestion: string;
  comparisonTickers?: { ticker: string; companyName: string }[];
  needsLookup?: boolean;
}

const TICKER_TO_COMPANY: Record<string, string> = {
  AAPL: "Apple", MSFT: "Microsoft", GOOGL: "Alphabet", GOOG: "Alphabet", AMZN: "Amazon",
  NVDA: "NVIDIA", META: "Meta Platforms", TSLA: "Tesla", "BRK.B": "Berkshire Hathaway",
  UNH: "UnitedHealth", JNJ: "Johnson & Johnson", V: "Visa", XOM: "ExxonMobil",
  JPM: "JPMorgan Chase", WMT: "Walmart", MA: "Mastercard", PG: "Procter & Gamble",
  LLY: "Eli Lilly", HD: "Home Depot", CVX: "Chevron", MRK: "Merck",
  ABBV: "AbbVie", KO: "Coca-Cola", PEP: "PepsiCo", AVGO: "Broadcom",
  COST: "Costco", TMO: "Thermo Fisher", MCD: "McDonald's", CSCO: "Cisco",
  ACN: "Accenture", ABT: "Abbott Labs", CRM: "Salesforce", DHR: "Danaher",
  NKE: "Nike", TXN: "Texas Instruments", NEE: "NextEra Energy", LIN: "Linde",
  BMY: "Bristol-Myers Squibb", AMD: "AMD", UPS: "UPS", PM: "Philip Morris",
  ORCL: "Oracle", INTC: "Intel", QCOM: "Qualcomm", LOW: "Lowe's",
  MS: "Morgan Stanley", GS: "Goldman Sachs", BA: "Boeing", CAT: "Caterpillar",
  DIS: "Disney", AMGN: "Amgen", NFLX: "Netflix", PYPL: "PayPal",
  ADBE: "Adobe", UBER: "Uber", SQ: "Block", SHOP: "Shopify",
  SNOW: "Snowflake", PLTR: "Palantir", COIN: "Coinbase", RIVN: "Rivian",
  SPOT: "Spotify", ZM: "Zoom", ROKU: "Roku", SNAP: "Snap",
  // S&P 500 additions - Technology
  NOW: "ServiceNow", INTU: "Intuit", PANW: "Palo Alto Networks",
  ANET: "Arista Networks", CDNS: "Cadence Design", SNPS: "Synopsys", FTNT: "Fortinet",
  MRVL: "Marvell Technology", KLAC: "KLA Corp", LRCX: "Lam Research", AMAT: "Applied Materials",
  ADI: "Analog Devices", MU: "Micron Technology", ON: "ON Semiconductor", NXPI: "NXP Semiconductors",
  TEAM: "Atlassian", WDAY: "Workday", DDOG: "Datadog", ZS: "Zscaler",
  CRWD: "CrowdStrike", NET: "Cloudflare", HUBS: "HubSpot", TTD: "The Trade Desk",
  BILL: "Bill Holdings", OKTA: "Okta", MDB: "MongoDB", TWLO: "Twilio",
  DOCU: "DocuSign", U: "Unity Software", PATH: "UiPath", RBLX: "Roblox",
  // Finance & Banking
  BAC: "Bank of America", WFC: "Wells Fargo", C: "Citigroup", USB: "US Bancorp",
  PNC: "PNC Financial", TFC: "Truist Financial", SCHW: "Charles Schwab", BLK: "BlackRock",
  SPGI: "S&P Global", ICE: "Intercontinental Exchange", CME: "CME Group", MCO: "Moody's",
  AXP: "American Express", COF: "Capital One", DFS: "Discover Financial", FIS: "Fidelity National",
  FISV: "Fiserv", GPN: "Global Payments", AIG: "AIG", MET: "MetLife",
  PRU: "Prudential", AFL: "Aflac", TRV: "Travelers", CB: "Chubb",
  MMC: "Marsh McLennan", AON: "Aon", RJF: "Raymond James",
  // Healthcare & Pharma
  PFE: "Pfizer", GILD: "Gilead Sciences", VRTX: "Vertex Pharmaceuticals", REGN: "Regeneron",
  ISRG: "Intuitive Surgical", SYK: "Stryker", MDT: "Medtronic", BSX: "Boston Scientific",
  EW: "Edwards Lifesciences", ZTS: "Zoetis", DXCM: "DexCom", IDXX: "IDEXX Labs",
  IQV: "IQVIA", CI: "Cigna", ELV: "Elevance Health", HCA: "HCA Healthcare",
  HUM: "Humana", CNC: "Centene", MRNA: "Moderna", BIIB: "Biogen",
  AZN: "AstraZeneca", NVO: "Novo Nordisk", SNY: "Sanofi",
  // Consumer & Retail
  TGT: "Target", DG: "Dollar General", DLTR: "Dollar Tree",
  ROST: "Ross Stores", TJX: "TJX Companies", LULU: "Lululemon", GPS: "Gap",
  SBUX: "Starbucks", CMG: "Chipotle", YUM: "Yum! Brands", DPZ: "Domino's Pizza",
  ABNB: "Airbnb", BKNG: "Booking Holdings", MAR: "Marriott", HLT: "Hilton",
  EL: "Estee Lauder", CL: "Colgate-Palmolive", CLX: "Clorox", KMB: "Kimberly-Clark",
  GIS: "General Mills", K: "Kellanova", SJM: "JM Smucker", HSY: "Hershey",
  MNST: "Monster Beverage", STZ: "Constellation Brands", BUD: "Anheuser-Busch InBev",
  DEO: "Diageo", TAP: "Molson Coors",
  // Industrials & Defense
  GE: "GE Aerospace", HON: "Honeywell", RTX: "RTX Corp", LMT: "Lockheed Martin",
  NOC: "Northrop Grumman", GD: "General Dynamics", LHX: "L3Harris Technologies",
  DE: "Deere & Company", EMR: "Emerson Electric", ROK: "Rockwell Automation",
  ITW: "Illinois Tool Works", ETN: "Eaton Corp", IR: "Ingersoll Rand",
  FDX: "FedEx", CSX: "CSX Corp", UNP: "Union Pacific", NSC: "Norfolk Southern",
  DAL: "Delta Air Lines", UAL: "United Airlines", AAL: "American Airlines", LUV: "Southwest Airlines",
  WM: "Waste Management", RSG: "Republic Services",
  // Energy
  COP: "ConocoPhillips", SLB: "SLB (Schlumberger)", EOG: "EOG Resources", PXD: "Pioneer Natural Resources",
  MPC: "Marathon Petroleum", VLO: "Valero Energy", PSX: "Phillips 66",
  OKE: "ONEOK", KMI: "Kinder Morgan", WMB: "Williams Companies",
  HAL: "Halliburton", BKR: "Baker Hughes", FANG: "Diamondback Energy",
  // Real Estate / REITs
  AMT: "American Tower", PLD: "Prologis", CCI: "Crown Castle", EQIX: "Equinix",
  PSA: "Public Storage", SPG: "Simon Property Group", O: "Realty Income",
  DLR: "Digital Realty", WELL: "Welltower", AVB: "AvalonBay",
  // Materials & Chemicals
  APD: "Air Products", SHW: "Sherwin-Williams", ECL: "Ecolab", DD: "DuPont",
  DOW: "Dow Inc", FCX: "Freeport-McMoRan", NEM: "Newmont Mining", GOLD: "Barrick Gold",
  NUE: "Nucor", STLD: "Steel Dynamics",
  // Utilities
  DUK: "Duke Energy", SO: "Southern Company", D: "Dominion Energy", AEP: "American Electric Power",
  EXC: "Exelon", SRE: "Sempra", XEL: "Xcel Energy", WEC: "WEC Energy",
  // Telecom & Media
  T: "AT&T", VZ: "Verizon", TMUS: "T-Mobile", CMCSA: "Comcast",
  CHTR: "Charter Communications", WBD: "Warner Bros Discovery", PARA: "Paramount",
  FOX: "Fox Corp", NWSA: "News Corp",
  // Popular ETFs
  SPY: "SPDR S&P 500 ETF", QQQ: "Invesco QQQ (Nasdaq 100)", IWM: "iShares Russell 2000",
  DIA: "SPDR Dow Jones ETF", VOO: "Vanguard S&P 500", VTI: "Vanguard Total Market",
  ARKK: "ARK Innovation ETF", XLF: "Financial Select SPDR", XLE: "Energy Select SPDR",
  XLK: "Technology Select SPDR", XLV: "Health Care Select SPDR", XLI: "Industrial Select SPDR",
  GLD: "SPDR Gold Shares", SLV: "iShares Silver Trust", USO: "United States Oil Fund",
  TLT: "iShares 20+ Year Treasury", HYG: "iShares High Yield Bond", LQD: "iShares Investment Grade Bond",
  EEM: "iShares MSCI Emerging Markets", EFA: "iShares MSCI EAFE", VWO: "Vanguard FTSE Emerging Markets",
  SOXX: "iShares Semiconductor ETF", SMH: "VanEck Semiconductor ETF",
  // International ADRs - China
  BABA: "Alibaba", JD: "JD.com", PDD: "PDD Holdings (Pinduoduo)", BIDU: "Baidu",
  NIO: "NIO Inc", LI: "Li Auto", XPEV: "XPeng", NTES: "NetEase",
  TME: "Tencent Music", BILI: "Bilibili", ZTO: "ZTO Express", VNET: "VNET Group",
  YMM: "Full Truck Alliance", DIDI: "DiDi Global", TAL: "TAL Education", EDU: "New Oriental Education",
  KC: "Kingsoft Cloud", FUTU: "Futu Holdings", TIGR: "UP Fintech",
  // International ADRs - Japan & South Korea
  TSM: "Taiwan Semiconductor", SONY: "Sony Group", TM: "Toyota Motor", HMC: "Honda Motor",
  MUFG: "Mitsubishi UFJ", SMFG: "Sumitomo Mitsui", NMR: "Nomura Holdings",
  KB: "KB Financial Group", SHG: "Shinhan Financial", WF: "Woori Financial",
  LPL: "LG Display", PKX: "POSCO Holdings",
  // International ADRs - Europe & UK
  SAP: "SAP SE", ASML: "ASML Holding", GSK: "GSK plc",
  UL: "Unilever", BP: "BP plc", SHEL: "Shell plc", TTE: "TotalEnergies",
  EQNR: "Equinor", RELX: "RELX Group", ING: "ING Group", HSBC: "HSBC Holdings",
  LYG: "Lloyds Banking", BCS: "Barclays", DB: "Deutsche Bank", UBS: "UBS Group",
  CS: "Credit Suisse", ABB: "ABB Ltd", NVS: "Novartis", RHHBY: "Roche Holding",
  RACE: "Ferrari", PHG: "Philips", ERIC: "Ericsson",
  NOK: "Nokia", SAN: "Banco Santander", BBVA: "BBVA", TEF: "Telefonica",
  VOD: "Vodafone", BTI: "British American Tobacco", RY: "Royal Bank of Canada",
  TD: "Toronto-Dominion Bank", BMO: "Bank of Montreal", BNS: "Bank of Nova Scotia",
  SU: "Suncor Energy", CNQ: "Canadian Natural Resources", ENB: "Enbridge",
  TRP: "TC Energy", CP: "Canadian Pacific", CNI: "Canadian National Railway",
  // International ADRs - Australia & New Zealand
  WDS: "Woodside Energy", BHP: "BHP Group", RIO: "Rio Tinto",
  FMG: "Fortescue Metals", JMIA: "Jumia Technologies",
  // International ADRs - Latin America & Emerging Markets
  SE: "Sea Limited", MELI: "MercadoLibre", NU: "Nu Holdings", GRAB: "Grab Holdings",
  VALE: "Vale SA", PBR: "Petrobras", ITUB: "Itau Unibanco", BBD: "Bradesco",
  ABEV: "Ambev", BSBR: "Banco Santander Brasil",
  SBS: "SABESP", TIMB: "TIM SA", VIST: "Vista Energy",
  INFY: "Infosys", WIT: "Wipro", HDB: "HDFC Bank", IBN: "ICICI Bank",
  TTM: "Tata Motors", VEDL: "Vedanta", RDY: "Dr. Reddy's Labs",
  // International ADRs - Other
  TEVA: "Teva Pharmaceutical", QFIN: "Qifu Technology", WB: "Weibo",
  // Crypto-related stocks
  MSTR: "MicroStrategy", MARA: "Marathon Digital", RIOT: "Riot Platforms", CLSK: "CleanSpark",
  HUT: "Hut 8 Mining", BITF: "Bitfarms",
  // Other popular
  SOFI: "SoFi Technologies", HOOD: "Robinhood", AFRM: "Affirm", UPST: "Upstart",
  LCID: "Lucid Group", FSR: "Fisker", CHWY: "Chewy", DASH: "DoorDash",
  PINS: "Pinterest", ETSY: "Etsy", W: "Wayfair", CPNG: "Coupang",
  DKNG: "DraftKings", PENN: "Penn Entertainment", MGM: "MGM Resorts",
  GM: "General Motors", F: "Ford Motor", STLA: "Stellantis",
  ARM: "Arm Holdings", SMCI: "Super Micro Computer", AI: "C3.ai",
  IONQ: "IonQ", RGTI: "Rigetti Computing", QUBT: "Quantum Computing",
};

const COMPANY_TO_TICKER: Record<string, string> = {};
for (const [ticker, name] of Object.entries(TICKER_TO_COMPANY)) {
  COMPANY_TO_TICKER[name.toLowerCase()] = ticker;
}
COMPANY_TO_TICKER["apple"] = "AAPL";
COMPANY_TO_TICKER["google"] = "GOOGL";
COMPANY_TO_TICKER["alphabet"] = "GOOGL";
COMPANY_TO_TICKER["amazon"] = "AMZN";
COMPANY_TO_TICKER["nvidia"] = "NVDA";
COMPANY_TO_TICKER["tesla"] = "TSLA";
COMPANY_TO_TICKER["microsoft"] = "MSFT";
COMPANY_TO_TICKER["meta"] = "META";
COMPANY_TO_TICKER["facebook"] = "META";
COMPANY_TO_TICKER["berkshire"] = "BRK.B";
COMPANY_TO_TICKER["jpmorgan"] = "JPM";
COMPANY_TO_TICKER["jp morgan"] = "JPM";
COMPANY_TO_TICKER["coca cola"] = "KO";
COMPANY_TO_TICKER["coca-cola"] = "KO";
COMPANY_TO_TICKER["home depot"] = "HD";
COMPANY_TO_TICKER["salesforce"] = "CRM";
COMPANY_TO_TICKER["disney"] = "DIS";
COMPANY_TO_TICKER["boeing"] = "BA";
COMPANY_TO_TICKER["netflix"] = "NFLX";
COMPANY_TO_TICKER["paypal"] = "PYPL";
COMPANY_TO_TICKER["adobe"] = "ADBE";
COMPANY_TO_TICKER["uber"] = "UBER";
COMPANY_TO_TICKER["shopify"] = "SHOP";
COMPANY_TO_TICKER["spotify"] = "SPOT";
COMPANY_TO_TICKER["snap"] = "SNAP";
COMPANY_TO_TICKER["snapchat"] = "SNAP";
COMPANY_TO_TICKER["walmart"] = "WMT";
COMPANY_TO_TICKER["intel"] = "INTC";
COMPANY_TO_TICKER["oracle"] = "ORCL";
COMPANY_TO_TICKER["nike"] = "NKE";
COMPANY_TO_TICKER["caterpillar"] = "CAT";
COMPANY_TO_TICKER["exxon"] = "XOM";
COMPANY_TO_TICKER["exxonmobil"] = "XOM";
COMPANY_TO_TICKER["chevron"] = "CVX";
COMPANY_TO_TICKER["costco"] = "COST";
COMPANY_TO_TICKER["mcdonald's"] = "MCD";
COMPANY_TO_TICKER["mcdonalds"] = "MCD";
COMPANY_TO_TICKER["pepsi"] = "PEP";
COMPANY_TO_TICKER["pepsico"] = "PEP";
COMPANY_TO_TICKER["cisco"] = "CSCO";
COMPANY_TO_TICKER["coinbase"] = "COIN";
COMPANY_TO_TICKER["palantir"] = "PLTR";
COMPANY_TO_TICKER["zoom"] = "ZM";
COMPANY_TO_TICKER["broadcom"] = "AVGO";
COMPANY_TO_TICKER["amd"] = "AMD";
COMPANY_TO_TICKER["morgan stanley"] = "MS";
COMPANY_TO_TICKER["goldman sachs"] = "GS";
COMPANY_TO_TICKER["goldman"] = "GS";
COMPANY_TO_TICKER["bank of america"] = "BAC";
COMPANY_TO_TICKER["wells fargo"] = "WFC";
COMPANY_TO_TICKER["citigroup"] = "C";
COMPANY_TO_TICKER["citi"] = "C";
COMPANY_TO_TICKER["schwab"] = "SCHW";
COMPANY_TO_TICKER["charles schwab"] = "SCHW";
COMPANY_TO_TICKER["blackrock"] = "BLK";
COMPANY_TO_TICKER["american express"] = "AXP";
COMPANY_TO_TICKER["amex"] = "AXP";
COMPANY_TO_TICKER["capital one"] = "COF";
COMPANY_TO_TICKER["pfizer"] = "PFE";
COMPANY_TO_TICKER["moderna"] = "MRNA";
COMPANY_TO_TICKER["novo nordisk"] = "NVO";
COMPANY_TO_TICKER["astrazeneca"] = "AZN";
COMPANY_TO_TICKER["starbucks"] = "SBUX";
COMPANY_TO_TICKER["chipotle"] = "CMG";
COMPANY_TO_TICKER["airbnb"] = "ABNB";
COMPANY_TO_TICKER["target"] = "TGT";
COMPANY_TO_TICKER["lululemon"] = "LULU";
COMPANY_TO_TICKER["doordash"] = "DASH";
COMPANY_TO_TICKER["pinterest"] = "PINS";
COMPANY_TO_TICKER["etsy"] = "ETSY";
COMPANY_TO_TICKER["draftkings"] = "DKNG";
COMPANY_TO_TICKER["robinhood"] = "HOOD";
COMPANY_TO_TICKER["sofi"] = "SOFI";
COMPANY_TO_TICKER["affirm"] = "AFRM";
COMPANY_TO_TICKER["crowdstrike"] = "CRWD";
COMPANY_TO_TICKER["cloudflare"] = "NET";
COMPANY_TO_TICKER["woodside"] = "WDS";
COMPANY_TO_TICKER["woodside energy"] = "WDS";
COMPANY_TO_TICKER["bhp"] = "BHP";
COMPANY_TO_TICKER["bhp group"] = "BHP";
COMPANY_TO_TICKER["rio tinto"] = "RIO";
COMPANY_TO_TICKER["fortescue"] = "FMG";
COMPANY_TO_TICKER["fortescue metals"] = "FMG";
COMPANY_TO_TICKER["alibaba"] = "BABA";
COMPANY_TO_TICKER["baidu"] = "BIDU";
COMPANY_TO_TICKER["bilibili"] = "BILI";
COMPANY_TO_TICKER["netease"] = "NTES";
COMPANY_TO_TICKER["nio"] = "NIO";
COMPANY_TO_TICKER["xpeng"] = "XPEV";
COMPANY_TO_TICKER["li auto"] = "LI";
COMPANY_TO_TICKER["didi"] = "DIDI";
COMPANY_TO_TICKER["tencent music"] = "TME";
COMPANY_TO_TICKER["futu"] = "FUTU";
COMPANY_TO_TICKER["toyota"] = "TM";
COMPANY_TO_TICKER["honda"] = "HMC";
COMPANY_TO_TICKER["sony"] = "SONY";
COMPANY_TO_TICKER["mitsubishi ufj"] = "MUFG";
COMPANY_TO_TICKER["nomura"] = "NMR";
COMPANY_TO_TICKER["posco"] = "PKX";
COMPANY_TO_TICKER["tsmc"] = "TSM";
COMPANY_TO_TICKER["taiwan semiconductor"] = "TSM";
COMPANY_TO_TICKER["samsung"] = "SSNLF";
COMPANY_TO_TICKER["unilever"] = "UL";
COMPANY_TO_TICKER["bp"] = "BP";
COMPANY_TO_TICKER["shell"] = "SHEL";
COMPANY_TO_TICKER["totalenergies"] = "TTE";
COMPANY_TO_TICKER["total energies"] = "TTE";
COMPANY_TO_TICKER["hsbc"] = "HSBC";
COMPANY_TO_TICKER["barclays"] = "BCS";
COMPANY_TO_TICKER["lloyds"] = "LYG";
COMPANY_TO_TICKER["deutsche bank"] = "DB";
COMPANY_TO_TICKER["ubs"] = "UBS";
COMPANY_TO_TICKER["credit suisse"] = "CS";
COMPANY_TO_TICKER["novartis"] = "NVS";
COMPANY_TO_TICKER["roche"] = "RHHBY";
COMPANY_TO_TICKER["ferrari"] = "RACE";
COMPANY_TO_TICKER["nokia"] = "NOK";
COMPANY_TO_TICKER["ericsson"] = "ERIC";
COMPANY_TO_TICKER["philips"] = "PHG";
COMPANY_TO_TICKER["vodafone"] = "VOD";
COMPANY_TO_TICKER["santander"] = "SAN";
COMPANY_TO_TICKER["banco santander"] = "SAN";
COMPANY_TO_TICKER["gsk"] = "GSK";
COMPANY_TO_TICKER["glaxosmithkline"] = "GSK";
COMPANY_TO_TICKER["equinor"] = "EQNR";
COMPANY_TO_TICKER["ing"] = "ING";
COMPANY_TO_TICKER["ing group"] = "ING";
COMPANY_TO_TICKER["sanofi"] = "SNY";
COMPANY_TO_TICKER["vale"] = "VALE";
COMPANY_TO_TICKER["petrobras"] = "PBR";
COMPANY_TO_TICKER["mercadolibre"] = "MELI";
COMPANY_TO_TICKER["nubank"] = "NU";
COMPANY_TO_TICKER["nu bank"] = "NU";
COMPANY_TO_TICKER["ambev"] = "ABEV";
COMPANY_TO_TICKER["infosys"] = "INFY";
COMPANY_TO_TICKER["wipro"] = "WIT";
COMPANY_TO_TICKER["hdfc bank"] = "HDB";
COMPANY_TO_TICKER["hdfc"] = "HDB";
COMPANY_TO_TICKER["icici bank"] = "IBN";
COMPANY_TO_TICKER["icici"] = "IBN";
COMPANY_TO_TICKER["tata motors"] = "TTM";
COMPANY_TO_TICKER["tata"] = "TTM";
COMPANY_TO_TICKER["vedanta"] = "VEDL";
COMPANY_TO_TICKER["dr reddy"] = "RDY";
COMPANY_TO_TICKER["dr. reddy's"] = "RDY";
COMPANY_TO_TICKER["teva"] = "TEVA";
COMPANY_TO_TICKER["royal bank of canada"] = "RY";
COMPANY_TO_TICKER["td bank"] = "TD";
COMPANY_TO_TICKER["toronto dominion"] = "TD";
COMPANY_TO_TICKER["enbridge"] = "ENB";
COMPANY_TO_TICKER["canadian pacific"] = "CP";
COMPANY_TO_TICKER["suncor"] = "SU";
COMPANY_TO_TICKER["grab"] = "GRAB";
COMPANY_TO_TICKER["sea limited"] = "SE";
COMPANY_TO_TICKER["datadog"] = "DDOG";
COMPANY_TO_TICKER["snowflake"] = "SNOW";
COMPANY_TO_TICKER["mongodb"] = "MDB";
COMPANY_TO_TICKER["servicenow"] = "NOW";
COMPANY_TO_TICKER["palo alto"] = "PANW";
COMPANY_TO_TICKER["palo alto networks"] = "PANW";
COMPANY_TO_TICKER["ford"] = "F";
COMPANY_TO_TICKER["general motors"] = "GM";
COMPANY_TO_TICKER["lockheed"] = "LMT";
COMPANY_TO_TICKER["lockheed martin"] = "LMT";
COMPANY_TO_TICKER["honeywell"] = "HON";
COMPANY_TO_TICKER["fedex"] = "FDX";
COMPANY_TO_TICKER["delta"] = "DAL";
COMPANY_TO_TICKER["united airlines"] = "UAL";
COMPANY_TO_TICKER["southwest"] = "LUV";
COMPANY_TO_TICKER["southwest airlines"] = "LUV";
COMPANY_TO_TICKER["alibaba"] = "BABA";
COMPANY_TO_TICKER["tsmc"] = "TSM";
COMPANY_TO_TICKER["taiwan semiconductor"] = "TSM";
COMPANY_TO_TICKER["sony"] = "SONY";
COMPANY_TO_TICKER["toyota"] = "TM";
COMPANY_TO_TICKER["microstrategy"] = "MSTR";
COMPANY_TO_TICKER["at&t"] = "T";
COMPANY_TO_TICKER["att"] = "T";
COMPANY_TO_TICKER["verizon"] = "VZ";
COMPANY_TO_TICKER["t-mobile"] = "TMUS";
COMPANY_TO_TICKER["tmobile"] = "TMUS";
COMPANY_TO_TICKER["comcast"] = "CMCSA";
COMPANY_TO_TICKER["arm"] = "ARM";
COMPANY_TO_TICKER["roblox"] = "RBLX";
COMPANY_TO_TICKER["lucid"] = "LCID";
COMPANY_TO_TICKER["rivian"] = "RIVN";
COMPANY_TO_TICKER["marriott"] = "MAR";
COMPANY_TO_TICKER["hilton"] = "HLT";
COMPANY_TO_TICKER["duke energy"] = "DUK";
COMPANY_TO_TICKER["micron"] = "MU";
COMPANY_TO_TICKER["super micro"] = "SMCI";
COMPANY_TO_TICKER["supermicro"] = "SMCI";

function detectAnalysisType(question: string): FinancialIntent["analysisType"] {
  const q = question.toLowerCase();
  if (/\b(margin|profit(ability)?|earnings|gross margin|operating margin|net margin|ebitda)\b/.test(q)) return "profitability";
  if (/\b(growth|trend|increasing|declining|yoy|year over year|quarter over quarter|qoq)\b/.test(q)) return "growth";
  if (/\b(compare|vs\.?|versus|difference between|against)\b/.test(q)) return "comparison";
  if (/\b(valuation|p\/e|pe ratio|price to earnings|market cap|price-to-book|ev\/ebitda)\b/.test(q)) return "valuation";
  if (/\b(cash\s*flow|free cash flow|fcf|operating cash|capex|capital expenditure)\b/.test(q)) return "cashflow";
  if (/\b(debt|leverage|liabilities|solvency|debt.to.equity|interest coverage)\b/.test(q)) return "debt";
  if (/\b(overview|financial health|how is .+ doing|analyze|analysis|summary|overall)\b/.test(q)) return "overview";
  return "general";
}

export function detectFinancialIntent(question: string): FinancialIntent {
  const result: FinancialIntent = {
    isFinancial: false,
    ticker: null,
    companyName: null,
    analysisType: "general",
    originalQuestion: question,
    comparisonTickers: [],
  };

  const allDetected: { ticker: string; companyName: string }[] = [];

  const tickerMatches = question.match(/\$([A-Z]{1,5}(?:\.[A-Z])?)/g);
  if (tickerMatches) {
    for (const match of tickerMatches) {
      const t = match.replace("$", "");
      if (TICKER_TO_COMPANY[t] && !allDetected.some(d => d.ticker === t)) {
        allDetected.push({ ticker: t, companyName: TICKER_TO_COMPANY[t] });
      }
    }
  }

  const upperMatch = question.match(/\b([A-Z]{2,5}(?:\.[A-Z])?)\b/g);
  if (upperMatch) {
    for (const candidate of upperMatch) {
      if (TICKER_TO_COMPANY[candidate] && !allDetected.some(d => d.ticker === candidate)) {
        allDetected.push({ ticker: candidate, companyName: TICKER_TO_COMPANY[candidate] });
      }
    }
  }

  const lowerQ = question.toLowerCase();
  for (const [name, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escapedName}\\b`, "i").test(lowerQ)) {
      if (!allDetected.some(d => d.ticker === ticker)) {
        allDetected.push({ ticker, companyName: TICKER_TO_COMPANY[ticker] || name });
      }
    }
  }

  if (allDetected.length > 0) {
    result.ticker = allDetected[0].ticker;
    result.companyName = allDetected[0].companyName;
    result.isFinancial = true;
    if (allDetected.length > 1) {
      result.comparisonTickers = allDetected.slice(1);
    }
  }

  if (result.isFinancial) {
    result.analysisType = detectAnalysisType(question);
    if (allDetected.length > 1 && result.analysisType !== "comparison") {
      result.analysisType = "comparison";
    }
  }

  if (!result.isFinancial) {
    const financialKeywords = /\b(revenue|earnings|balance sheet|income statement|cash flow|dividend|stock|share price|market cap|p\/e|eps|roe|roa|financial|fiscal|quarterly results|annual report)\b/i;
    if (financialKeywords.test(question)) {
      result.isFinancial = true;
      result.analysisType = detectAnalysisType(question);
    }
  }

  if (!result.ticker) {
    const forOfMatch = question.match(/\b(?:for|of|about|on|analyse|analyze)\s+([A-Z][a-zA-Z\s&'.,-]+?)(?:\?|$|\.|,|\s*(?:and|vs|versus|compared|including|covering))/i);
    if (forOfMatch) {
      let candidate = forOfMatch[1].trim().replace(/[.,?!]+$/, "").trim();
      if (candidate.length >= 2 && candidate.length <= 40) {
        const candidateUpper = candidate.toUpperCase();
        if (TICKER_TO_COMPANY[candidateUpper]) {
          result.ticker = candidateUpper;
          result.companyName = TICKER_TO_COMPANY[candidateUpper];
          result.isFinancial = true;
        } else if (COMPANY_TO_TICKER[candidate.toLowerCase()]) {
          const t = COMPANY_TO_TICKER[candidate.toLowerCase()];
          result.ticker = t;
          result.companyName = TICKER_TO_COMPANY[t] || candidate;
          result.isFinancial = true;
        } else {
          const fuzzyResult = fuzzyMatchCompany(candidate);
          if (fuzzyResult) {
            result.ticker = fuzzyResult.ticker;
            result.companyName = fuzzyResult.companyName;
            result.isFinancial = true;
          } else {
            result.ticker = candidate;
            result.companyName = candidate;
            result.isFinancial = true;
            result.needsLookup = true;
          }
        }
        if (result.isFinancial && !result.analysisType) {
          result.analysisType = detectAnalysisType(question);
        }
      }
    }
  }

  return result;
}

function levenshteinCompany(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function fuzzyMatchCompany(input: string): { ticker: string; companyName: string } | null {
  const lower = input.toLowerCase().trim();
  if (COMPANY_TO_TICKER[lower]) {
    const t = COMPANY_TO_TICKER[lower];
    return { ticker: t, companyName: TICKER_TO_COMPANY[t] || lower };
  }

  let bestMatch: { ticker: string; companyName: string; dist: number } | null = null;
  for (const [name, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    if (name.length < 3) continue;
    const dist = levenshteinCompany(lower, name);
    const maxLen = Math.max(lower.length, name.length);
    if (dist <= 2 && dist / maxLen <= 0.3) {
      if (!bestMatch || dist < bestMatch.dist) {
        bestMatch = { ticker, companyName: TICKER_TO_COMPANY[ticker] || name, dist };
      }
    }
  }
  return bestMatch ? { ticker: bestMatch.ticker, companyName: bestMatch.companyName } : null;
}

export interface StockCategory {
  category: string;
  stocks: { ticker: string; name: string }[];
}

export function getAvailableStocks(): StockCategory[] {
  const categories: StockCategory[] = [
    { category: "Tech Giants", stocks: [
      { ticker: "AAPL", name: "Apple" }, { ticker: "MSFT", name: "Microsoft" },
      { ticker: "GOOGL", name: "Alphabet" }, { ticker: "AMZN", name: "Amazon" },
      { ticker: "NVDA", name: "NVIDIA" }, { ticker: "META", name: "Meta" },
      { ticker: "TSLA", name: "Tesla" },
    ]},
    { category: "Semiconductors", stocks: [
      { ticker: "AVGO", name: "Broadcom" }, { ticker: "AMD", name: "AMD" },
      { ticker: "INTC", name: "Intel" }, { ticker: "QCOM", name: "Qualcomm" },
      { ticker: "TSM", name: "TSMC" }, { ticker: "MU", name: "Micron" },
      { ticker: "ARM", name: "Arm Holdings" }, { ticker: "SMCI", name: "Super Micro" },
    ]},
    { category: "Finance & Banking", stocks: [
      { ticker: "JPM", name: "JPMorgan" }, { ticker: "BAC", name: "Bank of America" },
      { ticker: "GS", name: "Goldman Sachs" }, { ticker: "MS", name: "Morgan Stanley" },
      { ticker: "V", name: "Visa" }, { ticker: "MA", name: "Mastercard" },
      { ticker: "BLK", name: "BlackRock" }, { ticker: "SCHW", name: "Schwab" },
    ]},
    { category: "Healthcare", stocks: [
      { ticker: "UNH", name: "UnitedHealth" }, { ticker: "JNJ", name: "J&J" },
      { ticker: "LLY", name: "Eli Lilly" }, { ticker: "PFE", name: "Pfizer" },
      { ticker: "MRNA", name: "Moderna" }, { ticker: "NVO", name: "Novo Nordisk" },
      { ticker: "ABBV", name: "AbbVie" }, { ticker: "ISRG", name: "Intuitive Surgical" },
    ]},
    { category: "Consumer", stocks: [
      { ticker: "WMT", name: "Walmart" }, { ticker: "COST", name: "Costco" },
      { ticker: "KO", name: "Coca-Cola" }, { ticker: "PEP", name: "PepsiCo" },
      { ticker: "MCD", name: "McDonald's" }, { ticker: "SBUX", name: "Starbucks" },
      { ticker: "NKE", name: "Nike" }, { ticker: "DIS", name: "Disney" },
    ]},
    { category: "Energy & Materials", stocks: [
      { ticker: "XOM", name: "ExxonMobil" }, { ticker: "CVX", name: "Chevron" },
      { ticker: "COP", name: "ConocoPhillips" }, { ticker: "FCX", name: "Freeport" },
      { ticker: "GOLD", name: "Barrick Gold" }, { ticker: "NEM", name: "Newmont" },
    ]},
    { category: "Popular ETFs", stocks: [
      { ticker: "SPY", name: "S&P 500 ETF" }, { ticker: "QQQ", name: "Nasdaq 100" },
      { ticker: "IWM", name: "Russell 2000" }, { ticker: "GLD", name: "Gold ETF" },
      { ticker: "ARKK", name: "ARK Innovation" }, { ticker: "SOXX", name: "Semiconductor ETF" },
    ]},
  ];
  return categories;
}

export async function generateComparisonAnalysis(
  companies: { intent: FinancialIntent; financials: FinancialData; metrics: FinancialMetrics[]; priceSnapshot: PriceSnapshot | null }[],
  userQuestion: string,
  documentContext?: string
): Promise<{ answer: string; dataUsed: { statements: number; periods: string[] } }> {
  const companyNames = companies.map(c => c.intent.companyName || c.intent.ticker).join(" vs ");
  let totalStatements = 0;
  const allPeriods: string[] = [];

  let dataContext = "";
  for (const company of companies) {
    const name = company.intent.companyName || company.intent.ticker;
    dataContext += `\n\n=== ${name} (${company.intent.ticker}) ===\n\n`;

    if (company.financials.income_statements.length > 0) {
      dataContext += "Income Statements:\n" + JSON.stringify(company.financials.income_statements.slice(0, 4), null, 2) + "\n\n";
    }
    if (company.financials.balance_sheets.length > 0) {
      dataContext += "Balance Sheets:\n" + JSON.stringify(company.financials.balance_sheets.slice(0, 4), null, 2) + "\n\n";
    }
    if (company.financials.cash_flow_statements.length > 0) {
      dataContext += "Cash Flow:\n" + JSON.stringify(company.financials.cash_flow_statements.slice(0, 4), null, 2) + "\n\n";
    }
    if (company.metrics.length > 0) {
      dataContext += "Metrics:\n" + JSON.stringify(company.metrics, null, 2) + "\n\n";
    }
    if (company.priceSnapshot) {
      dataContext += "Price: " + JSON.stringify(company.priceSnapshot, null, 2) + "\n\n";
    }

    totalStatements += company.financials.income_statements.length + company.financials.balance_sheets.length + company.financials.cash_flow_statements.length;
    company.metrics.forEach(m => allPeriods.push(m.report_period));
  }

  const hybridInstructions = documentContext
    ? `\n\nHYBRID COMPARISON MODE: The user has uploaded their own financial documents. Compare the data from the user's uploaded documents against the live SEC filing data for the external companies. Highlight differences, strengths, and weaknesses of each. Clearly indicate which data comes from the user's documents vs SEC filings.`
    : "";

  const systemPrompt = `You are a senior financial analyst providing a detailed comparative analysis between ${companyNames}.${hybridInstructions}

Guidelines:
- Provide a thorough, detailed comparative analysis — not a brief summary
- Create a clear side-by-side comparison using markdown tables
- Highlight key differences in performance, margins, growth, and valuation with exact figures
- Calculate percentage differences and growth rates for each company
- Identify which company is stronger in each metric category and explain why
- Discuss trends across multiple periods for both companies
- Provide an overall investment perspective with supporting data
- Use markdown formatting with ## headings, **bold** key figures, tables, and bullet points
- Structure with clear sections (e.g. Revenue Comparison, Profitability, Growth Trends, Summary)`;

  const answer = await chatFinance([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Compare these companies:\n\n${dataContext}\n\nUser question: ${userQuestion}` },
  ]);

  return {
    answer,
    dataUsed: {
      statements: totalStatements,
      periods: Array.from(new Set(allPeriods)),
    },
  };
}

export async function generateFinancialAnalysis(
  intent: FinancialIntent,
  financials: FinancialData,
  metrics: FinancialMetrics[],
  priceSnapshot: PriceSnapshot | null,
  userQuestion: string,
  documentContext?: string,
  eodhdContext?: string
): Promise<{ answer: string; dataUsed: { statements: number; periods: string[] } }> {
  const periods = metrics.map(m => m.report_period);
  const statementsCount = financials.income_statements.length + financials.balance_sheets.length + financials.cash_flow_statements.length;

  const hybridInstructions = documentContext
    ? `\n\nHYBRID ANALYSIS MODE: The user has uploaded financial documents. You have BOTH live SEC filing data AND the user's uploaded document content. Your analysis should:
- Compare data from the user's uploaded documents against live SEC filings where relevant
- Highlight any discrepancies or differences between the two data sources
- Note which insights come from SEC filings vs the user's documents
- Provide a comprehensive view that combines both sources
- If the user's documents contain projections or internal data not in SEC filings, incorporate those insights`
    : "";

  const systemPrompt = `You are a senior financial analyst providing detailed, data-driven analysis. You have access to real financial statements and calculated metrics for ${intent.companyName || intent.ticker}.${hybridInstructions}

Use the provided financial data to answer the user's question thoroughly and comprehensively. Be precise with numbers, cite specific periods, and highlight trends.

Guidelines:
- Provide a thorough, in-depth analysis — aim for at least 500-800 words for thesis/recommendation queries
- Use exact figures from the data provided
- Calculate and highlight important ratios and trends (e.g. revenue growth %, margin changes, debt ratios)
- Compare across multiple periods to show trajectory and patterns
- Include a data table or comparison where numbers are involved
- Provide actionable insights and explain what the numbers mean for the company
- Use markdown formatting with ## headings, **bold** key figures, bullet points, and tables
- Structure your response with clear sections (e.g. Overview, Key Metrics, Trends, Analysis, Risks, Conclusion)
- For investment thesis queries: include Bull Case, Bear Case, Financial Highlights, Valuation Assessment, Key Risks, Catalysts, and Conviction Level with detailed reasoning for each
- For Buy/Hold/Sell queries: include a detailed scoring framework covering Growth, Profitability, Valuation, Financial Health, and Momentum
- If data is insufficient for a complete answer, state what is available and what is missing
- If the user asks for a Buy/Hold/Sell signal or investment recommendation, provide your data-driven assessment but ALWAYS end with this disclaimer: "**Disclaimer:** This analysis is based solely on publicly available financial data and is for informational purposes only. It does not constitute financial advice. Evident is not responsible for investment decisions. Always consult a qualified financial advisor before making investment decisions."`;

  let dataContext = "";

  if (financials.income_statements.length > 0) {
    dataContext += "## Income Statements\n" + JSON.stringify(financials.income_statements, null, 2) + "\n\n";
  }
  if (financials.balance_sheets.length > 0) {
    dataContext += "## Balance Sheets\n" + JSON.stringify(financials.balance_sheets, null, 2) + "\n\n";
  }
  if (financials.cash_flow_statements.length > 0) {
    dataContext += "## Cash Flow Statements\n" + JSON.stringify(financials.cash_flow_statements, null, 2) + "\n\n";
  }
  if (metrics.length > 0) {
    dataContext += "## Calculated Metrics\n" + JSON.stringify(metrics, null, 2) + "\n\n";
  }
  if (priceSnapshot) {
    dataContext += "## Current Price Snapshot\n" + JSON.stringify(priceSnapshot, null, 2) + "\n\n";
  }

  if (eodhdContext) {
    dataContext += "## EODHD Fundamentals & Real-Time Data\n" + eodhdContext + "\n\n";
  }

  const userMessage = `Financial data for ${intent.companyName || intent.ticker}:\n\n${dataContext}\n\nUser question: ${userQuestion}`;

  const answer = await chatFinance([
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ]);

  return {
    answer,
    dataUsed: {
      statements: statementsCount,
      periods,
    },
  };
}

export function generateResourceLinks(ticker: string, companyName?: string, isCrypto: boolean = false): string {
  if (isCrypto) {
    const coinId = ticker.toLowerCase();
    return `\n\n## Learn More\n` +
      `- [CoinGecko — ${companyName || ticker}](https://www.coingecko.com/en/coins/${coinId})\n` +
      `- [CoinMarketCap — ${companyName || ticker}](https://coinmarketcap.com/currencies/${coinId}/)\n` +
      `- [Messari — Research](https://messari.io/asset/${coinId})\n`;
  }

  const t = ticker.toUpperCase();
  const name = companyName || t;
  return `\n\n## Learn More\n` +
    `- [SEC EDGAR — ${name} Filings](https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(name)}&type=10-K&dateb=&owner=include&count=10&search_text=&action=getcompany)\n` +
    `- [Yahoo Finance — ${t}](https://finance.yahoo.com/quote/${t})\n` +
    `- [Google Finance — ${t}](https://www.google.com/finance/quote/${t}:NASDAQ)\n` +
    `- [Macrotrends — ${name}](https://www.macrotrends.net/stocks/charts/${t}/${name.toLowerCase().replace(/\s+/g, '-')}/revenue)\n`;
}
