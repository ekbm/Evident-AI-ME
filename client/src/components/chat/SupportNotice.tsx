import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Sparkles, Globe, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { ExplainWhyModal } from "./ExplainWhyModal";

export type AnswerSupportStatus = "supported" | "needs_assumptions" | "insufficient_support";

interface SupportNoticeProps {
  supportStatus: AnswerSupportStatus;
  missingItems?: string[];
  onStandardAssumptions?: () => void;
  onExternalInsights?: () => void;
  externalInsightsEnabled?: boolean;
  isLoadingAssumptions?: boolean;
  isLoadingExternal?: boolean;
}

export function SupportNotice({
  supportStatus,
  missingItems = [],
  onStandardAssumptions,
  onExternalInsights,
  externalInsightsEnabled = false,
  isLoadingAssumptions = false,
  isLoadingExternal = false,
}: SupportNoticeProps) {
  const [isExplainOpen, setIsExplainOpen] = useState(false);
  const [showMissingItems, setShowMissingItems] = useState(false);

  if (supportStatus === "supported") {
    return null;
  }

  const isNeedsAssumptions = supportStatus === "needs_assumptions";
  const isInsufficientSupport = supportStatus === "insufficient_support";

  return (
    <>
      <Card className="mt-3 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {isNeedsAssumptions ? "Needs assumptions to solve exactly" : "Limited document support"}
                </span>
              </div>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mb-2">
                {isNeedsAssumptions 
                  ? "This question requires assumptions or formulas not explicitly present in the provided material. Evident avoids guessing and answers only from supported sources."
                  : "The available documents don't contain enough information to fully answer this question."}
              </p>

              {missingItems.length > 0 && (
                <button
                  onClick={() => setShowMissingItems(!showMissingItems)}
                  className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 mb-2"
                  data-testid="button-toggle-missing-items"
                >
                  {showMissingItems ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showMissingItems ? "Hide details" : "What's missing?"}
                </button>
              )}

              {showMissingItems && missingItems.length > 0 && (
                <ul className="text-xs text-amber-700/70 dark:text-amber-400/70 mb-2 pl-4 space-y-0.5">
                  {missingItems.map((item, idx) => (
                    <li key={idx} className="list-disc">{item}</li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExplainOpen(true)}
                  className="h-7 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  data-testid="button-explain-why"
                >
                  <HelpCircle className="w-3 h-3 mr-1" />
                  Explain why
                </Button>

                {isNeedsAssumptions && onStandardAssumptions && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onStandardAssumptions}
                    disabled={isLoadingAssumptions}
                    className="h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    data-testid="button-standard-assumptions"
                  >
                    {isLoadingAssumptions ? (
                      <span className="animate-pulse">Processing...</span>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        Try Standard Assumptions (Preview)
                      </>
                    )}
                  </Button>
                )}

                {externalInsightsEnabled && onExternalInsights && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onExternalInsights}
                    disabled={isLoadingExternal}
                    className="h-7 text-xs border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    data-testid="button-external-insights"
                  >
                    {isLoadingExternal ? (
                      <span className="animate-pulse">Searching...</span>
                    ) : (
                      <>
                        <Globe className="w-3 h-3 mr-1" />
                        Use External Insights
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ExplainWhyModal
        isOpen={isExplainOpen}
        onClose={() => setIsExplainOpen(false)}
        missingItems={missingItems}
      />
    </>
  );
}

export function AssumptionBadge({ assumptionsUsed }: { assumptionsUsed?: string[] }) {
  const [showAssumptions, setShowAssumptions] = useState(false);

  if (!assumptionsUsed || assumptionsUsed.length === 0) return null;

  return (
    <div className="mt-2 mb-2">
      <div className="flex items-center gap-2">
        <Badge 
          variant="secondary" 
          className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Assumption-based (Preview)
        </Badge>
        <button
          onClick={() => setShowAssumptions(!showAssumptions)}
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
          data-testid="button-show-assumptions"
        >
          {showAssumptions ? "Hide assumptions" : "View assumptions"}
        </button>
      </div>

      {showAssumptions && (
        <div className="mt-2 p-2 rounded bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900">
          <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">Assumptions used:</p>
          <ul className="text-xs text-purple-600/80 dark:text-purple-400/80 pl-4 space-y-0.5">
            {assumptionsUsed.map((assumption, idx) => (
              <li key={idx} className="list-disc">{assumption}</li>
            ))}
          </ul>
          <p className="text-[10px] text-purple-500/70 dark:text-purple-400/50 mt-2 italic">
            Confirm assumptions before relying on this.
          </p>
        </div>
      )}
    </div>
  );
}
