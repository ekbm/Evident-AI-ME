const FEATURE_FLAG_STORAGE_KEY = "evident_feature_flags";

export const DEFAULT_FEATURE_FLAGS = {
  PILOT_MODE_ENABLED: false,
} as const;

export type FeatureFlagKey = keyof typeof DEFAULT_FEATURE_FLAGS;

function getStoredFlags(): Partial<Record<FeatureFlagKey, boolean>> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(FEATURE_FLAG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  const storedFlags = getStoredFlags();
  if (flag in storedFlags) {
    return storedFlags[flag] ?? DEFAULT_FEATURE_FLAGS[flag];
  }
  return DEFAULT_FEATURE_FLAGS[flag];
}

export function setFeatureFlag(flag: FeatureFlagKey, enabled: boolean): void {
  if (typeof window === "undefined") return;
  const storedFlags = getStoredFlags();
  storedFlags[flag] = enabled;
  localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, JSON.stringify(storedFlags));
}

export function getAllFeatureFlags(): Record<FeatureFlagKey, boolean> {
  const storedFlags = getStoredFlags();
  return {
    PILOT_MODE_ENABLED: storedFlags.PILOT_MODE_ENABLED ?? DEFAULT_FEATURE_FLAGS.PILOT_MODE_ENABLED,
  };
}
