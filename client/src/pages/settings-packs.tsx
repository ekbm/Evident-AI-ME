import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { 
  DollarSign, 
  Scale, 
  Users, 
  ShoppingCart, 
  HardHat, 
  Shield,
  Check,
  Lock,
  ArrowLeft,
  Settings
} from "lucide-react";
import type { PackDefinition } from "@shared/packs";

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

export default function SettingsPacksPage() {
  const { data, isLoading } = useQuery<{ packs: PackWithStatus[] }>({
    queryKey: ["/api/packs"],
  });

  const packs = data?.packs || [];
  // Show packs based on user's entitlements
  const enabledPacks = packs.filter(p => p.isEnabled);
  const unavailablePacks = packs.filter(p => !p.isEnabled);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-48 bg-muted rounded-lg" />
            <div className="h-48 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6" data-testid="button-workspace">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go to Workspace
          </Button>
        </Link>

        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Intelligence Packs</h1>
          </div>
          <p className="text-muted-foreground">
            Manage which intelligence packs are enabled for your workspace.
          </p>
        </header>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            Enabled Packs
          </h2>
          <Card>
            <CardContent className="p-0">
              {enabledPacks.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No packs are currently enabled.
                </div>
              ) : (
                <div className="divide-y">
                  {enabledPacks.map((pack, idx) => {
                    const IconComponent = iconMap[pack.icon] || DollarSign;
                    return (
                      <div key={pack.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                          <div className="sm:hidden">
                            <Badge variant="default" className="bg-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Enabled
                            </Badge>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium">{pack.title}</h3>
                          <p className="text-sm text-muted-foreground">{pack.shortDescription}</p>
                          {pack.disclaimer && (
                            <p className="text-xs text-muted-foreground italic mt-1">{pack.disclaimer}</p>
                          )}
                        </div>
                        <Badge variant="default" className="bg-green-600 hidden sm:flex flex-shrink-0">
                          <Check className="h-3 w-3 mr-1" />
                          Enabled
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Coming Soon
          </h2>
          <Card>
            <CardContent className="p-0">
              {unavailablePacks.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  All packs are enabled.
                </div>
              ) : (
                <div className="divide-y">
                  {unavailablePacks.map((pack) => {
                    const IconComponent = iconMap[pack.icon] || Shield;
                    return (
                      <div key={pack.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 opacity-60">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <IconComponent className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="sm:hidden">
                            <Badge variant="secondary">
                              <Lock className="h-3 w-3 mr-1" />
                              Coming Soon
                            </Badge>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium">{pack.title}</h3>
                          <p className="text-sm text-muted-foreground">{pack.shortDescription}</p>
                        </div>
                        <Badge variant="secondary" className="hidden sm:flex flex-shrink-0">
                          <Lock className="h-3 w-3 mr-1" />
                          Coming Soon
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <div className="mt-8 pt-8 border-t">
          <Link href="/packs">
            <Button variant="outline" data-testid="button-view-all-packs">
              View All Intelligence Packs
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
