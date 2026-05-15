import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Crown, Zap, Gift, GraduationCap } from "lucide-react";
import { PLAN_LIMITS } from "@shared/models/auth";

interface PlanBadgeProps {
  planKey: string;
  trialDaysRemaining?: number;
  compact?: boolean;
}

const planConfig: Record<string, { icon: typeof Sparkles; color: string; label: string }> = {
  free: { icon: Sparkles, color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", label: "Free" },
  starter: { icon: Zap, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", label: "Evident Lite" },
  scholar: { icon: GraduationCap, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", label: "Evident Scholar" },
  pro: { icon: Crown, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300", label: "Evident Advanced" },
  pro_plus: { icon: Crown, color: "bg-primary/10 text-primary", label: "Evident Max" },
  premium_org: { icon: Crown, color: "bg-primary/10 text-primary", label: "Enterprise" },
};

export function PlanBadge({ planKey, trialDaysRemaining, compact = false }: PlanBadgeProps) {
  const config = planConfig[planKey] || planConfig.free;
  const Icon = config.icon;
  const isFreePlan = planKey === "free";
  const isTrial = trialDaysRemaining !== undefined && trialDaysRemaining > 0;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="secondary" className={`${config.color} text-xs px-2 py-0.5 shrink-0`}>
          <Icon className="w-3 h-3 mr-1" />
          {isTrial ? `Trial: ${trialDaysRemaining}d` : config.label}
        </Badge>
        {isFreePlan && (
          <Link href="/billing" className="hidden sm:block">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-primary hover:text-primary">
              Upgrade
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className={`${config.color} px-2.5 py-1`}>
        {isTrial ? (
          <>
            <Gift className="w-3.5 h-3.5 mr-1.5" />
            Trial: {trialDaysRemaining} days left
          </>
        ) : (
          <>
            <Icon className="w-3.5 h-3.5 mr-1.5" />
            {config.label}
          </>
        )}
      </Badge>
      {(isFreePlan || isTrial) && (
        <Link href="/billing">
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            Upgrade
          </Button>
        </Link>
      )}
    </div>
  );
}
