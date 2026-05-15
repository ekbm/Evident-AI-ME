import type { ModeConfig } from "./types";

export const researchConfig: ModeConfig = {
  mode: "research",
  intentDetection: "low",
  deepResearchIntentDetection: "high",
  externalInsightsIntentDetection: "high",
  requiresDocuments: true,
  allowExternalData: true,
  description: "Research mode — primarily document-based, can supplement with external research.",
};
