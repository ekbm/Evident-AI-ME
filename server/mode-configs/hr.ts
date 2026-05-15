import type { ModeConfig } from "./types";

export const hrConfig: ModeConfig = {
  mode: "hr",
  intentDetection: "none",
  deepResearchIntentDetection: "none",
  externalInsightsIntentDetection: "none",
  requiresDocuments: true,
  allowExternalData: false,
  systemPromptHint: "You are an HR policy assistant. Answer strictly based on the content of the uploaded HR documents, policies, and handbooks. Reference specific policy sections or page numbers when possible.",
  description: "HR mode — answers strictly from uploaded HR policies and handbooks. No external data ever.",
};
