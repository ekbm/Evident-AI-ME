import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, TrendingUp, Zap } from "lucide-react";
import { Link } from "wouter";

interface StarterUpsellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oneOffBoostCount: number;
  starterBenefits?: {
    name: string;
    price: number;
    maxFileSizeMB: number;
    queriesPerMonth: number;
    storageMB: number;
  } | null;
  onProceedWithBoost?: () => void;
}

export function StarterUpsellDialog({
  open,
  onOpenChange,
  oneOffBoostCount,
  starterBenefits,
  onProceedWithBoost,
}: StarterUpsellDialogProps) {
  const monthlyCost = oneOffBoostCount; // $1 per boost
  const starterPrice = starterBenefits?.price || 5;
  const savings = monthlyCost - starterPrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Save Money with Evident Lite
          </DialogTitle>
          <DialogDescription className="text-sm">
            You've used {oneOffBoostCount} upload boosts this month (${monthlyCost} spent).
            Upgrading to Evident Lite could save you money!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary">Evident Lite</span>
              <span className="text-lg font-bold">${starterPrice}/month</span>
            </div>
            
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span>{starterBenefits?.maxFileSizeMB || 10}MB file size limit (vs. 5MB free)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span>{starterBenefits?.queriesPerMonth || 50} questions/month (vs. 5 free)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span>{starterBenefits?.storageMB || 500}MB storage (vs. 100MB free)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span>Audio/video transcription included</span>
              </li>
            </ul>
          </div>

          {savings > 0 && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">
                  You'd save ${savings}/month based on your current usage!
                </span>
              </div>
            </div>
          )}

          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Zap className="w-4 h-4" />
              <span>No more buying individual boosts - upload freely within your limits</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {onProceedWithBoost && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onProceedWithBoost();
              }}
              className="w-full sm:w-auto"
              data-testid="button-proceed-with-boost"
            >
              Buy Boost Anyway ($1)
            </Button>
          )}
          <Link href="/pricing" className="w-full sm:w-auto">
            <Button 
              className="w-full"
              data-testid="button-view-starter-plan"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              View Evident Lite
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
