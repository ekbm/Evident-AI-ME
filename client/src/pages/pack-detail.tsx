import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  DollarSign, 
  Scale, 
  Users, 
  ShoppingCart, 
  HardHat, 
  Shield,
  ArrowLeft,
  ArrowRight,
  LogIn,
  Sparkles,
  Crown
} from "lucide-react";
import type { PackDefinition, PackIdType } from "@shared/packs";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/features/packs/useEntitlements";
import { RequestAccessForm } from "@/features/packs/RequestAccessForm";
import { AuthRequiredMessage } from "@/components/auth-required-message";

interface PackWithStatus extends PackDefinition {
  isEnabled: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  DollarSign,
  Scale,
  Users,
  ShoppingCart,
  HardHat,
  Shield,
};

export default function PackDetailPage() {
  const [, params] = useRoute("/packs/:slug");
  const slug = params?.slug;
  const { isAuthenticated } = useAuth();
  const { isPackEligiblePlan, planKey } = useEntitlements();

  const { data, isLoading, error } = useQuery<{ packs: PackWithStatus[] }>({
    queryKey: ["/api/packs"],
  });

  const pack = data?.packs?.find(p => p.id === slug);
  const hasEligiblePlan = isPackEligiblePlan();
  
  const showRequestForm = isAuthenticated && pack && !pack.isEnabled;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="h-12 bg-muted rounded w-2/3" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Card>
            <CardHeader>
              <CardTitle>Pack Not Found</CardTitle>
              <CardDescription>The intelligence pack you're looking for doesn't exist.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="button-workspace">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go to Workspace
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const IconComponent = iconMap[pack.icon] || Shield;

  if (showRequestForm && !hasEligiblePlan) {
    const IconComp = iconMap[pack.icon] || Shield;
    const currentPlanLabel = planKey === "pro" ? "Evident Advanced" : planKey === "starter" ? "Evident Starter" : planKey === "scholar" ? "Evident Scholar" : "Free plan";
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-lg mx-auto px-4 py-8">
          <Link href="/packs">
            <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              All Packs
            </Button>
          </Link>
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Crown className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-3" data-testid="text-pack-upgrade-title">{pack.title}</h1>
            <p className="text-muted-foreground mb-2 max-w-sm mx-auto">
              {pack.shortDescription}
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
              You're on {currentPlanLabel}
            </Badge>
            <div className="flex flex-col gap-3">
              <Link href="/pricing">
                <Button className="w-full" size="lg" data-testid="button-upgrade-to-max">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Evident Max
                </Button>
              </Link>
              <Link href="/packs">
                <Button variant="ghost" className="w-full" size="sm" data-testid="button-back-packs">
                  Maybe later
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showRequestForm) {
    return <RequestAccessForm packId={pack.id as PackIdType} isWaitlist={false} />;
  }

  // For unauthenticated users, always show pack info with sign-in prompt
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="mb-6">
            <Link href="/packs">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                All Packs
              </Button>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mb-8">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <IconComponent className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
            </div>
            <div className="w-full">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold">{pack.title}</h1>
                <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">Beta</Badge>
              </div>
              <p className="text-base sm:text-lg text-muted-foreground">{pack.shortDescription}</p>
            </div>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>About This Pack</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">{pack.longDescription}</p>
              
              <div className="flex flex-wrap gap-2 pt-4">
                {pack.tags.map(tag => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>

              {pack.disclaimer && (
                <p className="text-sm text-muted-foreground italic border-t pt-4 mt-4">
                  {pack.disclaimer}
                </p>
              )}
            </CardContent>
          </Card>

          <Alert className="mb-8 border-primary/20 bg-primary/5">
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Join the Waitlist</AlertTitle>
            <AlertDescription>
              Sign in to request access to this Intelligence Pack. Early contributors get a free subscription!
            </AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row gap-4">
            <AuthRequiredMessage />
          </div>
        </div>
      </div>
    );
  }

  // Authenticated user with pack enabled - show full access
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-workspace">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Workspace
            </Button>
          </Link>
          <Link href="/profile">
            <Button variant="outline" size="sm" data-testid="button-profile">
              My Account
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mb-8">
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <IconComponent className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
          </div>
          <div className="w-full">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold">{pack.title}</h1>
              <Badge variant="default" className="bg-green-600 text-sm">Enabled</Badge>
            </div>
            <p className="text-base sm:text-lg text-muted-foreground">{pack.shortDescription}</p>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>About This Pack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">{pack.longDescription}</p>
            
            <div className="flex flex-wrap gap-2 pt-4">
              {pack.tags.map(tag => (
                <Badge key={tag} variant="outline">{tag}</Badge>
              ))}
            </div>

            {pack.disclaimer && (
              <p className="text-sm text-muted-foreground italic border-t pt-4 mt-4">
                {pack.disclaimer}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link href={pack.routes.primaryPath}>
            <Button size="lg" data-testid="button-open-pack">
              Open {pack.title.replace(" Intelligence Pack", "")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href="/packs">
            <Button size="lg" variant="outline" data-testid="button-view-all">
              View All Packs
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
