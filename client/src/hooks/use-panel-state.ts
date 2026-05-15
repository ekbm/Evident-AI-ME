import { useState, useCallback } from "react";

const STORAGE_KEY = "evident-panel-states";

interface PanelStates {
  [panelId: string]: boolean;
}

const DEFAULT_STATES: PanelStates = {
  "workspace-stats": false,
  "workspace-activity": false,
  "bookmarks": true,
  "workspace-tips": false,
  "workspace-insights": false,
  "share-buttons": false,
  "learning-mode": true,
  "recent-learning": true,
  "actions": true,
  "usage": false,
  "intelligence-packs": false,
  "evident-insights": false,
  "premium-org": true,
  "ai-agents": false,
};

function loadPanelStates(): PanelStates {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_STATES, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn("Failed to load panel states:", e);
  }
  return DEFAULT_STATES;
}

function savePanelStates(states: PanelStates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch (e) {
    console.warn("Failed to save panel states:", e);
  }
}

export function usePanelState(panelId: string) {
  const [isExpanded, setIsExpanded] = useState(() => {
    const states = loadPanelStates();
    return states[panelId] ?? true;
  });

  const toggle = useCallback(() => {
    setIsExpanded((prev) => {
      const newValue = !prev;
      const states = loadPanelStates();
      states[panelId] = newValue;
      savePanelStates(states);
      return newValue;
    });
  }, [panelId]);

  const setExpanded = useCallback((value: boolean) => {
    setIsExpanded(value);
    const states = loadPanelStates();
    states[panelId] = value;
    savePanelStates(states);
  }, [panelId]);

  return { isExpanded, toggle, setExpanded };
}
