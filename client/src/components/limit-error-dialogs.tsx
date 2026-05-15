import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  MessageSquare,
  Clock,
  AlertTriangle,
  Zap,
  HardDrive,
  Pause,
  Sparkles,
  Loader2,
} from "lucide-react";
import { StarterUpsellDialog } from "./starter-upsell-dialog";

export interface LimitError {
  code: string;
  message: string;
  meta?: {
    currentDocs?: number;
    maxDocs?: number;
    fileSizeMB?: number;
    maxFileSizeMB?: number;
    pageCount?: number;
    maxPages?: number;
    currentQuestions?: number;
    maxQuestions?: number;
    currentHourQuestions?: number;
    maxQuestionsPerHour?: number;
    retryAfterSeconds?: number;
    windowResetsAt?: string;
    boostAvailable?: boolean;
    boostPriceInCents?: number;
    boostMaxFileSizeMB?: number;
  };
}

interface LimitErrorDialogProps {
  error: LimitError | null;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return "now";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function LimitErrorDialog({ error, onClose }: LimitErrorDialogProps) {
  const [countdown, setCountdown] = useState(0);
  const [isPurchasingBoost, setIsPurchasingBoost] = useState(false);
  const [showUpsellDialog, setShowUpsellDialog] = useState(false);

  const { data: boostStatus } = useQuery<{
    hasActiveBoost: boolean;
    oneOffBoostCount: number;
    showStarterUpsell: boolean;
    starterBenefits: {
      name: string;
      price: number;
      maxFileSizeMB: number;
      queriesPerMonth: number;
      storageMB: number;
    } | null;
  }>({
    queryKey: ["/api/billing/boost"],
    enabled: error?.code === "LIMIT_FILE_TOO_LARGE" && !!error?.meta?.boostAvailable,
  });

  useEffect(() => {
    if (error?.meta?.retryAfterSeconds) {
      setCountdown(error.meta.retryAfterSeconds);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [error]);

  const handlePurchaseBoost = async () => {
    if (boostStatus?.showStarterUpsell) {
      setShowUpsellDialog(true);
      return;
    }

    setIsPurchasingBoost(true);
    try {
      const response = await fetch("/api/billing/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const { url } = await response.json();
        if (url) {
          window.location.href = url;
        }
      }
    } catch (err) {
      console.error("Failed to purchase boost:", err);
    } finally {
      setIsPurchasingBoost(false);
    }
  };

  const proceedWithBoostPurchase = async () => {
    setShowUpsellDialog(false);
    setIsPurchasingBoost(true);
    try {
      const response = await fetch("/api/billing/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const { url } = await response.json();
        if (url) {
          window.location.href = url;
        }
      }
    } catch (err) {
      console.error("Failed to purchase boost:", err);
    } finally {
      setIsPurchasingBoost(false);
    }
  };

  if (!error) return null;

  const { code, message, meta } = error;

  const getDialogContent = () => {
    switch (code) {
      case "LIMIT_DOCS_REACHED":
        return {
          icon: FileText,
          title: "Document Limit Reached",
          description: message,
          showProgress: true,
          progressLabel: "Documents Used",
          current: meta?.currentDocs || 0,
          max: meta?.maxDocs || 5,
          showUpgrade: true,
        };

      case "LIMIT_FILE_TOO_LARGE":
        return {
          icon: HardDrive,
          title: "File Too Large",
          description: message,
          showProgress: false,
          details: `Your file is ${meta?.fileSizeMB?.toFixed(1)}MB. Maximum allowed: ${meta?.maxFileSizeMB}MB`,
          showUpgrade: true,
          showBoostOption: meta?.boostAvailable && meta?.boostMaxFileSizeMB && (meta?.fileSizeMB || 0) <= meta.boostMaxFileSizeMB,
          boostPriceCents: meta?.boostPriceInCents || 100,
          boostMaxFileMB: meta?.boostMaxFileSizeMB || 50,
        };

      case "LIMIT_PAGES_TOO_MANY":
        return {
          icon: FileText,
          title: "Too Many Pages",
          description: message,
          showProgress: false,
          details: `Your document has ${meta?.pageCount} pages. Maximum allowed: ${meta?.maxPages} pages`,
          showUpgrade: true,
        };

      case "LIMIT_QUESTIONS_TOTAL_REACHED":
        return {
          icon: MessageSquare,
          title: "Question Limit Reached",
          description: message,
          showProgress: true,
          progressLabel: "Questions Used",
          current: meta?.currentQuestions || 0,
          max: meta?.maxQuestions || 30,
          showUpgrade: true,
        };

      case "LIMIT_QUESTIONS_RATE_REACHED":
        return {
          icon: Clock,
          title: "Hourly Limit Reached",
          description: message,
          showProgress: true,
          progressLabel: "Questions This Hour",
          current: meta?.currentHourQuestions || 0,
          max: meta?.maxQuestionsPerHour || 5,
          showCountdown: true,
          countdown,
          showUpgrade: true,
        };

      case "AI_PAUSED":
        return {
          icon: Pause,
          title: "AI Processing Paused",
          description: message,
          showProgress: false,
          details: "Our team is working on restoring service. Please try again later.",
          showUpgrade: false,
        };

      default:
        return {
          icon: AlertTriangle,
          title: "Limit Reached",
          description: message,
          showProgress: false,
          showUpgrade: true,
        };
    }
  };

  const content = getDialogContent();
  const Icon = content.icon;

  return (
    <Dialog open={!!error} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-limit-error">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <Icon className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>{content.title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">{content.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {content.showProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{content.progressLabel}</span>
                <span className="font-mono">
                  {content.current} / {content.max}
                </span>
              </div>
              <Progress value={(content.current! / content.max!) * 100} className="h-2" />
            </div>
          )}

          {content.details && (
            <p className="text-sm text-muted-foreground">{content.details}</p>
          )}

          {content.showCountdown && countdown > 0 && (
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground">Try again in</p>
              <p className="text-2xl font-bold">{formatTime(countdown)}</p>
            </div>
          )}

          {(content as any).showBoostOption && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">One-Time Upload Boost</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Upload this file (up to {(content as any).boostMaxFileMB}MB) for just ${((content as any).boostPriceCents / 100).toFixed(2)}. 
                Valid for 24 hours.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} data-testid="button-close-dialog">
            Close
          </Button>
          {(content as any).showBoostOption && (
            <Button 
              onClick={handlePurchaseBoost}
              disabled={isPurchasingBoost}
              variant="secondary"
              data-testid="button-purchase-boost"
            >
              {isPurchasingBoost ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Buy Boost (${((content as any).boostPriceCents / 100).toFixed(2)})
            </Button>
          )}
          {content.showUpgrade && (
            <Link href="/billing">
              <Button data-testid="button-upgrade-from-dialog">
                <Zap className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            </Link>
          )}
        </DialogFooter>
      </DialogContent>

      <StarterUpsellDialog
        open={showUpsellDialog}
        onOpenChange={setShowUpsellDialog}
        oneOffBoostCount={boostStatus?.oneOffBoostCount || 0}
        starterBenefits={boostStatus?.starterBenefits}
        onProceedWithBoost={proceedWithBoostPurchase}
      />
    </Dialog>
  );
}

export function AIPausedBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <Alert variant="destructive" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md" data-testid="banner-ai-paused">
      <Pause className="h-4 w-4" />
      <AlertTitle>AI Processing Paused</AlertTitle>
      <AlertDescription>
        AI features are temporarily unavailable. Please try again later.
      </AlertDescription>
    </Alert>
  );
}

export function useLimitErrorHandler() {
  const [limitError, setLimitError] = useState<LimitError | null>(null);

  const handleApiError = (error: any) => {
    if (error?.code && error.code.startsWith("LIMIT_") || error?.code === "AI_PAUSED") {
      setLimitError(error as LimitError);
      return true;
    }
    
    try {
      const parsed = typeof error === "string" ? JSON.parse(error) : error;
      if (parsed?.code && (parsed.code.startsWith("LIMIT_") || parsed.code === "AI_PAUSED")) {
        setLimitError(parsed as LimitError);
        return true;
      }
    } catch {
    }
    
    return false;
  };

  const clearError = () => setLimitError(null);

  return {
    limitError,
    handleApiError,
    clearError,
  };
}
