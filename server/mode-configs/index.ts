import type { ModeConfig, IntentDetectionLevel } from "./types";
import { generalConfig } from "./general";
import { personalConfig } from "./personal";
import { studyConfig } from "./study";
import { educatorConfig } from "./educator";
import { financeConfig } from "./finance";
import { analystConfig } from "./analyst";
import { researchConfig } from "./research";
import { legalConfig } from "./legal";
import { hrConfig } from "./hr";

export type { ModeConfig, IntentDetectionLevel };

export const MODE_CONFIGS: Record<string, ModeConfig> = {
  general: generalConfig,
  personal: personalConfig,
  study: studyConfig,
  educator: educatorConfig,
  finance: financeConfig,
  analyst: analystConfig,
  research: researchConfig,
  legal: legalConfig,
  hr: hrConfig,
};

export function getModeConfig(intentMode: string | null): ModeConfig {
  if (intentMode && MODE_CONFIGS[intentMode]) {
    return MODE_CONFIGS[intentMode];
  }
  return MODE_CONFIGS.general;
}

export function getEffectiveIntentDetection(
  intentMode: string | null,
  options: { deepResearchEnabled?: boolean; externalInsightsActive?: boolean } = {}
): IntentDetectionLevel {
  const config = getModeConfig(intentMode);

  if (options.externalInsightsActive) {
    return config.externalInsightsIntentDetection;
  }
  if (options.deepResearchEnabled) {
    return config.deepResearchIntentDetection;
  }
  return config.intentDetection;
}

export function shouldRunIntentDetection(
  intentMode: string | null,
  options: { deepResearchEnabled?: boolean; externalInsightsActive?: boolean } = {}
): boolean {
  return getEffectiveIntentDetection(intentMode, options) !== "none";
}
