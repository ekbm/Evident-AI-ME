import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Copy,
  Check,
  Gift,
  Clock,
  Users,
  Sparkles,
  Share2,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PilotStatus {
  isPilotStudent: boolean;
  isAdminPreview?: boolean;
  referralCode: string | null;
  usesCount: number;
  maxUses: number;
  isActive: boolean;
  trialExpiresAt: string | null;
  pilotSuspended: boolean;
  bonusDaysEarned: number;
  signedUpAt: string | null;
  accessLog: Array<{
    id: string;
    eventType: string;
    description: string;
    daysAdded: number;
    newExpiryDate: string | null;
    relatedEmail: string | null;
    createdAt: string;
  }>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function eventIcon(eventType: string) {
  switch (eventType) {
    case "pilot_signup": return <GraduationCap className="w-3.5 h-3.5 text-primary" />;
    case "referral_code_created": return <Share2 className="w-3.5 h-3.5 text-blue-500" />;
    case "referral_bonus": return <Gift className="w-3.5 h-3.5 text-green-500" />;
    case "referral_signup": return <Users className="w-3.5 h-3.5 text-cyan-500" />;
    case "inactivity_warning": return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    case "pilot_suspended": return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
    default: return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

export default function PilotReferralCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: status, isLoading } = useQuery<PilotStatus>({
    queryKey: ["/api/pilot-referral/status"],
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pilot-referral/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pilot-referral/status"] });
      toast({ title: "Referral code generated!", description: "Share it with up to 3 classmates" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate referral code", variant: "destructive" });
    },
  });

  if (isLoading || !status?.isPilotStudent) return null;

  const remaining = daysUntil(status.trialExpiresAt);
  const referralsLeft = status.maxUses - status.usesCount;

  const handleCopyCode = () => {
    if (!status.referralCode) return;
    navigator.clipboard.writeText(status.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    if (!status.referralCode) return;
    const link = `${window.location.origin}/auth?mode=students&coupon=${status.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({ title: "Link copied!", description: "Share this link on WhatsApp or with classmates" });
  };

  return (
    <Card className="border-amber-500/30 dark:border-amber-400/20 bg-gradient-to-br from-amber-50 via-orange-50/50 to-transparent dark:from-amber-950/40 dark:via-orange-950/20 dark:to-transparent" data-testid="card-pilot-referral">
      <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setExpanded(!expanded)} data-testid="button-toggle-pilot-card">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 dark:bg-amber-400/15 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-amber-900 dark:text-amber-200">Student Pilot Program</span>
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {status.isAdminPreview && (
              <Badge variant="outline" className="text-xs border-slate-500/40 text-slate-600 dark:text-slate-400" data-testid="badge-admin-preview">Admin Preview</Badge>
            )}
            {status.pilotSuspended ? (
              <Badge variant="destructive" className="text-xs" data-testid="badge-pilot-suspended">Suspended</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300 border-amber-500/20" data-testid="badge-pilot-active">Active</Badge>
            )}
            <ChevronDown className={`w-4 h-4 text-amber-400 dark:text-amber-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </div>
        </div>
      </CardHeader>
      {expanded && <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/15 dark:border-amber-400/10" data-testid="stat-days-remaining">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{remaining}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Days Left</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/15 dark:border-amber-400/10" data-testid="stat-referrals">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{status.usesCount}/{status.maxUses}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Referrals</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/15 dark:border-amber-400/10" data-testid="stat-bonus-days">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">+{status.bonusDaysEarned}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Bonus Days</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border text-xs">
          <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Access expires:</span>
          <span className="font-semibold" data-testid="text-expiry-date">{formatDate(status.trialExpiresAt)}</span>
        </div>

        {status.pilotSuspended && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-destructive">Pilot access suspended due to inactivity</p>
              <p className="text-muted-foreground mt-1">You still have your standard 60-day student access. Log in regularly to keep your pilot access active.</p>
            </div>
          </div>
        )}

        {!status.referralCode ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Generate a personal referral code to share with classmates. Each referral earns you <span className="font-semibold text-green-600 dark:text-green-400">+30 bonus days</span>.
            </p>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="w-full gap-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 text-white"
              data-testid="button-generate-referral"
            >
              <Sparkles className="w-4 h-4" />
              {generateMutation.isPending ? "Generating..." : "Generate My Referral Code"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Your Referral Code</p>
              <div
                className="flex items-center justify-between gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-amber-500/30 dark:border-amber-400/30 bg-amber-500/5 dark:bg-amber-400/5 cursor-pointer hover:bg-amber-500/10 dark:hover:bg-amber-400/10 transition-colors"
                onClick={handleCopyCode}
                data-testid="referral-code-box"
              >
                <code className="text-lg font-mono font-bold tracking-wider text-amber-600 dark:text-amber-400">
                  {status.referralCode}
                </code>
                <Button variant="ghost" size="sm" className="shrink-0 h-8 px-2" data-testid="button-copy-referral">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs"
                onClick={handleCopyLink}
                data-testid="button-copy-referral-link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5" />}
                {copiedLink ? "Link Copied!" : "Copy Signup Link"}
              </Button>
            </div>

            {referralsLeft > 0 ? (
              <p className="text-xs text-muted-foreground text-center">
                {referralsLeft} referral{referralsLeft !== 1 ? "s" : ""} remaining · Each earns +30 days
              </p>
            ) : (
              <p className="text-xs text-green-600 dark:text-green-400 text-center font-medium">
                All 3 referrals used — you've earned {status.bonusDaysEarned} bonus days!
              </p>
            )}
          </div>
        )}

        {status.accessLog && status.accessLog.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Access History</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {status.accessLog.map((log) => (
                <div key={log.id} className="flex items-start gap-2 p-2 rounded-md bg-background border text-xs" data-testid={`log-entry-${log.id}`}>
                  <div className="mt-0.5 shrink-0">{eventIcon(log.eventType)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground leading-snug">{log.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
                      {log.newExpiryDate && (
                        <span className="text-muted-foreground">· Expires: {formatDate(log.newExpiryDate)}</span>
                      )}
                    </div>
                  </div>
                  {log.daysAdded > 0 && (
                    <Badge variant="secondary" className="shrink-0 bg-green-500/10 text-green-600 dark:text-green-400 text-[10px]">
                      +{log.daysAdded}d
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>}
    </Card>
  );
}
