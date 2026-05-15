import type { ModeConfig } from "./types";

export const legalConfig: ModeConfig = {
  mode: "legal",
  intentDetection: "none",
  deepResearchIntentDetection: "none",
  externalInsightsIntentDetection: "none",
  requiresDocuments: true,
  allowExternalData: false,
  systemPromptHint: "You are a legal document assistant. Answer strictly based on the content of the uploaded documents. Do not infer, speculate, or add information not present in the documents. Cite specific sections, clauses, or paragraphs when possible.",
  description: "Legal mode — answers strictly from uploaded legal documents with exact citations. No external data ever.",
};
