import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, X } from "lucide-react";

const STORAGE_KEY = "evident_help_prompt_dismissed";
const IDLE_THRESHOLD_MS = 20000;

interface HelpPromptProps {
  isAuthenticated: boolean;
}

export function HelpPrompt({ isAuthenticated }: HelpPromptProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkDismissed = useCallback(() => {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "permanent") {
      setDismissed(true);
      return true;
    }
    if (value) {
      const dismissedTime = parseInt(value, 10);
      const hoursSince = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        setDismissed(true);
        return true;
      }
    }
    return false;
  }, []);
  
  const handleNeverShowAgain = () => {
    localStorage.setItem(STORAGE_KEY, "permanent");
    setDismissed(true);
    setVisible(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    if (checkDismissed()) return;

    let idleTimer: NodeJS.Timeout;
    let activityDetected = false;

    const resetTimer = () => {
      activityDetected = true;
      setVisible(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!checkDismissed()) {
          setVisible(true);
        }
      }, IDLE_THRESHOLD_MS);
    };

    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];
    events.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    idleTimer = setTimeout(() => {
      if (!checkDismissed()) {
        setVisible(true);
      }
    }, IDLE_THRESHOLD_MS);

    return () => {
      clearTimeout(idleTimer);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isAuthenticated, checkDismissed]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setDismissed(true);
    setVisible(false);
  };

  if (!isAuthenticated || dismissed || !visible) return null;

  return (
    <div 
      className="fixed bottom-20 left-4 z-50 animate-in slide-in-from-left-4 fade-in duration-300 sm:bottom-4"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
    >
      <Card className="w-72 shadow-lg border-primary/20" style={{ pointerEvents: 'auto' }}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-1">Need help?</p>
              <p className="text-xs text-muted-foreground mb-3">
                Check our Help section for guides and tips on getting the most out of Evident.
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button size="sm" asChild data-testid="button-help-prompt-go">
                    <Link href="/help">View Help</Link>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleDismiss}
                    data-testid="button-help-prompt-dismiss"
                  >
                    Dismiss
                  </Button>
                </div>
                <button
                  onClick={handleNeverShowAgain}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline text-left"
                  data-testid="button-help-never-show"
                >
                  Don't show this again
                </button>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 -mt-1 -mr-1"
              onClick={handleDismiss}
              data-testid="button-help-prompt-close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
