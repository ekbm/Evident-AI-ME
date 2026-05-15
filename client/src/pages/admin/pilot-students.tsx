import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  GraduationCap,
  Users,
  Clock,
  Gift,
  AlertTriangle,
  CalendarDays,
  Share2,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDocumentTitle } from "@/hooks/use-document-title";

interface PilotStudent {
  userId: string;
  email: string | null;
  firstName: string | null;
  signedUpAt: string | null;
  lastLoginAt: string | null;
  trialExpiresAt: string | null;
  pilotSuspended: boolean;
  referralCode: string | null;
  referralUses: number;
  bonusDays: number;
}

interface AccessLogEntry {
  id: string;
  userId: string;
  eventType: string;
  description: string;
  daysAdded: number;
  newExpiryDate: string | null;
  relatedEmail: string | null;
  createdAt: string;
}

interface AdminOverview {
  totalPilotStudents: number;
  pilotStudents: PilotStudent[];
  allLogs: AccessLogEntry[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function eventBadge(eventType: string) {
  switch (eventType) {
    case "pilot_signup": return <Badge className="bg-primary/10 text-primary text-[10px]">Signup</Badge>;
    case "referral_code_created": return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px]">Code Created</Badge>;
    case "referral_bonus": return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 text-[10px]">Bonus</Badge>;
    case "referral_signup": return <Badge className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px]">Referred Signup</Badge>;
    case "inactivity_warning": return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">Warning</Badge>;
    case "pilot_suspended": return <Badge variant="destructive" className="text-[10px]">Suspended</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{eventType}</Badge>;
  }
}

export default function AdminPilotStudents() {
  useDocumentTitle("Admin - Pilot Students");
  const { toast } = useToast();
  const [showAllLogs, setShowAllLogs] = useState(false);

  const { data, isLoading, error } = useQuery<AdminOverview>({
    queryKey: ["/api/pilot-referral/admin-overview"],
  });

  const checkInactiveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pilot-referral/check-inactive"),
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/pilot-referral/admin-overview"] });
      toast({
        title: "Inactivity check complete",
        description: `Checked ${result.checked} students. ${result.warned.length} warned, ${result.suspended.length} suspended.`,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run inactivity check", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-32 bg-muted rounded-lg" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto text-center py-20">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
          <p className="text-muted-foreground">You need admin privileges to view this page.</p>
        </div>
      </div>
    );
  }

  const students = data?.pilotStudents || [];
  const logs = data?.allLogs || [];
  const activeStudents = students.filter((s) => !s.pilotSuspended);
  const suspendedStudents = students.filter((s) => s.pilotSuspended);
  const totalReferrals = students.reduce((sum, s) => sum + s.referralUses, 0);
  const totalBonusDays = students.reduce((sum, s) => sum + s.bonusDays, 0);
  const displayedLogs = showAllLogs ? logs : logs.slice(0, 15);

  return (
    <div className="min-h-screen bg-background" data-testid="page-admin-pilot-students">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" data-testid="link-back-admin">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Admin
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-lg font-bold flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Student Pilot
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => checkInactiveMutation.mutate()}
            disabled={checkInactiveMutation.isPending}
            data-testid="button-check-inactive"
          >
            <RefreshCw className={`w-4 h-4 ${checkInactiveMutation.isPending ? "animate-spin" : ""}`} />
            {checkInactiveMutation.isPending ? "Checking..." : "Check Inactive"}
          </Button>
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card data-testid="stat-total-students">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-primary">{data?.totalPilotStudents || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Pilot Students</div>
              <div className="text-[10px] text-muted-foreground">of 20 slots</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-active-students">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{activeStudents.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Active</div>
              <div className="text-[10px] text-muted-foreground">{suspendedStudents.length} suspended</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-total-referrals">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{totalReferrals}</div>
              <div className="text-xs text-muted-foreground mt-1">Referrals Made</div>
              <div className="text-[10px] text-muted-foreground">of {students.length * 3} possible</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-total-bonus-days">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">+{totalBonusDays}</div>
              <div className="text-xs text-muted-foreground mt-1">Bonus Days Given</div>
              <div className="text-[10px] text-muted-foreground">across all students</div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-student-list">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5" />
              Pilot Students ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No pilot students have signed up yet.</p>
            ) : (
              <div className="space-y-2">
                {students.map((student) => (
                  <div
                    key={student.userId}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    data-testid={`student-row-${student.userId}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{student.email || "Unknown"}</p>
                        {student.pilotSuspended ? (
                          <Badge variant="destructive" className="text-[10px] shrink-0">Suspended</Badge>
                        ) : (
                          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] shrink-0">Active</Badge>
                        )}
                      </div>
                      {student.firstName && (
                        <p className="text-xs text-muted-foreground">{student.firstName}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1" title="Signed up">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>{formatDate(student.signedUpAt)}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Last login">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {student.lastLoginAt
                            ? `${daysSince(student.lastLoginAt)}d ago`
                            : "Never"
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-1" title="Access expires">
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span className="font-medium text-foreground">{formatDate(student.trialExpiresAt)}</span>
                        <span>({daysUntil(student.trialExpiresAt)}d left)</span>
                      </div>
                      {student.referralCode && (
                        <div className="flex items-center gap-1" title="Referral code">
                          <Share2 className="w-3.5 h-3.5" />
                          <code className="font-mono text-primary">{student.referralCode}</code>
                          <span>({student.referralUses}/3)</span>
                        </div>
                      )}
                      {student.bonusDays > 0 && (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400" title="Bonus days earned">
                          <Gift className="w-3.5 h-3.5" />
                          <span>+{student.bonusDays}d</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-access-log">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Access Log ({logs.length} events)
              </CardTitle>
              {logs.length > 15 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllLogs(!showAllLogs)}
                  data-testid="button-toggle-logs"
                >
                  {showAllLogs ? "Show Less" : `Show All (${logs.length})`}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No events logged yet.</p>
            ) : (
              <div className="space-y-1.5">
                {displayedLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-2.5 rounded-md border bg-card text-xs"
                    data-testid={`admin-log-${log.id}`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {eventBadge(log.eventType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground leading-snug">{log.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                        <span>{formatDateTime(log.createdAt)}</span>
                        {log.newExpiryDate && (
                          <>
                            <span>·</span>
                            <span>New expiry: <span className="font-medium text-foreground">{formatDate(log.newExpiryDate)}</span></span>
                          </>
                        )}
                        {log.relatedEmail && (
                          <>
                            <span>·</span>
                            <span>{log.relatedEmail}</span>
                          </>
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
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
