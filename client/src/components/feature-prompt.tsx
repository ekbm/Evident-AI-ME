import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Scale, Receipt, X, Sparkles } from "lucide-react";
import { useInactivityTimer } from "@/hooks/use-inactivity-timer";

interface FeaturePromptProps {
  isAuthenticated: boolean;
  hasAssets: boolean;
}

const PROMPT_DISMISSED_KEY = "evident_feature_prompt_dismissed";
const INACTIVITY_THRESHOLD_MS = 25000;

export function FeaturePrompt({ isAuthenticated, hasAssets }: FeaturePromptProps) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkDismissed = useCallback(() => {
    const value = localStorage.getItem(PROMPT_DISMISSED_KEY);
    return value === "true" || value === "permanent";
  }, []);

  useEffect(() => {
    if (isAuthenticated && !hasAssets) {
      setDismissed(checkDismissed());
    }
  }, [isAuthenticated, hasAssets, checkDismissed]);

  const { isInactive } = useInactivityTimer({
    inactivityThreshold: INACTIVITY_THRESHOLD_MS,
    enabled: isAuthenticated && !hasAssets && !dismissed,
    onInactive: () => {
      if (!checkDismissed()) {
        setShow(true);
      }
    },
    onActive: () => {
      setShow(false);
    },
  });

  function handleDismiss() {
    setShow(false);
    setDismissed(true);
    localStorage.setItem(PROMPT_DISMISSED_KEY, "true");
  }
  
  function handleNeverShowAgain() {
    setShow(false);
    setDismissed(true);
    localStorage.setItem(PROMPT_DISMISSED_KEY, "permanent");
  }

  if (!isAuthenticated || hasAssets || dismissed || !show) {
    return null;
  }

  return (
    <div className="hidden sm:block fixed top-24 left-6 z-40 animate-in slide-in-from-left-4 fade-in duration-300">
      <Card className="w-80 shadow-lg border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Looking for something specific?</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 -mt-1 -mr-1"
              onClick={handleDismiss}
              data-testid="button-dismiss-prompt"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            <Link href="/legal/contracts" onClick={handleDismiss}>
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer" data-testid="link-prompt-contracts">
                <div className="h-8 w-8 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Scale className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Contract Analysis</p>
                  <p className="text-xs text-muted-foreground">Extract clauses & risks</p>
                </div>
              </div>
            </Link>
            
            <Link href="/reconciliation" onClick={handleDismiss}>
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer" data-testid="link-prompt-invoices">
                <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Receipt className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Invoice Reconciliation</p>
                  <p className="text-xs text-muted-foreground">Match & verify payments</p>
                </div>
              </div>
            </Link>
          </div>
          <button
            onClick={handleNeverShowAgain}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline mt-3"
            data-testid="button-feature-never-show"
          >
            Don't show this again
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
