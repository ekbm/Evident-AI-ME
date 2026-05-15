import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Info, Sparkles, ArrowRight, DollarSign, Scale, Users, 
  ShoppingCart, HardHat, Shield, FileText 
} from "lucide-react";
import { PackIdType, getPack } from "@shared/packs";

interface PackSuggestionBannerProps {
  documentType: string;
  suggestedPackId: PackIdType;
  onDismiss?: () => void;
}

const packIcons: Record<string, any> = {
  DollarSign,
  Scale,
  Users,
  ShoppingCart,
  HardHat,
  Shield,
};

export function PackSuggestionBanner({ 
  documentType, 
  suggestedPackId,
  onDismiss 
}: PackSuggestionBannerProps) {
  const pack = getPack(suggestedPackId);
  if (!pack) return null;

  const Icon = packIcons[pack.icon] || FileText;

  return (
    <Alert className="border-amber-500/30 bg-amber-500/5" data-testid="pack-suggestion-banner">
      <Info className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        This looks like a {documentType}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm text-muted-foreground mb-3">
          This document type is best analyzed with the <strong>{pack.title}</strong>. 
          Without the pack, this document uses free tier limits.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/plan-limits">
            <Button size="sm" className="gap-2" data-testid="button-view-packs">
              <Icon className="h-4 w-4" />
              View Packs
              <Badge className="bg-emerald-500/20 text-emerald-700 ml-1">FREE</Badge>
            </Button>
          </Link>
          {onDismiss && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onDismiss}
              data-testid="button-dismiss-suggestion"
            >
              Continue with free limits
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

interface PackMismatchInfoProps {
  enabledPackIds: PackIdType[];
  documentPackId: PackIdType | null;
}

export function PackMismatchInfo({ enabledPackIds, documentPackId }: PackMismatchInfoProps) {
  if (!documentPackId) return null;
  
  const isEnabled = enabledPackIds.includes(documentPackId);
  if (isEnabled) return null;

  const pack = getPack(documentPackId);
  if (!pack) return null;

  return (
    <div 
      className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 px-2 py-1 rounded"
      data-testid="pack-mismatch-info"
    >
      <Info className="h-3 w-3" />
      <span>Free tier limits (no {pack.title.replace(" Intelligence Pack", "")} pack)</span>
    </div>
  );
}
