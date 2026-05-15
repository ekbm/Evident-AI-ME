import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  HeartPulse,
  TrendingUp,
  Loader2,
  ArrowUp,
  Minus,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/features/packs/useEntitlements";

interface SubscoreData {
  extractability: number;
  structure: number;
  quality: number;
  metadata: number;
}

interface PreparedStatus {
  hasPreparedVersion: boolean;
  originalScore: number | null;
  preparedScore: number | null;
  scoreDelta: number | null;
  preparedAt: string | null;
  changeLog: string[];
  originalSubscores?: SubscoreData;
  preparedSubscores?: SubscoreData;
}

interface DocumentHealthCardProps {
  assetId: string;
}

function ScoreBar({ label, original, prepared }: { label: string; original: number; prepared?: number | null }) {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-medium">{clamp(original)}%</span>
          {prepared != null && Math.round(prepared) > Math.round(original) && (
            <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-0.5">
              <ArrowUp className="w-3 h-3" />
              {clamp(prepared)}%
            </span>
          )}
        </div>
      </div>
      <div className="relative">
        <Progress value={clamp(original)} className="h-1.5" />
        {prepared != null && prepared > original && (
          <div
            className="absolute top-0 h-1.5 rounded-full bg-green-500/30"
            style={{ left: `${clamp(original)}%`, width: `${Math.min(100 - clamp(original), clamp(prepared) - clamp(original))}%` }}
          />
        )}
      </div>
    </div>
  );
}

function deriveSubscores(score: number): SubscoreData {
  return {
    extractability: score * 0.9,
    structure: score * 0.85,
    quality: score * 0.92,
    metadata: score * 0.8,
  };
}

export function DocumentHealthCard({ assetId }: DocumentHealthCardProps) {
  const { isAuthenticated } = useAuth();
  const { planKey } = useEntitlements();
  const [expanded, setExpanded] = useState(false);

  const isAdminOrEnterprise = planKey === "admin" || planKey === "premium_org";

  const { data, isLoading } = useQuery<PreparedStatus | null>({
    queryKey: ["/api/documents", assetId, "prepared-status"],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${assetId}/prepared-status`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated && isAdminOrEnterprise && !!assetId,
    staleTime: 60_000,
    retry: false,
  });

  if (!isAuthenticated || !isAdminOrEnterprise) return null;
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Checking health...</span>
      </div>
    );
  }
  if (!data || data.originalScore == null) return null;

  const hasImprovement = data.hasPreparedVersion && data.scoreDelta != null && data.scoreDelta > 0;
  const origSub = data.originalSubscores ?? deriveSubscores(data.originalScore);
  const prepSub = data.hasPreparedVersion && data.preparedScore != null
    ? (data.preparedSubscores ?? deriveSubscores(data.preparedScore))
    : null;

  const score = Math.round(data.originalScore);
  const scoreColor = score >= 70 ? "text-green-600 dark:text-green-400" : score >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";

  return (
    <div className="mt-0.5" data-testid={`document-health-card-${assetId}`}>
      <button
        className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-muted/50 transition-colors w-full text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid={`button-toggle-health-${assetId}`}
      >
        <HeartPulse className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className={`text-[11px] font-medium ${scoreColor}`}>{score}%</span>
        {hasImprovement && (
          <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-0.5">
            <TrendingUp className="w-2.5 h-2.5" />
            +{Math.round(data.scoreDelta!)}%
          </span>
        )}
        {data.hasPreparedVersion && !hasImprovement && (
          <Minus className="w-2.5 h-2.5 text-muted-foreground" />
        )}
        <ChevronDown className={`w-3 h-3 text-muted-foreground ml-auto shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-1 p-2.5 rounded-md bg-muted/30 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">Document Health</span>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0" data-testid={`badge-health-score-${assetId}`}>
                {score}%
              </Badge>
              {hasImprovement && (
                <Badge className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 gap-0.5" data-testid={`badge-health-delta-${assetId}`}>
                  <TrendingUp className="w-2.5 h-2.5" />
                  +{Math.round(data.scoreDelta!)}%
                </Badge>
              )}
              {data.hasPreparedVersion && !hasImprovement && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                  <Minus className="w-2.5 h-2.5" />
                  No change
                </Badge>
              )}
            </div>
          </div>

          {data.hasPreparedVersion && data.preparedScore != null && (
            <>
              <Separator />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Original: {Math.round(data.originalScore)}%</span>
                <span>Prepared: {Math.round(data.preparedScore)}%</span>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <ScoreBar label="Extractability" original={origSub.extractability} prepared={prepSub?.extractability} />
            <ScoreBar label="Structure" original={origSub.structure} prepared={prepSub?.structure} />
            <ScoreBar label="Quality" original={origSub.quality} prepared={prepSub?.quality} />
            <ScoreBar label="Metadata" original={origSub.metadata} prepared={prepSub?.metadata} />
          </div>

          <button
            className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 hover:underline mt-1"
            onClick={(e) => {
              e.stopPropagation();
              const url = new URL(window.location.href);
              url.pathname = "/full";
              url.searchParams.set("tab", "health");
              window.history.pushState({}, "", url.toString());
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            data-testid={`link-knowledge-health-${assetId}`}
          >
            <ExternalLink className="w-2.5 h-2.5" />
            View in Knowledge Health
          </button>
        </div>
      )}
    </div>
  );
}
