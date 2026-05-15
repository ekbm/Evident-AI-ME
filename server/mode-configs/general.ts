import type { ModeConfig } from "./types";

export const generalConfig: ModeConfig = {
  mode: "general",
  intentDetection: "none",
  deepResearchIntentDetection: "low",
  externalInsightsIntentDetection: "low",
  requiresDocuments: true,
  allowExternalData: false,
  description: "Professionals — business documents, reports, proposals & strategy. Answers come only from uploaded documents.",
};
