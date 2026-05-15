import { createContext, useContext, useState, ReactNode } from "react";

export type AppMode = "WORKSPACE" | "PILOT";

interface Entitlements {
  pro: boolean;
}

interface AppContextType {
  appMode: AppMode | null;
  setAppMode: (mode: AppMode) => void;
  entitlements: Entitlements;
  hasCompletedOnboarding: boolean;
  clearOnboarding: () => void;
  hasSelectedPlan: boolean;
  selectedPlanKey: string | null;
  setSelectedPlan: (plan: string) => void;
  clearPlanSelection: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = "evident_app_mode";
const ONBOARDING_KEY = "evident_onboarding_complete";
const PLAN_SELECTED_KEY = "evident_plan_selected";
const PLAN_KEY = "evident_selected_plan";

function getInitialState() {
  if (typeof window === "undefined") {
    return { mode: null, completed: false, planSelected: false, planKey: null };
  }
  const storedMode = localStorage.getItem(STORAGE_KEY) as AppMode | null;
  const onboardingComplete = localStorage.getItem(ONBOARDING_KEY) === "true";
  const planSelected = localStorage.getItem(PLAN_SELECTED_KEY) === "true";
  const planKey = localStorage.getItem(PLAN_KEY);
  return { mode: storedMode, completed: onboardingComplete, planSelected, planKey };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = getInitialState();
  const [appMode, setAppModeState] = useState<AppMode | null>(initial.mode);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(initial.completed);
  const [entitlements] = useState<Entitlements>({ pro: false });
  const [hasSelectedPlan, setHasSelectedPlan] = useState(initial.planSelected);
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | null>(initial.planKey);

  const setAppMode = (mode: AppMode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    localStorage.setItem(ONBOARDING_KEY, "true");
    setAppModeState(mode);
    setHasCompletedOnboarding(true);
  };

  const clearOnboarding = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_KEY);
    setAppModeState(null);
    setHasCompletedOnboarding(false);
  };

  const setSelectedPlan = (plan: string) => {
    localStorage.setItem(PLAN_SELECTED_KEY, "true");
    localStorage.setItem(PLAN_KEY, plan);
    setHasSelectedPlan(true);
    setSelectedPlanKey(plan);
  };

  const clearPlanSelection = () => {
    localStorage.removeItem(PLAN_SELECTED_KEY);
    localStorage.removeItem(PLAN_KEY);
    setHasSelectedPlan(false);
    setSelectedPlanKey(null);
  };

  return (
    <AppContext.Provider value={{ 
      appMode, setAppMode, entitlements, hasCompletedOnboarding, clearOnboarding,
      hasSelectedPlan, selectedPlanKey, setSelectedPlan, clearPlanSelection
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
