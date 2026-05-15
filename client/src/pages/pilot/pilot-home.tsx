import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  FileText, 
  HardDrive, 
  BarChart3, 
  AlertTriangle, 
  ScanLine, 
  UserCheck,
  ArrowRight,
  Shield,
  FlaskConical
} from "lucide-react";
import { useState } from "react";
import { AssessmentRequestModal } from "@/components/assessment-request-modal";
import { ExpansionRequestModal } from "@/components/expansion-request-modal";

interface PilotData {
  id: string;
  name: string;
  scopeType: string;
  maxDocuments: number;
  maxTotalSizeMB: number;
  status: string;
  documentsCount: number;
  totalSizeMB: number;
  avgReadinessScore: number | null;
  lastScanAt: string | null;
}

interface PilotIssue {
  code: string;
  count: number;
  severity: string;
}

export default function PilotHome() {
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showExpansionModal, setShowExpansionModal] = useState(false);

  const { data: pilot, isLoading } = useQuery<PilotData>({
    queryKey: ["/api/pilot"],
  });

  const { data: issues = [] } = useQuery<PilotIssue[]>({
    queryKey: ["/api/pilot/issues"],
    enabled: !!pilot,
  });

  const docsPercent = pilot ? (pilot.documentsCount / pilot.maxDocuments) * 100 : 0;
  const sizePercent = pilot ? (pilot.totalSizeMB / pilot.maxTotalSizeMB) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
          <Button variant="ghost" size="sm" asChild className="self-start" data-testid="button-back">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-chart-4 shrink-0" />
              <h1 className="text-xl sm:text-2xl font-bold">AI Pilot Overview</h1>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
              You are running a controlled AI pilot. Changes are limited to this scope.
            </p>
          </div>
        </div>

        <Alert className="mb-6 border-chart-4/30 bg-chart-4/5">
          <Shield className="h-4 w-4 text-chart-4" />
          <AlertDescription>
            This pilot is isolated. Documents here are not used outside this pilot.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : pilot ? (
          <>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    Pilot Scope
                  </CardTitle>
                  <CardDescription>Documents and storage used</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Documents</span>
                      <span>{pilot.documentsCount} / {pilot.maxDocuments}</span>
                    </div>
                    <Progress value={docsPercent} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Storage</span>
                      <span>{pilot.totalSizeMB.toFixed(1)} MB / {pilot.maxTotalSizeMB} MB</span>
                    </div>
                    <Progress value={sizePercent} className="h-2" />
                  </div>
                  {pilot.lastScanAt && (
                    <p className="text-xs text-muted-foreground">
                      Last scan: {new Date(pilot.lastScanAt).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    AI Readiness Score
                  </CardTitle>
                  <CardDescription>Average score across pilot documents</CardDescription>
                </CardHeader>
                <CardContent>
                  {pilot.avgReadinessScore !== null ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">{pilot.avgReadinessScore}</span>
                      <span className="text-muted-foreground">/ 100</span>
                      <Badge variant={pilot.avgReadinessScore >= 70 ? "default" : pilot.avgReadinessScore >= 40 ? "secondary" : "destructive"}>
                        {pilot.avgReadinessScore >= 70 ? "READY" : pilot.avgReadinessScore >= 40 ? "NEEDS PREP" : "MANUAL"}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No scans completed yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Key Issues Detected
                  </CardTitle>
                  <CardDescription>Top issues in pilot documents</CardDescription>
                </CardHeader>
                <CardContent>
                  {issues.length > 0 ? (
                    <div className="space-y-2">
                      {issues.slice(0, 4).map((issue, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="truncate">{issue.code}</span>
                          <Badge variant="outline" className="ml-2">{issue.count}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No issues detected</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ScanLine className="w-4 h-4" />
                    Next Recommended Action
                  </CardTitle>
                  <CardDescription>Improve your pilot documents</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pilot.documentsCount === 0 ? (
                    <Button asChild className="w-full">
                      <Link href="/">
                        <FileText className="w-4 h-4 mr-2" />
                        Upload Documents
                      </Link>
                    </Button>
                  ) : pilot.avgReadinessScore === null ? (
                    <Button asChild className="w-full">
                      <Link href="/pilot/documents">
                        <ScanLine className="w-4 h-4 mr-2" />
                        Run Readiness Scans
                      </Link>
                    </Button>
                  ) : issues.some(i => i.code.includes("Owner")) ? (
                    <Button asChild className="w-full">
                      <Link href="/pilot/documents">
                        <UserCheck className="w-4 h-4 mr-2" />
                        Assign Owners
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/pilot/documents">
                        <FileText className="w-4 h-4 mr-2" />
                        View Documents
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Button 
                onClick={() => setShowAssessmentModal(true)} 
                variant="outline"
                className="h-auto py-4"
                data-testid="button-request-assessment"
              >
                <div className="text-left">
                  <div className="font-medium flex items-center gap-2">
                    Request AI Readiness Assessment
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    One-off professional audit of your documents
                  </p>
                </div>
              </Button>

              <Button 
                onClick={() => setShowExpansionModal(true)} 
                variant="outline"
                className="h-auto py-4"
                data-testid="button-request-expansion"
              >
                <div className="text-left">
                  <div className="font-medium flex items-center gap-2">
                    Request Expansion
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Increase document or storage limits
                  </p>
                </div>
              </Button>
            </div>

            <div className="flex justify-center gap-4 mt-8">
              <Button variant="ghost" asChild>
                <Link href="/pilot/documents">
                  View Documents
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/pilot/settings">
                  Pilot Settings
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Unable to load pilot data. Please try again.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <AssessmentRequestModal 
        open={showAssessmentModal} 
        onOpenChange={setShowAssessmentModal}
        contextData={{
          currentScore: pilot?.avgReadinessScore ?? undefined,
          documentCount: pilot?.documentsCount,
          issuesSummary: issues.length > 0 ? issues.slice(0, 3).map(i => i.code).join(", ") : undefined,
        }}
      />

      <ExpansionRequestModal
        open={showExpansionModal}
        onOpenChange={setShowExpansionModal}
        pilotId={pilot?.id}
        currentLimits={{
          documents: pilot?.maxDocuments ?? 200,
          sizeMB: pilot?.maxTotalSizeMB ?? 500,
        }}
      />
    </div>
  );
}
