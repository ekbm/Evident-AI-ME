import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  FileText, MessageSquare, Clock, HardDrive, Zap, ArrowLeft, ArrowRight,
  DollarSign, Scale, Users, ShoppingCart, HardHat, Shield, Sparkles
} from "lucide-react";
import { PACKS } from "@shared/packs";
import { useEntitlements } from "@/features/packs/useEntitlements";

interface UsageLimits {
  plan: string;
  planName: string;
  planDescription: string;
  limits: {
    maxDocumentsTotal: number;
    maxFileSizeMB: number;
    maxFileSizeBytes: number;
    maxPagesPerDocument: number;
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
  hourWindowResetsAt: string | null;
  retryAfterSeconds: number;
  isPaidPlan: boolean;
}

function UsageBar({ 
  label, 
  icon: Icon,
  current, 
  max, 
  subtext,
  warning = false 
}: { 
  label: string;
  icon: any;
  current: number; 
  max: number;
  subtext?: string;
  warning?: boolean;
}) {
  const percentage = Math.min((current / max) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
        </div>
        <span className={`text-sm font-mono ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-amber-500' : 'text-muted-foreground'}`}>
          {current} / {max}
        </span>
      </div>
      <Progress 
        value={percentage} 
        className={`h-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-amber-500' : ''}`}
      />
      {subtext && (
        <p className="text-xs text-muted-foreground">{subtext}</p>
      )}
    </div>
  );
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "now";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

export default function PlanLimitsPage() {
  const { user } = useAuth();
  const { data: usageLimits, isLoading, error } = useQuery<UsageLimits>({
    queryKey: ["/api/usage/limits"],
    refetchInterval: user ? 60000 : false,
    enabled: !!user,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="container max-w-3xl py-8 space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-workspace">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Workspace
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Plan & Limits</h1>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !usageLimits) {
    return (
      <div className="container max-w-3xl py-8">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-workspace">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Workspace
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Plan & Limits</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load usage data. Please try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { limits, usage, remaining, hourWindowResetsAt, retryAfterSeconds, isPaidPlan, planName, planDescription } = usageLimits;

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-workspace">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go to Workspace
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Plan & Limits</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                {planName}
              </CardTitle>
              {!isPaidPlan && (
                <Badge variant="secondary" className="text-xs">Early Access</Badge>
              )}
            </div>
            <Link href="/billing">
              <Button variant="outline" size="sm" data-testid="link-upgrade">
                <Zap className="h-4 w-4 mr-2" />
                Plans and Pricing
              </Button>
            </Link>
          </div>
          <CardDescription>
            {planDescription}
          </CardDescription>
        </CardHeader>
      </Card>

      {!isPaidPlan && limits && remaining && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage</CardTitle>
              <CardDescription>Track your document and question usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <UsageBar
                label="Documents"
                icon={FileText}
                current={usage.documentsCount}
                max={limits.maxDocumentsTotal}
                subtext={`${remaining.documents} remaining`}
              />

              <UsageBar
                label="Total Questions"
                icon={MessageSquare}
                current={usage.questionsTotal}
                max={limits.maxQuestionsTotal}
                subtext={`${remaining.questionsTotal} remaining`}
              />

              <UsageBar
                label="Questions This Hour"
                icon={Clock}
                current={usage.questionsHourCount}
                max={limits.maxQuestionsPerHour}
                subtext={
                  retryAfterSeconds > 0
                    ? `Resets in ${formatTimeRemaining(retryAfterSeconds)}`
                    : hourWindowResetsAt
                    ? `Window resets at ${new Date(hourWindowResetsAt).toLocaleTimeString()}`
                    : "Rolling hourly window"
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plan Limits</CardTitle>
              <CardDescription>What's included in your Early Access plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{limits.maxDocumentsTotal} documents</p>
                    <p className="text-xs text-muted-foreground">Lifetime limit</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <HardDrive className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{limits.maxFileSizeMB}MB max file</p>
                    <p className="text-xs text-muted-foreground">Per upload</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{limits.maxPagesPerDocument} pages/doc</p>
                    <p className="text-xs text-muted-foreground">Maximum pages</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{limits.maxQuestionsTotal} questions</p>
                    <p className="text-xs text-muted-foreground">Lifetime limit</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 col-span-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{limits.maxQuestionsPerHour} questions/hour</p>
                    <p className="text-xs text-muted-foreground">Rate limiting for fair usage</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Need more?</h3>
                  <p className="text-sm text-muted-foreground">
                    Upgrade to Pro for unlimited documents and more questions
                  </p>
                </div>
                <Link href="/billing">
                  <Button data-testid="button-upgrade-cta">
                    Upgrade Now
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {isPaidPlan && (
        <Card>
          <CardContent className="py-8 text-center">
            <Zap className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">You're on a paid plan</h3>
            <p className="text-muted-foreground mb-4">
              Enjoy expanded limits and premium features.
            </p>
            <Link href="/billing">
              <Button variant="outline" data-testid="link-manage-subscription">
                Manage Subscription
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <IntelligencePacksSection />
    </div>
  );
}

const packIcons: Record<string, any> = {
  DollarSign,
  Scale,
  Users,
  ShoppingCart,
  HardHat,
  Shield,
};

interface PackWithStatus {
  id: string;
  title: string;
  shortDescription: string;
  icon: string;
  isEnabled: boolean;
}

function IntelligencePacksSection() {
  const { data, isLoading } = useQuery<{ packs: PackWithStatus[] }>({
    queryKey: ["/api/packs"],
  });
  const { isPackEligiblePlan } = useEntitlements();

  const packs = data?.packs || [];
  const enabledPacks = packs.filter(p => p.isEnabled);
  const comingSoonPacks = packs.filter(p => !p.isEnabled);
  const hasEligiblePlan = isPackEligiblePlan();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Intelligence Packs
            </CardTitle>
            <CardDescription>
              Specialized AI assistants for specific document types
            </CardDescription>
          </div>
          {enabledPacks.length > 0 && (
            <Badge variant="default" className="bg-green-600">
              {enabledPacks.length} Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {enabledPacks.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Your Active Packs
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {enabledPacks.map((pack) => {
                const Icon = packIcons[pack.icon] || FileText;
                return (
                  <div 
                    key={pack.id}
                    className="p-4 rounded-lg border bg-green-500/5 border-green-500/20 w-full"
                    data-testid={`pack-card-${pack.id}`}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className="p-2 rounded-lg bg-green-500/10 flex-shrink-0">
                        <Icon className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{pack.title.replace(" Intelligence Pack", "").replace(" Pack", "")}</p>
                          <Badge variant="default" className="text-xs bg-green-600">Active</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{pack.shortDescription}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {comingSoonPacks.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Available Packs</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {comingSoonPacks.map((pack) => {
                const Icon = packIcons[pack.icon] || FileText;
                return (
                  <div 
                    key={pack.id}
                    className="p-4 rounded-lg border bg-muted/30 w-full"
                    data-testid={`pack-card-${pack.id}`}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className="p-2 rounded-lg bg-muted flex-shrink-0">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{pack.title.replace(" Intelligence Pack", "").replace(" Pack", "")}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 mb-2">{pack.shortDescription}</p>
                        <Link href={`/packs/${pack.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            {hasEligiblePlan ? "Request Access" : "Join Waitlist"}
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {enabledPacks.length === 0 && (
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground">
              {hasEligiblePlan 
                ? "No Intelligence Packs are currently enabled. Request access to specialized packs above."
                : "Intelligence Packs require an Advanced plan or higher. Join the waitlist above to be notified when you're eligible."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
