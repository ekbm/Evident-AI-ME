import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle, FileText, MessageSquare, Zap } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface UsageLimitsResponse {
  plan: string;
  limits: {
    maxDocumentsTotal: number;
    maxQuestionsTotal: number;
    maxQuestionsPerHour: number;
  } | null;
  usage: {
    documentsCount: number;
    questionsTotal: number;
    questionsHourCount: number;
  };
  remaining: {
    documents: number;
    questionsTotal: number;
    questionsHour: number;
  } | null;
}

interface LimitWarning {
  type: "document" | "question" | "hourly";
  message: string;
  remaining: number;
  icon: typeof FileText;
  severity: "warning" | "critical";
}

export function LimitWarningBanner() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  
  const { data: usage } = useQuery<UsageLimitsResponse>({
    queryKey: ["/api/usage/limits"],
    refetchInterval: user ? 60000 : false,
    enabled: !!user,
    staleTime: 30000,
  });

  if (!usage || !usage.limits || !usage.remaining) return null;
  if (!usage.plan.includes("free")) return null;

  const warnings: LimitWarning[] = [];

  const docsRemaining = usage.remaining.documents;
  if (docsRemaining <= 2 && docsRemaining > 0) {
    warnings.push({
      type: "document",
      message: docsRemaining === 1 
        ? "You have 1 document upload remaining" 
        : `You have ${docsRemaining} document uploads remaining`,
      remaining: docsRemaining,
      icon: FileText,
      severity: docsRemaining === 1 ? "critical" : "warning",
    });
  }

  const questionsRemaining = usage.remaining.questionsTotal;
  if (questionsRemaining <= 5 && questionsRemaining > 0) {
    warnings.push({
      type: "question",
      message: questionsRemaining === 1 
        ? "You have 1 question remaining" 
        : `You have ${questionsRemaining} questions remaining`,
      remaining: questionsRemaining,
      icon: MessageSquare,
      severity: questionsRemaining <= 2 ? "critical" : "warning",
    });
  }

  const hourlyRemaining = usage.remaining.questionsHour;
  if (hourlyRemaining === 1 && usage.usage.questionsHourCount > 0) {
    warnings.push({
      type: "hourly",
      message: "You have 1 question left this hour. After that, come back in about an hour or upgrade for unlimited access.",
      remaining: hourlyRemaining,
      icon: MessageSquare,
      severity: "warning",
    });
  }

  const activeWarnings = warnings.filter(w => !dismissed.has(w.type));
  
  if (activeWarnings.length === 0) return null;

  const mostUrgent = activeWarnings.reduce((prev, curr) => 
    curr.severity === "critical" ? curr : prev
  , activeWarnings[0]);

  const handleDismiss = (type: string) => {
    setDismissed(prev => new Set(Array.from(prev).concat(type)));
  };

  return (
    <Alert 
      variant={mostUrgent.severity === "critical" ? "destructive" : "default"}
      className="relative mb-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20"
      data-testid="banner-limit-warning"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <mostUrgent.icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-800 dark:text-amber-200">
            {mostUrgent.message}
          </span>
          {activeWarnings.length > 1 && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              (+{activeWarnings.length - 1} more)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/billing">
            <Button size="sm" variant="outline" className="gap-1 text-xs h-7" data-testid="button-upgrade-warning">
              <Zap className="h-3 w-3" />
              Upgrade
            </Button>
          </Link>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6 text-amber-600 hover:text-amber-800"
            onClick={() => handleDismiss(mostUrgent.type)}
            data-testid="button-dismiss-warning"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function useLimitWarnings() {
  const { user } = useAuth();
  const { data: usage } = useQuery<UsageLimitsResponse>({
    queryKey: ["/api/usage/limits"],
    refetchInterval: user ? 60000 : false,
    enabled: !!user,
    staleTime: 30000,
  });

  const getWarningLevel = (): "none" | "warning" | "critical" => {
    if (!usage || !usage.remaining || !usage.plan.includes("free")) return "none";

    const docsRemaining = usage.remaining.documents;
    const questionsRemaining = usage.remaining.questionsTotal;
    const hourlyRemaining = usage.remaining.questionsHour;

    if (docsRemaining === 1 || questionsRemaining <= 2 || hourlyRemaining === 0) {
      return "critical";
    }
    if (docsRemaining <= 2 || questionsRemaining <= 5 || hourlyRemaining === 1) {
      return "warning";
    }
    return "none";
  };

  return {
    usage,
    warningLevel: getWarningLevel(),
    isNearDocLimit: usage?.remaining ? usage.remaining.documents <= 2 : false,
    isNearQuestionLimit: usage?.remaining ? usage.remaining.questionsTotal <= 5 : false,
    isNearHourlyLimit: usage?.remaining ? usage.remaining.questionsHour <= 1 : false,
  };
}
