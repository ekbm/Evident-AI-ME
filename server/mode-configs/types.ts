export type IntentDetectionLevel = "none" | "low" | "medium" | "high";

export interface ModeConfig {
  mode: string;
  intentDetection: IntentDetectionLevel;
  deepResearchIntentDetection: IntentDetectionLevel;
  externalInsightsIntentDetection: IntentDetectionLevel;
  requiresDocuments: boolean;
  allowExternalData: boolean;
  systemPromptHint?: string;
  description: string;
}
