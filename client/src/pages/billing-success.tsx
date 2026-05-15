import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, ArrowRight, RefreshCw } from "lucide-react";

interface BillingStatus {
  plan: string;
  entitlement: { planKey: string; deviceLimit: number; maxIndexedGb: number | null } | null;
  subscription: { status: string; currentPeriodEnd: string | null } | null;
}

export default function BillingSuccessPage() {
  const [, navigate] = useLocation();
  const [pollCount, setPollCount] = useState(0);
  const maxPolls = 10;

  const { data: billingStatus, refetch, isLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (pollCount >= maxPolls) return false;
      if (!data?.entitlement || data.entitlement.planKey === "free") return 2000;
      return false;
    },
  });

  useEffect(() => {
    if (billingStatus?.entitlement && billingStatus.entitlement.planKey !== "free") {
      const timer = setTimeout(() => {
        navigate("/");
      }, 3000);
      return () => clearTimeout(timer);
    }
    setPollCount(prev => prev + 1);
  }, [billingStatus, navigate]);

  const isPlanActive = billingStatus?.entitlement && billingStatus.entitlement.planKey !== "free";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {isPlanActive ? (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <CardTitle className="text-2xl">Payment Successful!</CardTitle>
              <CardDescription>
                Your subscription is now active. You'll be redirected shortly.
              </CardDescription>
            </>
          ) : (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <CardTitle className="text-2xl">Processing Payment...</CardTitle>
              <CardDescription>
                Please wait while we confirm your subscription.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isPlanActive && billingStatus?.entitlement && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plan</span>
                <Badge variant="secondary" className="capitalize">
                  {billingStatus.entitlement.planKey.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Device Limit</span>
                <span className="font-medium">{billingStatus.entitlement.deviceLimit}</span>
              </div>
              {billingStatus.entitlement.maxIndexedGb && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Storage</span>
                  <span className="font-medium">{billingStatus.entitlement.maxIndexedGb}GB</span>
                </div>
              )}
            </div>
          )}

          {!isPlanActive && pollCount >= maxPolls && (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Taking longer than expected. Your subscription may still be processing.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setPollCount(0);
                  refetch();
                }}
                disabled={isLoading}
                data-testid="button-refresh-status"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Check Again
              </Button>
            </div>
          )}

          <div className="flex justify-center pt-2">
            <Link href="/">
              <Button data-testid="button-go-home">
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
