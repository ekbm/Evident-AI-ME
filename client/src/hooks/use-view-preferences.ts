import { useState, useCallback, useEffect } from "react";

export interface ViewPreferences {
  showLearningMode: boolean;
  showRecentLearning: boolean;
  showObligations: boolean;
  showUsageDisplay: boolean;
  showIntelligencePacks: boolean;
  showInsights: boolean;
  showWorkspaceStats: boolean;
  showActivity: boolean;
  showBookmarks: boolean;
  showTips: boolean;
  showWorkspaceInsights: boolean;
  showShare: boolean;
  showHelpButton: boolean;
}

const DEFAULT_PREFERENCES: ViewPreferences = {
  showLearningMode: true,
  showRecentLearning: true,
  showObligations: true,
  showUsageDisplay: true,
  showIntelligencePacks: true,
  showInsights: true,
  showWorkspaceStats: true,
  showActivity: true,
  showBookmarks: true,
  showTips: true,
  showWorkspaceInsights: true,
  showShare: true,
  showHelpButton: true,
};

const STORAGE_KEY = "evident_view_preferences";

export function useViewPreferences() {
  const [preferences, setPreferences] = useState<ViewPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_PREFERENCES, ...parsed };
      }
    } catch {}
    return DEFAULT_PREFERENCES;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {}
  }, [preferences]);

  const updatePreference = useCallback(<K extends keyof ViewPreferences>(
    key: K,
    value: ViewPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  }, []);

  const togglePreference = useCallback((key: keyof ViewPreferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  const setMinimalView = useCallback(() => {
    setPreferences({
      showLearningMode: false,
      showRecentLearning: false,
      showObligations: false,
      showUsageDisplay: false,
      showIntelligencePacks: false,
      showInsights: false,
      showWorkspaceStats: true,
      showActivity: false,
      showBookmarks: false,
      showTips: false,
      showWorkspaceInsights: false,
      showShare: false,
      showHelpButton: true,
    });
  }, []);

  const setStudentView = useCallback(() => {
    setPreferences({
      showLearningMode: true,
      showRecentLearning: true,
      showObligations: false,
      showUsageDisplay: true,
      showIntelligencePacks: false,
      showInsights: false,
      showWorkspaceStats: true,
      showActivity: true,
      showBookmarks: true,
      showTips: true,
      showWorkspaceInsights: false,
      showShare: false,
      showHelpButton: true,
    });
  }, []);

  return {
    preferences,
    updatePreference,
    togglePreference,
    resetToDefaults,
    setMinimalView,
    setStudentView,
  };
}
