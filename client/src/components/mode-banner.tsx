import { Link } from "wouter";
import { useAppContext } from "@/contexts/app-context";
import { ArrowRight, Sparkles, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ModeBanner() {
  const { appMode, entitlements } = useAppContext();

  if (entitlements.pro) return null;

  if (appMode === "WORKSPACE") {
    return (
      <div className="bg-primary/5 border-b border-primary/10 px-4 py-2">
        <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Need more uploads or auto-prep?</span>
          </div>
          <Button variant="link" size="sm" asChild className="p-0 h-auto" data-testid="link-view-pro">
            <Link href="/pricing#personal">
              View Pro
              <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (appMode === "PILOT") {
    return (
      <div className="bg-primary/5 border-b border-primary/10 px-4 py-2">
        <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-primary" />
            <span>Need a one-off assessment or monitoring?</span>
          </div>
          <Button variant="link" size="sm" asChild className="p-0 h-auto" data-testid="link-view-org">
            <Link href="/pricing#org">
              View Organisation plans
              <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
