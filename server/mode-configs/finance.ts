import type { ModeConfig } from "./types";

export const financeConfig: ModeConfig = {
  mode: "finance",
  intentDetection: "high",
  deepResearchIntentDetection: "high",
  externalInsightsIntentDetection: "high",
  requiresDocuments: false,
  allowExternalData: true,
  description: "Finance mode — detects stock tickers, crypto, and pulls live market data.",
};
