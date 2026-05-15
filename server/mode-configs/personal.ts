import type { ModeConfig } from "./types";

export const personalConfig: ModeConfig = {
  mode: "personal",
  intentDetection: "none",
  deepResearchIntentDetection: "low",
  externalInsightsIntentDetection: "low",
  requiresDocuments: true,
  allowExternalData: false,
  description: "Personal document assistant — answers come only from uploaded documents.",
};
