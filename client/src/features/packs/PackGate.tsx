import { useEntitlements } from "./useEntitlements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft, Sparkles, Crown } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { PackIdType } from "@shared/packs";
import { PACKS, PackStatus } from "@shared/packs";
import { RequestAccessForm } from "./RequestAccessForm";

interface PackGateProps {
  packId: PackIdType;
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export function PackGate({ 
  packId, 
  children, 
  fallbackTitle,
  fallbackDescription
}: PackGateProps) {
  const [, setLocation] = useLocation();
  const { isPackEnabled, isLoading, error, isTestingUser, isPackEligiblePlan, planKey } = useEntitlements();
  
  const packDef = PACKS.find(p => p.id === packId);
  const displayTitle = fallbackTitle || packDef?.title || "Intelligence Pack";
  const displayDescription = fallbackDescription || packDef?.shortDescription || "This feature requires an Intelligence Pack add-on.";
  
  const isHiddenPack = packDef?.statusDefault === PackStatus.HIDDEN;
  const hasEligiblePlan = isPackEligiblePlan();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-8 bg-muted rounded w-3/4 mx-auto" />
          <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-lg mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" className="mb-6" onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Close & Return to Knowledge Space
          </Button>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold mb-2">Unable to Load Features</h1>
            <p className="text-muted-foreground mb-6">
              We couldn't check your feature access. Please try again.
            </p>
            <Button onClick={() => window.location.reload()} data-testid="button-retry">
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isPackEnabled(packId)) {
    if (!hasEligiblePlan) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
          <div className="max-w-lg mx-auto px-4 py-8">
            <Button variant="ghost" size="sm" className="mb-6" onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }} data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Close & Return to Knowledge Space
            </Button>
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Crown className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-3" data-testid="text-pack-upgrade-title">{displayTitle}</h1>
              <p className="text-muted-foreground mb-2 max-w-sm mx-auto" data-testid="text-pack-upgrade-description">
                {displayDescription}
              </p>
              <div className="bg-card border rounded-xl p-6 mt-6 mb-6 text-left">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Included with Evident Max
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    All Intelligence Packs (Legal, Finance, HR, and more)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    Specialised AI analysis for your industry
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    Priority processing and extended file limits
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    Multi-device sync (up to 3 devices)
                  </li>
                </ul>
              </div>
              <Badge variant="outline" className="mb-6 text-muted-foreground">
                {planKey === "pro" ? "You're on Evident Advanced" : planKey === "starter" ? "You're on Evident Starter" : planKey === "scholar" ? "You're on Evident Scholar" : "You're on the Free plan"}
              </Badge>
              <div className="flex flex-col gap-3">
                <Link href="/pricing">
                  <Button className="w-full" size="lg" data-testid="button-upgrade-to-max">
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Evident Max
                  </Button>
                </Link>
                <Button variant="ghost" className="w-full" size="sm" onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }} data-testid="button-back-workspace">
                    Maybe later
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return <RequestAccessForm packId={packId} isWaitlist={false} />;
  }

  return <>{children}</>;
}
