import type { ModeConfig } from "./types";

export const educatorConfig: ModeConfig = {
  mode: "educator",
  intentDetection: "none",
  deepResearchIntentDetection: "medium",
  externalInsightsIntentDetection: "medium",
  requiresDocuments: true,
  allowExternalData: false,
  systemPromptHint: "You are an educational assistant helping educators and instructors create teaching materials, assessments, lesson plans, and learning objectives. Answer strictly based on the uploaded materials. Structure responses for classroom use with clear formatting suitable for distribution to students.",
  description: "Educator tools — generate assessments, lesson plans, and teaching materials from uploaded documents.",
};
