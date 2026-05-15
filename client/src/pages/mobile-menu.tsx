import { Link, useLocation, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  User,
  LogOut,
  Building2,
  Lightbulb,
  Boxes,
  FolderKanban,
  Scale,
  FileSearch,
  Shield,
  Tag,
  CreditCard,
  Settings,
  HelpCircle,
  Sparkles,
  ChevronRight,
  Lock,
  Zap,
  Crown,
  Star,
  FileSpreadsheet,
  Play,
} from "lucide-react";

export default function MobileMenuPage() {
  useDocumentTitle("Menu");
  const { user, isAuthenticated } = useAuth();

  const { data: usage } = useQuery<{
    plan: string;
    planDetails: { name: string };
    monthly: { queriesUsed: number; queriesLimit: number };
  }>({
    queryKey: ["/api/usage"],
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  const { data: orgContext } = useQuery<{
    hasOrg: boolean;
    capabilities: { can_view_all_devices: boolean } | null;
  }>({
    queryKey: ["/api/me/org"],
    enabled: isAuthenticated,
  });

  const { data: adminCheck } = useQuery<{ isSuperAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const { data: meData } = useQuery<{ userGroup: string }>({
    queryKey: ["/api/me"],
    enabled: isAuthenticated,
  });

  const isOrgAdmin = orgContext?.hasOrg && orgContext?.capabilities?.can_view_all_devices;
  const isSuperAdmin = adminCheck?.isSuperAdmin;
  const isLocalUser = meData?.userGroup === "local" || meData?.userGroup === "evident";
  const hasPremiumAccess = usage?.plan === "premium_org" || usage?.plan === "pro_plus" || usage?.plan === "admin" || isSuperAdmin;

  if (!isAuthenticated || !user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
              <AvatarFallback>
                <User className="w-8 h-8" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg truncate">{user.firstName} {user.lastName}</p>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <p className="text-xs text-primary mt-1">{usage?.planDetails?.name || "Free"} Plan</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Plans Section */}
      {usage?.plan !== "premium_org" && usage?.plan !== "admin" && (
        <Card className="mb-4 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Upgrade Your Plan
              </p>
              <Link href="/pricing">
                <span className="text-xs text-primary hover:underline">View All</span>
              </Link>
            </div>
            <div className="space-y-2">
              {(!usage?.plan || usage?.plan === "free") && (
                <>
                  <UpgradePlanRow 
                    name="Evident Lite" 
                    price="$5/mo" 
                    highlight="First month free"
                    href="/pricing"
                  />
                  <UpgradePlanRow 
                    name="Evident Scholar" 
                    price="$29/mo" 
                    highlight="First month free"
                    href="/pricing"
                    popular
                  />
                </>
              )}
              {usage?.plan === "starter" && (
                <>
                  <UpgradePlanRow 
                    name="Evident Scholar" 
                    price="$29/mo" 
                    highlight="First month free"
                    href="/pricing"
                    popular
                  />
                  <UpgradePlanRow 
                    name="Evident Advanced" 
                    price="$39/mo" 
                    href="/pricing"
                  />
                </>
              )}
              {usage?.plan === "scholar" && (
                <>
                  <UpgradePlanRow 
                    name="Evident Advanced" 
                    price="$39/mo" 
                    href="/pricing"
                    popular
                  />
                  <UpgradePlanRow 
                    name="Evident Max" 
                    price="$99/mo" 
                    highlight="Training Data Export"
                    href="/pricing"
                  />
                </>
              )}
              {usage?.plan === "pro" && (
                <UpgradePlanRow 
                  name="Evident Max" 
                  price="$99/mo" 
                  highlight="Training Data Export"
                  href="/pricing"
                  popular
                />
              )}
              {usage?.plan === "pro_plus" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <span>You're on our top individual plan!</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isLocalUser && (
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Usage This Month</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Questions</span>
              <span className="font-medium">
                {usage?.monthly?.queriesUsed ?? 0} / {usage?.monthly?.queriesLimit ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {isOrgAdmin && (
          <MenuLink href="/org/agents" icon={Building2} label="Org Admin Console" />
        )}

        <MenuLink href="/full" icon={Sparkles} label="My Workspace" />

        {isSuperAdmin && (
          <>
            <Separator className="my-4" />
            <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Admin Tools</p>
            <MenuLink href="/services" icon={FileSpreadsheet} label="Evident Insights" badge="Excel" />
            <MenuLink href="/use-cases" icon={Lightbulb} label="Use Cases" />
            <MenuLink href="/packs" icon={Boxes} label="Intelligence Packs" />
            <MenuLink href="/ai-readiness/qa" icon={HelpCircle} label="AI Readiness Guide" />
            <MenuLink href="/readiness" icon={FileSearch} label="AI Readiness Scanner" />
            <MenuLink href="/reports" icon={FileSpreadsheet} label="Create Report" />
          </>
        )}

        {hasPremiumAccess && (
          <MenuLink href="/policy" icon={FolderKanban} label="Policy Settings" />
        )}

        <Separator className="my-4" />

        {isSuperAdmin && (
          <MenuLink href="/admin" icon={Shield} label="Super Admin" />
        )}

        <MenuLink href="/pricing" icon={Tag} label="Plans & Pricing" />
        <MenuLink href="/billing" icon={CreditCard} label="Billing" />
        <MenuLink href="/settings" icon={Settings} label="Settings" />

        <Separator className="my-4" />

        <button
          type="button"
          onClick={async () => {
            try {
              localStorage.removeItem("evident_auth_token");
            } catch {}
            try {
              await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include",
              });
              window.location.href = "/";
            } catch {
              window.location.href = "/";
            }
          }}
          className="flex items-center justify-between w-full p-4 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          data-testid="button-sign-out"
        >
          <div className="flex items-center gap-3">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </div>
        </button>
      </div>
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  locked = false,
  badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  locked?: boolean;
  badge?: string;
}) {
  return (
    <Link href={href}>
      <div
        className="flex items-center justify-between p-4 rounded-lg bg-card hover:bg-muted/50 transition-colors border"
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        data-testid={`link-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">{label}</span>
          {badge && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        {locked ? (
          <Lock className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    </Link>
  );
}

function UpgradePlanRow({
  name,
  price,
  highlight,
  href,
  popular = false,
}: {
  name: string;
  price: string;
  highlight?: string;
  href: string;
  popular?: boolean;
}) {
  return (
    <Link href={href}>
      <div
        className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-muted/50 transition-colors border"
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        data-testid={`upgrade-${name.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className="flex items-center gap-2">
          <Star className={`w-4 h-4 ${popular ? "text-amber-500" : "text-muted-foreground"}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{name}</span>
              {popular && (
                <Badge variant="secondary" className="text-xs py-0">Popular</Badge>
              )}
            </div>
            {highlight && (
              <span className="text-xs text-muted-foreground">{highlight}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-primary">{price}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}
