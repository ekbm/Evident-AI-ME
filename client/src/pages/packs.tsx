import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  DollarSign, 
  Scale, 
  Users, 
  ShoppingCart, 
  HardHat, 
  Shield,
  ArrowRight,
  ArrowLeft,
  Clock,
  Sparkles
} from "lucide-react";
import type { PackDefinition } from "@shared/packs";
import { useAuth } from "@/hooks/use-auth";
import { AuthRequiredMessage } from "@/components/auth-required-message";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useEntitlements } from "@/features/packs/useEntitlements";

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

export default function PacksPage() {
  useDocumentTitle("Intelligence Packs");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isPackEligiblePlan } = useEntitlements();
  const { data, isLoading } = useQuery<{ packs: PackWithStatus[] }>({
    queryKey: ["/api/packs"],
  });

  const packs = data?.packs || [];
  // Show packs based on user's entitlements
  const enabledPacks = packs.filter(p => p.isEnabled);
  const comingSoonPacks = packs.filter(p => !p.isEnabled);
  const hasAdvancedPlan = isPackEligiblePlan();

  // Show loading state while auth is being checked OR packs are loading
  // This prevents the flash of "sign in required" before auth completes
  if (authLoading || (isAuthenticated && isLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-10 bg-muted rounded w-1/3" />
            <div className="h-6 bg-muted rounded w-2/3" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-64 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Only show auth required after auth check completes and user is not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-workspace">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Workspace
              </Button>
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center py-24">
            <h1 className="text-2xl font-bold mb-4">Intelligence Packs</h1>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Access specialized AI assistants for Finance, Legal, HR, and more.
            </p>
            <AuthRequiredMessage />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-workspace">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Workspace
            </Button>
          </Link>
        </div>
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
            <Badge variant="secondary">Intelligence Packs</Badge>
          </div>
          <h1 className="text-4xl font-bold mb-4">Domain Intelligence for Your Workflows</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Purpose-built AI assistants for Finance, Legal, and more. Each pack is optimized for its domain with specialized extraction, analysis, and verification capabilities.
          </p>
        </header>

        {enabledPacks.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Available Packs
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {enabledPacks.map(pack => {
                const IconComponent = iconMap[pack.icon] || DollarSign;
                return (
                  <Card key={pack.id} className="hover-elevate transition-all" data-testid={`card-pack-${pack.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <IconComponent className="h-6 w-6 text-primary" />
                        </div>
                        <Badge variant="default" className="bg-green-600">Enabled</Badge>
                      </div>
                      <CardTitle className="mt-4">{pack.title}</CardTitle>
                      <CardDescription>{pack.shortDescription}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {pack.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                      {pack.disclaimer && (
                        <p className="text-xs text-muted-foreground mb-4 italic">{pack.disclaimer}</p>
                      )}
                      <Link href={pack.routes.primaryPath}>
                        <Button className="w-full" data-testid={`button-open-${pack.id}`}>
                          Open
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {comingSoonPacks.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {hasAdvancedPlan ? "Request Access" : "Join Waitlist"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {hasAdvancedPlan 
                ? "These packs are in beta. Request free access and help shape the features you need."
                : "Join our early access waitlist. Tell us what you need and we'll build it — free subscription for early contributors!"
              }
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {comingSoonPacks.map(pack => {
                const IconComponent = iconMap[pack.icon] || Shield;
                return (
                  <Card key={pack.id} className="hover-elevate transition-all" data-testid={`card-pack-${pack.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <IconComponent className="h-6 w-6 text-primary" />
                        </div>
                        <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">Beta</Badge>
                      </div>
                      <CardTitle className="mt-4">{pack.title}</CardTitle>
                      <CardDescription>{pack.shortDescription}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {pack.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                      <Link href={`/packs/${pack.id}`}>
                        <Button className="w-full" data-testid={`button-request-${pack.id}`}>
                          {hasAdvancedPlan ? "Request Free Access" : "Join Waitlist"}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Evident Insights CTA - Only for Advanced+ users */}
        {hasAdvancedPlan && (
          <section className="mt-8 pt-8 border-t">
            <Card className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center shrink-0">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Evident Insights</h3>
                    <p className="text-sm text-muted-foreground">
                      Create reports you can actually use from your Excel data
                    </p>
                  </div>
                  <Link href="/services">
                    <Button className="gap-2" data-testid="button-evident-insights">
                      <ArrowRight className="w-4 h-4" />
                      View
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
