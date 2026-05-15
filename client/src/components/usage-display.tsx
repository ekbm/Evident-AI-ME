import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, HardDrive, Sparkles, Zap, Video, X, ChevronDown, ChevronRight } from "lucide-react";
import { usePanelState } from "@/hooks/use-panel-state";
import { useAuth } from "@/hooks/use-auth";

interface PlanDetails {
  name: string;
  price: number;
  storageBytes: number;
  queriesPerMonth: number;
  maxFileSizeBytes: number;
  mediaMinutesPerMonth: number;
  mediaAllowed: boolean;
  externalSearchAllowed: boolean;
  excelReportsAllowed: boolean;
  workspacesAllowed?: boolean;
  scheduledReportsAllowed?: boolean;
  trainingExportAllowed?: boolean;
}

interface UsageData {
  plan: "free" | "starter" | "scholar" | "pro" | "pro_plus" | "premium_org";
  planDetails: PlanDetails;
  monthly: {
    storageBytes: number;
    storageLimit: number;
    queriesUsed: number;
    queriesLimit: number;
    mediaSecondsUsed: number;
    mediaMinutesLimit: number;
  };
}


function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatStorage(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export function UsageDisplay() {
  const { isExpanded, toggle } = usePanelState("usage");
  const { user } = useAuth();
  const { data: usage, isLoading } = useQuery<UsageData>({
    queryKey: ["/api/usage"],
    refetchInterval: user ? 60000 : false,
    enabled: !!user,
    staleTime: 30000,
  });

  if (isLoading || !usage) {
    return null;
  }

  const queriesPercent = Math.min(100, (usage.monthly.queriesUsed / usage.monthly.queriesLimit) * 100);
  const storagePercent = Math.min(100, (usage.monthly.storageBytes / usage.monthly.storageLimit) * 100);
  const mediaPercent = usage.monthly.mediaMinutesLimit > 0 
    ? Math.min(100, (usage.monthly.mediaSecondsUsed / 60 / usage.monthly.mediaMinutesLimit) * 100)
    : 0;
  const isNearLimit = queriesPercent > 80 || storagePercent > 80;

  const planBadgeVariant = usage.plan === "premium_org" ? "default" : usage.plan === "pro_plus" ? "default" : usage.plan === "pro" ? "default" : "secondary";
  const planLabel = usage.planDetails.name;

  return (
    <>
      <Card className="border-slate-700 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-800/30 transition-colors rounded-t-lg"
          onClick={toggle}
        >
          <h3 className="text-sm font-medium flex items-center gap-2">
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Usage</span>
            </div>
            <Badge variant={planBadgeVariant} className="text-xs">
              {planLabel}
            </Badge>
          </h3>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
        {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <MessageSquare className="w-3 h-3" />
                <span>Questions this month</span>
              </div>
              <span className="font-medium text-white">
                {usage.monthly.queriesUsed} / {usage.monthly.queriesLimit}
              </span>
            </div>
            <Progress value={queriesPercent} className="h-1.5 bg-slate-700" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <HardDrive className="w-3 h-3" />
                <span>Storage</span>
              </div>
              <span className="font-medium text-white">
                {formatBytes(usage.monthly.storageBytes)} / {formatStorage(usage.monthly.storageLimit)}
              </span>
            </div>
            <Progress value={storagePercent} className="h-1.5 bg-slate-700" />
          </div>

          {usage.planDetails.mediaAllowed && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Video className="w-3 h-3" />
                  <span>Media minutes</span>
                </div>
                <span className="font-medium text-white">
                  {Math.round(usage.monthly.mediaSecondsUsed / 60)} / {usage.monthly.mediaMinutesLimit} min
                </span>
              </div>
              <Progress value={mediaPercent} className="h-1.5 bg-slate-700" />
            </div>
          )}

          {!usage.planDetails.mediaAllowed && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2 rounded-md bg-slate-800/50">
              <X className="w-3 h-3" />
              <span>Audio/video not available on Free plan</span>
            </div>
          )}

          <p className="text-xs text-slate-500 text-center pt-1">
            Resets monthly
          </p>

          <Button 
            asChild
            className={isNearLimit ? "w-full mt-2" : "w-full mt-2 border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"}
            variant={isNearLimit ? "default" : "outline"}
            size="sm"
            data-testid="button-manage-plan"
          >
            <Link href="/pricing">
              <Zap className="w-3 h-3 mr-2" />
              {usage.plan === "free" ? (isNearLimit ? "Upgrade for More" : "Plans and Pricing") : "Manage Plan"}
            </Link>
          </Button>
        </CardContent>
        )}
      </Card>
    </>
  );
}
