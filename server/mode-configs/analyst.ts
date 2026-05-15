import type { ModeConfig } from "./types";

export const analystConfig: ModeConfig = {
  mode: "analyst",
  intentDetection: "none",
  deepResearchIntentDetection: "medium",
  externalInsightsIntentDetection: "medium",
  requiresDocuments: true,
  allowExternalData: false,
  description: "Analyst mode — deep document analysis with no external data.",
};
