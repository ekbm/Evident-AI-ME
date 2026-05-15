import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Loader2, ArrowLeft, Crown, Zap,
  HardDrive, MessageSquare, FileVideo, FileText, Calendar,
  ExternalLink, AlertCircle
} from "lucide-react";
import { PLAN_LIMITS } from "@shared/models/auth";
import { useIOSDetection } from "@/hooks/use-ios-detection";

interface BillingStatus {
  plan: string;
  entitlement: { planKey: string; deviceLimit: number; maxIndexedGb: number | null } | null;
  subscription: { status: string; currentPeriodEnd: string | null } | null;
}

interface UsageData {
  plan: string;
  monthly: {
    storageBytes: number;
    storageLimitBytes: number;
    queriesUsed: number;
    queriesLimit: number;
    mediaSecondsUsed: number;
    mediaMinutesLimit: number;
  };
  planDetails: {
    maxDocuments: number;
    mediaAllowed: boolean;
  };
}

export default function BillingPage() {
  const { toast } = useToast();
  const isIOSApp = useIOSDetection();

  const { data: billingStatus, isLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
  });

  const { data: usage } = useQuery<UsageData>({
    queryKey: ["/api/usage"],
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Portal Access Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const currentPlanKey = billingStatus?.entitlement?.planKey || billingStatus?.plan || "free";
  const isActive = billingStatus?.subscription?.status === "active";
  const isPaidPlan = currentPlanKey !== "free";

  const getPlanDisplayName = (planKey: string): string => {
    if (planKey === "pro_plus") return "Evident Max";
    if (planKey === "premium_org") return "Enterprise";
    const limit = PLAN_LIMITS[planKey as keyof typeof PLAN_LIMITS];
    return limit?.name || planKey.charAt(0).toUpperCase() + planKey.slice(1);
  };

  const getPlanPrice = (planKey: string): number => {
    const limit = PLAN_LIMITS[planKey as keyof typeof PLAN_LIMITS];
    return limit?.price || 0;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const storagePercent = usage ? Math.min((usage.monthly.storageBytes / usage.monthly.storageLimitBytes) * 100, 100) : 0;
  const queriesPercent = usage ? Math.min((usage.monthly.queriesUsed / usage.monthly.queriesLimit) * 100, 100) : 0;
  const mediaPercent = usage?.planDetails.mediaAllowed 
    ? Math.min((usage.monthly.mediaSecondsUsed / 60 / usage.monthly.mediaMinutesLimit) * 100, 100) 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-workspace">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go to Workspace
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-primary text-primary">
              <CreditCard className="w-3 h-3 mr-1" />
              Billing
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Billing</h1>
          <p className="text-muted-foreground">
            Manage your subscription and view usage
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Current Plan</CardTitle>
                  <CardDescription>
                    {getPlanDisplayName(currentPlanKey)}
                    {isPaidPlan && isActive && (
                      <Badge variant="secondary" className="ml-2">Active</Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">${getPlanPrice(currentPlanKey)}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {billingStatus?.entitlement && (
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Storage:</span>
                  <span className="font-medium">
                    {billingStatus.entitlement.maxIndexedGb 
                      ? `${billingStatus.entitlement.maxIndexedGb}GB` 
                      : formatBytes(PLAN_LIMITS[currentPlanKey as keyof typeof PLAN_LIMITS]?.storageBytes || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Device Limit:</span>
                  <span className="font-medium">{billingStatus.entitlement.deviceLimit}</span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Link href="/pricing">
                <Button variant="outline" size="sm" data-testid="button-view-plans">
                  <Zap className="w-4 h-4 mr-2" />
                  Plans and Pricing
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {usage && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Usage This Month
              </CardTitle>
              <CardDescription>
                Your current usage resets monthly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    <span>Storage</span>
                  </div>
                  <span className="font-medium">
                    {formatBytes(usage.monthly.storageBytes)} / {formatBytes(usage.monthly.storageLimitBytes)}
                  </span>
                </div>
                <Progress value={storagePercent} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span>Questions</span>
                  </div>
                  <span className="font-medium">
                    {usage.monthly.queriesUsed} / {usage.monthly.queriesLimit}
                  </span>
                </div>
                <Progress value={queriesPercent} className="h-2" />
              </div>

              {usage.planDetails.mediaAllowed ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <FileVideo className="w-4 h-4 text-muted-foreground" />
                      <span>Audio/Video</span>
                    </div>
                    <span className="font-medium">
                      {Math.round(usage.monthly.mediaSecondsUsed / 60)} / {usage.monthly.mediaMinutesLimit} min
                    </span>
                  </div>
                  <Progress value={mediaPercent} className="h-2" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                  <AlertCircle className="w-4 h-4" />
                  <span>Audio/video not available on {getPlanDisplayName(currentPlanKey)} plan</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Subscription
            </CardTitle>
            <CardDescription>
              Manage your payment and subscription details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPaidPlan && isActive ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Next billing date:</span>
                  <span className="font-medium">
                    {billingStatus?.subscription?.currentPeriodEnd 
                      ? formatDate(billingStatus.subscription.currentPeriodEnd)
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
                    {billingStatus?.subscription?.status || "Active"}
                  </Badge>
                </div>
                {isIOSApp ? (
                  <p className="text-sm text-muted-foreground">
                    Manage your subscription in iOS Settings → Apple ID → Subscriptions
                  </p>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    data-testid="button-manage-subscription"
                  >
                    {portalMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4 mr-2" />
                    )}
                    Manage Payment Method
                  </Button>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p>You're on the Free plan. Upgrade to access premium features and higher limits.</p>
                <Link href="/pricing">
                  <Button className="mt-4" data-testid="button-upgrade">
                    <Zap className="w-4 h-4 mr-2" />
                    Upgrade Now
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {!isIOSApp && (
          <div className="text-center text-sm text-muted-foreground pt-4">
            <p>Payments are processed securely by Stripe.</p>
            <p className="mt-1">All paid plans include a 14-day money-back guarantee.</p>
          </div>
        )}
      </main>
    </div>
  );
}
