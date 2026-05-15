import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Lightbulb, ChevronRight, X } from "lucide-react";
import { useInactivityTimer } from "@/hooks/use-inactivity-timer";

interface UseCasesPromptProps {
  userId?: string;
  isAuthenticated: boolean;
}

const STORAGE_KEY_PREFIX = "evident_use_cases_dismissed_";
const INACTIVITY_THRESHOLD_MS = 30000;

export function UseCasesPrompt({ userId, isAuthenticated }: UseCasesPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  
  // Check localStorage immediately and also on userId change
  const checkDismissed = useCallback(() => {
    if (!userId) return true; // Default to dismissed if no user
    const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
    const value = localStorage.getItem(storageKey);
    // "permanent" means never show again, "true" means temporarily dismissed
    return value === "true" || value === "permanent";
  }, [userId]);

  // Initialize dismissed state from localStorage
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return checkDismissed();
  });

  useEffect(() => {
    if (isAuthenticated && userId) {
      const wasDismissed = checkDismissed();
      setDismissed(wasDismissed);
    }
  }, [isAuthenticated, userId, checkDismissed]);

  // Show the prompt after inactivity, but don't hide on activity
  // User must explicitly dismiss it
  useInactivityTimer({
    inactivityThreshold: INACTIVITY_THRESHOLD_MS,
    enabled: isAuthenticated && !!userId && !dismissed && !showPrompt,
    onInactive: () => {
      if (!checkDismissed()) {
        setShowPrompt(true);
      }
    },
    // Don't hide on activity - user must explicitly dismiss
  });

  const handleDismiss = () => {
    if (userId) {
      const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
      localStorage.setItem(storageKey, "true");
    }
    setDismissed(true);
    setShowPrompt(false);
  };

  const handleViewUseCases = () => {
    handleDismiss();
    window.open("/use-cases", "_blank");
  };
  
  const handleNeverShowAgain = () => {
    if (userId) {
      const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
      localStorage.setItem(storageKey, "permanent");
    }
    setDismissed(true);
    setShowPrompt(false);
  };

  if (!showPrompt || dismissed) return null;

  return (
    <div className="hidden sm:block fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-right-5 fade-in duration-300">
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white rounded-lg shadow-xl border border-violet-500/30 overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-5 h-5 text-yellow-300" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Explore Use Cases</h3>
                <p className="text-violet-200 text-sm">See what Evident can do</p>
              </div>
            </div>
            <button 
              onClick={handleDismiss}
              className="text-violet-200 hover:text-white transition-colors p-1 hover-elevate rounded"
              data-testid="button-dismiss-use-cases-widget"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <p className="text-violet-100 text-sm mb-3">
            Discover how to analyze contracts, create quizzes from notes, extract video transcripts, and more.
          </p>
          
          <div className="grid grid-cols-2 gap-1.5 text-xs mb-4">
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/10">
              <span className="text-yellow-300">•</span>
              <span>Contract Analysis</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/10">
              <span className="text-yellow-300">•</span>
              <span>Study & Revision</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/10">
              <span className="text-yellow-300">•</span>
              <span>Video Transcription</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/10">
              <span className="text-yellow-300">•</span>
              <span>Meeting Actions</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleDismiss} 
                className="flex-1 text-violet-200 hover:text-white hover:bg-white/10 border-0"
                data-testid="button-skip-use-cases"
              >
                Maybe Later
              </Button>
              <Button 
                size="sm"
                onClick={handleViewUseCases}
                className="flex-1 bg-white text-violet-700 hover:bg-violet-50"
                data-testid="button-view-use-cases"
              >
                View Examples
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <button
              onClick={handleNeverShowAgain}
              className="text-xs text-violet-300 hover:text-white transition-colors underline"
              data-testid="button-never-show-use-cases"
            >
              Don't show this again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
