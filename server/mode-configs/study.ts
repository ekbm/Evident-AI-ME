import type { ModeConfig } from "./types";

export const studyConfig: ModeConfig = {
  mode: "study",
  intentDetection: "none",
  deepResearchIntentDetection: "medium",
  externalInsightsIntentDetection: "medium",
  requiresDocuments: true,
  allowExternalData: false,
  systemPromptHint: "You are an educational assistant helping students study and prepare for exams. Answer strictly based on the uploaded study materials. Cite specific pages, chapters, or sections when possible.",
  description: "Study & exam prep — answers come only from uploaded study materials.",
};
