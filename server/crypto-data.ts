import { metrics } from "./metrics";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const CACHE_TTL = 60 * 1000;
const REQUEST_TIMEOUT = 10000;

interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  high_24h: number;
  low_24h: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  last_updated: string;
}

export interface CryptoSnapshot {
  id: string;
  symbol: string;
  name: string;
  price: number;
  priceFormatted: string;
  change24h: number;
  change7d: number | null;
  change30d: number | null;
  marketCap: number;
  marketCapFormatted: string;
  marketCapRank: number;
  volume24h: number;
  volumeFormatted: string;
  high24h: number;
  low24h: number;
  ath: number;
  athChangePercent: number;
  circulatingSupply: number;
  maxSupply: number | null;
  lastUpdated: string;
}

const CRYPTO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin", BITCOIN: "bitcoin",
  ETH: "ethereum", ETHEREUM: "ethereum",
  BNB: "binancecoin", SOL: "solana", SOLANA: "solana",
  XRP: "ripple", RIPPLE: "ripple",
  ADA: "cardano", CARDANO: "cardano",
  DOGE: "dogecoin", DOGECOIN: "dogecoin",
  DOT: "polkadot", POLKADOT: "polkadot",
  AVAX: "avalanche-2", AVALANCHE: "avalanche-2",
  MATIC: "matic-network", POLYGON: "matic-network",
  LINK: "chainlink", CHAINLINK: "chainlink",
  UNI: "uniswap", UNISWAP: "uniswap",
  ATOM: "cosmos", COSMOS: "cosmos",
  LTC: "litecoin", LITECOIN: "litecoin",
  FIL: "filecoin", FILECOIN: "filecoin",
  NEAR: "near", APT: "aptos", APTOS: "aptos",
  ARB: "arbitrum", ARBITRUM: "arbitrum",
  OP: "optimism", OPTIMISM: "optimism",
  SHIB: "shiba-inu", ICP: "internet-computer",
  TRX: "tron", TRON: "tron",
  AAVE: "aave", MKR: "maker", MAKER: "maker",
  CRO: "crypto-com-chain", PEPE: "pepe",
  SUI: "sui", SEI: "sei-network",
  RENDER: "render-token", INJ: "injective-protocol",
  TIA: "celestia", STX: "blockstack",
  ALGO: "algorand", ALGORAND: "algorand",
  XLM: "stellar", STELLAR: "stellar",
  HBAR: "hedera-hashgraph", HEDERA: "hedera-hashgraph",
  VET: "vechain", VECHAIN: "vechain",
  FTM: "fantom", FANTOM: "fantom",
  SAND: "the-sandbox", MANA: "decentraland",
  AXS: "axie-infinity", GALA: "gala",
  ENS: "ethereum-name-service",
  WLD: "worldcoin-wld", WORLDCOIN: "worldcoin-wld",
  TON: "the-open-network", TONCOIN: "the-open-network",
  BONK: "bonk", WIF: "dogwifcoin",
  JUP: "jupiter-exchange-solana",
  ETC: "ethereum-classic", THETA: "theta-token",
  XTZ: "tezos", TEZOS: "tezos",
  EOS: "eos", NEO: "neo", IOTA: "iota",
  XMR: "monero", MONERO: "monero",
  ZEC: "zcash", ZCASH: "zcash",
  DASH: "dash", KCS: "kucoin-shares",
  CKB: "nervos-network", NERVOS: "nervos-network",
  FLOW: "flow", EGLD: "elrond-erd-2", MULTIVERSX: "elrond-erd-2",
  KAVA: "kava", ONE: "harmony", HARMONY: "harmony",
  ROSE: "oasis-network", OASIS: "oasis-network",
  ZIL: "zilliqa", ZILLIQA: "zilliqa",
  QTUM: "qtum", ONT: "ontology", ONTOLOGY: "ontology",
  ICX: "icon", ICON: "icon",
  CELO: "celo", KSM: "kusama", KUSAMA: "kusama",
  COMP: "compound-governance-token", COMPOUND: "compound-governance-token",
  SNX: "havven", SYNTHETIX: "havven",
  YFI: "yearn-finance", YEARN: "yearn-finance",
  SUSHI: "sushi", SUSHISWAP: "sushi",
  CRV: "curve-dao-token", CURVE: "curve-dao-token",
  BAL: "balancer", BALANCER: "balancer",
  "1INCH": "1inch", LDO: "lido-dao", LIDO: "lido-dao",
  RPL: "rocket-pool", ROCKETPOOL: "rocket-pool",
  GMX: "gmx", DYDX: "dydx",
  FET: "fetch-ai", FETCH: "fetch-ai",
  RNDR: "render-token",
  OCEAN: "ocean-protocol",
  AGIX: "singularitynet", SINGULARITY: "singularitynet",
  GRT: "the-graph", THEGRAPH: "the-graph",
  AR: "arweave", ARWEAVE: "arweave",
  AKT: "akash-network", AKASH: "akash-network",
  PYTH: "pyth-network",
  JTO: "jito-governance-token", JITO: "jito-governance-token",
  W: "wormhole", WORMHOLE: "wormhole",
  STRK: "starknet", STARKNET: "starknet",
  ONDO: "ondo-finance",
  PENDLE: "pendle",
  ENA: "ethena", ETHENA: "ethena",
  MEME: "memecoin-2",
  ORDI: "ordinals", ORDINALS: "ordinals",
  RUNE: "thorchain", THORCHAIN: "thorchain",
  FLR: "flare-networks", FLARE: "flare-networks",
  MINA: "mina-protocol",
  CFX: "conflux-token", CONFLUX: "conflux-token",
  IMX: "immutable-x", IMMUTABLE: "immutable-x",
  BLUR: "blur",
  APE: "apecoin", APECOIN: "apecoin",
  MASK: "mask-network",
  LRC: "loopring", LOOPRING: "loopring",
  ANKR: "ankr",
  SKL: "skale", SKALE: "skale",
  JASMY: "jasmycoin",
  CHZ: "chiliz", CHILIZ: "chiliz",
  HOT: "holotoken", HOLO: "holotoken",
  WAVES: "waves",
  STORJ: "storj",
  BAT: "basic-attention-token",
  ZRX: "0x", USDT: "tether", USDC: "usd-coin",
  DAI: "dai", BUSD: "binance-usd",
  TUSD: "true-usd", FRAX: "frax",
  FLOKI: "floki", TURBO: "turbo",
  NEIRO: "neiro-on-eth",
  POPCAT: "popcat",
  MEW: "cat-in-a-dogs-world",
  BOME: "book-of-meme",
  TAO: "bittensor", BITTENSOR: "bittensor",
  KAS: "kaspa", KASPA: "kaspa",
  QNT: "quant-network", QUANT: "quant-network",
  ASTR: "astar", ASTAR: "astar",
};

const CRYPTO_NAME_MAP: Record<string, string> = {};
for (const [key, id] of Object.entries(CRYPTO_ID_MAP)) {
  CRYPTO_NAME_MAP[key.toLowerCase()] = id;
}

function levenshtein(a: string, b: string): number {
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

export function fuzzyMatchCrypto(input: string): { id: string; key: string } | null {
  const lower = input.toLowerCase().trim();
  if (CRYPTO_NAME_MAP[lower]) return { id: CRYPTO_NAME_MAP[lower], key: lower.toUpperCase() };

  let bestMatch: { id: string; key: string; dist: number } | null = null;
  for (const [key, id] of Object.entries(CRYPTO_NAME_MAP)) {
    if (key.length < 3) continue;
    const dist = levenshtein(lower, key);
    const maxLen = Math.max(lower.length, key.length);
    const maxDist = maxLen <= 4 ? 1 : 2;
    if (dist <= maxDist && dist / maxLen <= 0.25) {
      if (!bestMatch || dist < bestMatch.dist) {
        bestMatch = { id, key: key.toUpperCase(), dist };
      }
    }
  }
  return bestMatch ? { id: bestMatch.id, key: bestMatch.key } : null;
}

const priceCache = new Map<string, { data: CryptoSnapshot; timestamp: number }>();
let topCoinsCacheRef: { data: CryptoSnapshot[]; timestamp: number } | null = null;

function formatCurrency(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1) return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${value.toFixed(6)}`;
}

function transformCryptoData(coin: CryptoPrice): CryptoSnapshot {
  return {
    id: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    price: coin.current_price,
    priceFormatted: formatCurrency(coin.current_price),
    change24h: coin.price_change_percentage_24h || 0,
    change7d: coin.price_change_percentage_7d_in_currency || null,
    change30d: coin.price_change_percentage_30d_in_currency || null,
    marketCap: coin.market_cap,
    marketCapFormatted: formatCurrency(coin.market_cap),
    marketCapRank: coin.market_cap_rank,
    volume24h: coin.total_volume,
    volumeFormatted: formatCurrency(coin.total_volume),
    high24h: coin.high_24h,
    low24h: coin.low_24h,
    ath: coin.ath,
    athChangePercent: coin.ath_change_percentage,
    circulatingSupply: coin.circulating_supply,
    maxSupply: coin.max_supply,
    lastUpdated: coin.last_updated,
  };
}

export function detectCryptoIntent(question: string): { isCrypto: boolean; cryptoIds: string[]; cryptoNames: string[] } {
  const result = { isCrypto: false, cryptoIds: [] as string[], cryptoNames: [] as string[] };

  const cryptoKeywords = /\b(crypto|cryptocurrency|bitcoin|ethereum|blockchain|defi|nft|token|altcoin|stablecoin|web3|mining|staking|wallet)\b/i;
  const hasCryptoContext = cryptoKeywords.test(question);

  const stockContext = /\b(stock|stocks|share|shares|equity|equities|sec filing|revenue|earnings|balance sheet|income statement|p\/e|eps|dividend|nasdaq|nyse)\b/i;
  const hasStockContext = stockContext.test(question);

  for (const [key, id] of Object.entries(CRYPTO_ID_MAP)) {
    const pattern = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(question) && !result.cryptoIds.includes(id)) {
      result.cryptoIds.push(id);
      result.cryptoNames.push(key);
      result.isCrypto = true;
    }
  }

  if (!result.isCrypto && !hasStockContext) {
    const commonWords = new Set(["apple", "stock", "share", "sand", "link", "rose", "ocean", "dash", "bone", "cake", "mask", "reef", "moon", "near", "flow", "band", "beam", "celo", "spell", "super", "core", "fuel", "best", "investments", "invest", "the", "are", "what", "how", "compare", "between", "about", "from", "with", "have", "this", "that", "will", "can", "for", "review", "analyze", "analysis", "price", "trend", "growth", "revenue", "margin", "profit", "loss", "buy", "sell", "hold", "rating", "target", "forecast", "outlook", "valuation", "overview", "financial", "performance", "quarterly", "annual", "report"]);
    const stockTickers = new Set(["AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "NVDA", "JPM", "V", "JNJ", "WMT", "PG", "MA", "UNH", "HD", "DIS", "PYPL", "BAC", "INTC", "VZ", "NFLX", "ADBE", "CRM", "CSCO", "PFE", "TMO", "ABT", "PEP", "KO", "NKE", "MRK", "CVX", "XOM", "T", "CMCSA", "COST", "AVGO", "TXN", "QCOM", "AMD", "IBM", "GS", "MS", "BLK", "SPGI", "AXP", "GE", "MMM", "CAT", "BA", "RTX", "LMT", "GM", "F", "RIVN", "UBER", "ABNB", "SQ", "SHOP", "SNOW", "PLTR", "COIN", "HOOD", "SOFI", "RBLX", "U", "ZM", "DOCU", "CRWD", "ZS", "NET", "DDOG", "MDB", "TEAM", "NOW", "WDAY", "OKTA"]);
    const words = question.split(/[\s,;.!?]+/).filter(w => w.length >= 3);
    for (const word of words) {
      if (commonWords.has(word.toLowerCase())) continue;
      if (stockTickers.has(word.toUpperCase())) continue;
      const match = fuzzyMatchCrypto(word);
      if (match && !result.cryptoIds.includes(match.id)) {
        result.cryptoIds.push(match.id);
        result.cryptoNames.push(match.key);
        result.isCrypto = true;
      }
    }
  }

  if (!result.isCrypto && hasCryptoContext) {
    result.isCrypto = true;
  }

  return result;
}

export function getAvailableCryptos(): { symbol: string; name: string; id: string }[] {
  const seen = new Set<string>();
  const list: { symbol: string; name: string; id: string }[] = [];
  for (const [key, id] of Object.entries(CRYPTO_ID_MAP)) {
    if (key.length <= 5 && !seen.has(id)) {
      seen.add(id);
      const nameEntry = Object.entries(CRYPTO_ID_MAP).find(([k, v]) => v === id && k.length > 3 && k === k.toUpperCase());
      const displayName = id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      list.push({ symbol: key, name: displayName, id });
    }
  }
  return list.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function getCryptoPrice(cryptoId: string): Promise<CryptoSnapshot | null> {
  const cached = priceCache.get(cryptoId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${cryptoId}&price_change_percentage=7d,30d&sparkline=false`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[CryptoData] CoinGecko API error: ${response.status}`);
      return null;
    }

    const data: CryptoPrice[] = await response.json();
    if (data.length === 0) return null;

    const snapshot = transformCryptoData(data[0]);
    priceCache.set(cryptoId, { data: snapshot, timestamp: Date.now() });
    return snapshot;
  } catch (error) {
    console.error(`[CryptoData] Error fetching ${cryptoId}:`, error);
    return null;
  }
}

export async function getMultipleCryptoPrices(cryptoIds: string[]): Promise<CryptoSnapshot[]> {
  const uncached: string[] = [];
  const results: CryptoSnapshot[] = [];

  for (const id of cryptoIds) {
    const cached = priceCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results.push(cached.data);
    } else {
      uncached.push(id);
    }
  }

  if (uncached.length > 0) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${uncached.join(",")}&price_change_percentage=7d,30d&sparkline=false`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data: CryptoPrice[] = await response.json();
        for (const coin of data) {
          const snapshot = transformCryptoData(coin);
          priceCache.set(coin.id, { data: snapshot, timestamp: Date.now() });
          results.push(snapshot);
        }
      }
    } catch (error) {
      console.error("[CryptoData] Error fetching multiple:", error);
    }
  }

  return results.sort((a, b) => a.marketCapRank - b.marketCapRank);
}

export async function getTopCryptos(limit: number = 20): Promise<CryptoSnapshot[]> {
  if (topCoinsCacheRef && Date.now() - topCoinsCacheRef.timestamp < CACHE_TTL) {
    return topCoinsCacheRef.data.slice(0, limit);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${Math.min(limit, 50)}&page=1&price_change_percentage=7d,30d&sparkline=false`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) return [];

    const data: CryptoPrice[] = await response.json();
    const snapshots = data.map(transformCryptoData);

    topCoinsCacheRef = { data: snapshots, timestamp: Date.now() };
    for (const s of snapshots) {
      priceCache.set(s.id, { data: s, timestamp: Date.now() });
    }

    return snapshots.slice(0, limit);
  } catch (error) {
    console.error("[CryptoData] Error fetching top cryptos:", error);
    return [];
  }
}

export function getCryptoIdFromSymbol(symbol: string): string | null {
  const upper = symbol.toUpperCase();
  return CRYPTO_ID_MAP[upper] || null;
}

export function formatCryptoDataForAI(snapshots: CryptoSnapshot[]): string {
  if (snapshots.length === 0) return "";

  let output = "## Live Cryptocurrency Data\n\n";
  for (const s of snapshots) {
    output += `### ${s.name} (${s.symbol})\n`;
    output += `- **Price:** ${s.priceFormatted}\n`;
    output += `- **24h Change:** ${s.change24h >= 0 ? "+" : ""}${s.change24h.toFixed(2)}%\n`;
    if (s.change7d !== null) output += `- **7d Change:** ${s.change7d >= 0 ? "+" : ""}${s.change7d.toFixed(2)}%\n`;
    if (s.change30d !== null) output += `- **30d Change:** ${s.change30d >= 0 ? "+" : ""}${s.change30d.toFixed(2)}%\n`;
    output += `- **Market Cap:** ${s.marketCapFormatted} (Rank #${s.marketCapRank})\n`;
    output += `- **24h Volume:** ${s.volumeFormatted}\n`;
    output += `- **24h Range:** ${formatCurrency(s.low24h)} - ${formatCurrency(s.high24h)}\n`;
    output += `- **All-Time High:** ${formatCurrency(s.ath)} (${s.athChangePercent.toFixed(1)}% from ATH)\n`;
    if (s.maxSupply) output += `- **Supply:** ${s.circulatingSupply.toLocaleString()} / ${s.maxSupply.toLocaleString()} max\n`;
    else output += `- **Circulating Supply:** ${s.circulatingSupply.toLocaleString()}\n`;
    output += `- **Last Updated:** ${new Date(s.lastUpdated).toLocaleString()}\n\n`;
  }
  return output;
}
