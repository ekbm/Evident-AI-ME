import { useState, useEffect } from "react";
import { Link } from "wouter";
import { X, ClipboardCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContextualAssessmentBannerProps {
  averageScore: number;
  documentCount: number;
  issueCount: number;
  onDismiss?: () => void;
}

const DISMISS_KEY = "assessment_banner_dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function ContextualAssessmentBanner({
  averageScore,
  documentCount,
  issueCount,
  onDismiss,
}: ContextualAssessmentBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_DURATION_MS) {
        setDismissed(true);
        return;
      }
    }
    setDismissed(false);
  }, []);

  const shouldShow = !dismissed && averageScore < 70 && documentCount >= 3;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
    onDismiss?.();
  };

  if (!shouldShow) {
    return null;
  }

  const getMessage = () => {
    if (averageScore < 40) {
      return "Many of your documents need preparation before they're AI-ready. Run a self-check to identify improvements.";
    }
    if (averageScore < 60) {
      return "Some documents have issues affecting AI readiness. Try a self-check to identify quick wins.";
    }
    return "Your documents could benefit from optimization. Run a self-check for personalized recommendations.";
  };

  return (
    <div className="relative rounded-md border border-primary/30 bg-primary/5 p-4">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6"
        onClick={handleDismiss}
        data-testid="button-dismiss-banner"
      >
        <X className="w-4 h-4" />
      </Button>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-5 h-5 text-primary" />
        </div>
        
        <div className="flex-1 pr-8 sm:pr-0">
          <p className="font-medium text-sm">Want to Improve These Scores?</p>
          <p className="text-sm text-muted-foreground mt-0.5">{getMessage()}</p>
        </div>
        
        <Link href="/scan">
          <Button className="shrink-0" data-testid="button-banner-self-check">
            Start Self-Check
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
