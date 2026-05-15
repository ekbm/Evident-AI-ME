import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { OwnerAssignmentModal } from "@/components/owner-assignment-modal";
import { ContextualAssessmentBanner } from "@/components/contextual-assessment-banner";
import { AssessmentAuditTile } from "@/components/assessment-audit-tile";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Scan,
  Sparkles,
  FileText,
  Loader2,
  RefreshCw,
  Info,
  Clock,
  Save,
  StickyNote,
  UserPlus,
  HelpCircle,
} from "lucide-react";
import type { Asset } from "@shared/schema";

interface ReadinessScan {
  id: string;
  assetId: string;
  score: number;
  status: "READY" | "NEEDS_PREP" | "MANUAL";
  subscores: {
    extractability: number;
    structure: number;
    quality: number;
    metadata: number;
    sensitivityAdjustment: number;
  };
  issues: Array<{
    message: string;
    severity: "HIGH" | "MED" | "LOW";
    action: string;
  }>;
  scannedAt: string;
  notes?: string;
  prepJob?: {
    id: string;
    status: string;
    progress: number;
  } | null;
  estimatedImprovement?: {
    min: number;
    max: number;
  };
}

interface PrepJobStatus {
  jobId: string;
  assetId: string;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  progress: number;
  logs: Array<{ ts: string; msg: string; level: string }>;
  preparedDocumentId?: string;
  error?: string;
  scoreBefore?: number;
  scoreAfter?: number;
  scoreDelta?: number;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "READY":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "NEEDS_PREP":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "MANUAL":
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Info className="h-5 w-5 text-muted-foreground" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "READY":
      return <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400">Ready</Badge>;
    case "NEEDS_PREP":
      return <Badge variant="default" className="bg-amber-500/10 text-amber-600 dark:text-amber-400">Needs Preparation</Badge>;
    case "MANUAL":
      return <Badge variant="default" className="bg-red-500/10 text-red-600 dark:text-red-400">Manual Review</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "HIGH":
      return "text-red-600 dark:text-red-400";
    case "MED":
      return "text-amber-600 dark:text-amber-400";
    case "LOW":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

function ScoreGauge({ score, size = "large" }: { score: number; size?: "small" | "large" }) {
  const radius = size === "large" ? 60 : 30;
  const stroke = size === "large" ? 10 : 6;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getColor = (score: number) => {
    if (score >= 70) return "stroke-green-500";
    if (score >= 40) return "stroke-amber-500";
    return "stroke-red-500";
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={(radius + stroke) * 2} height={(radius + stroke) * 2}>
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/20"
        />
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className={getColor(score)}
          transform={`rotate(-90 ${radius + stroke} ${radius + stroke})`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${size === "large" ? "text-3xl" : "text-lg"} font-bold`}>
          {score}
        </span>
      </div>
    </div>
  );
}

function SubscoreBar({ label, value, max = 1 }: { label: string; value: number; max?: number }) {
  const percentage = Math.round((value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}

export default function ReadinessPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [notesChanged, setNotesChanged] = useState(false);
  const [showOwnerModal, setShowOwnerModal] = useState(false);

  const { data: assets = [], isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    enabled: isAuthenticated,
  });

  const readyAssets = assets.filter(a => a.status === "READY");

  const { data: scanResult, isLoading: scanLoading, refetch: refetchScan } = useQuery<ReadinessScan>({
    queryKey: ["/api/readiness", selectedAssetId],
    enabled: !!selectedAssetId,
  });

  const { data: jobStatus, refetch: refetchJobStatus } = useQuery<PrepJobStatus>({
    queryKey: ["/api/prep/status", activeJobId],
    enabled: !!activeJobId,
    refetchInterval: activeJobId ? 2000 : false,
  });

  useEffect(() => {
    if (jobStatus?.status === "DONE" || jobStatus?.status === "FAILED") {
      setActiveJobId(null);
      refetchScan();
      if (jobStatus.status === "DONE") {
        toast({
          title: "Preparation Complete",
          description: `Score improved from ${jobStatus.scoreBefore} to ${jobStatus.scoreAfter} (+${jobStatus.scoreDelta})`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Preparation Failed",
          description: jobStatus.error || "An error occurred during preparation",
        });
      }
    }
  }, [jobStatus?.status]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/scan");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const scanMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiRequest("POST", "/api/readiness/scan", { assetId });
      return response.json() as Promise<ReadinessScan>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/readiness", data.assetId], data);
      toast({
        title: "Scan Complete",
        description: `AI-Readiness score: ${data.score}`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: error.message,
      });
    },
  });

  const prepMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiRequest("POST", "/api/prep/start", { assetId });
      return response.json() as Promise<{ jobId: string; status: string }>;
    },
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      toast({
        title: "Preparation Started",
        description: "We're improving your document's AI-readiness...",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Start",
        description: error.message,
      });
    },
  });

  const notesMutation = useMutation({
    mutationFn: async ({ scanId, notes }: { scanId: string; notes: string }) => {
      await apiRequest("PATCH", `/api/readiness/${scanId}/notes`, { notes });
    },
    onSuccess: () => {
      setNotesChanged(false);
      toast({
        title: "Notes Saved",
        description: "Your notes have been saved successfully.",
      });
      if (selectedAssetId) {
        queryClient.invalidateQueries({ queryKey: ["/api/readiness", selectedAssetId] });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Save Notes",
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (scanResult) {
      setNotesValue(scanResult.notes || "");
      setNotesChanged(false);
    }
  }, [scanResult?.id]);

  const handleNotesChange = useCallback((value: string) => {
    setNotesValue(value);
    setNotesChanged(true);
  }, []);

  const handleSaveNotes = useCallback(() => {
    if (scanResult && notesChanged) {
      notesMutation.mutate({ scanId: scanResult.id, notes: notesValue });
    }
  }, [scanResult, notesValue, notesChanged, notesMutation]);

  const handleSelectAsset = (assetId: string) => {
    setSelectedAssetId(assetId);
    setActiveJobId(null);
  };

  const handleScan = () => {
    if (selectedAssetId) {
      scanMutation.mutate(selectedAssetId);
    }
  };

  const handleStartPrep = () => {
    if (selectedAssetId) {
      prepMutation.mutate(selectedAssetId);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedAsset = assets.find(a => a.id === selectedAssetId);
  const isPrepRunning = activeJobId && jobStatus && (jobStatus.status === "QUEUED" || jobStatus.status === "RUNNING");

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="sm" asChild className="self-start" data-testid="button-back">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold">AI-Readiness Scanner</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Analyze documents and prepare them for optimal AI extraction</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/ai-readiness/qa">
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-what-is-readiness">
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">What is AI Readiness?</span>
              <span className="sm:hidden">Learn More</span>
            </Button>
          </Link>
        </div>
      </div>

      {scanResult && (
        <div className="mb-6">
          <ContextualAssessmentBanner
            averageScore={scanResult.score}
            documentCount={readyAssets.length}
            issueCount={scanResult.issues?.length || 0}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <AssessmentAuditTile
            currentScore={scanResult?.score}
            issuesSummary={scanResult ? `${scanResult.issues?.length || 0} issues found` : undefined}
            documentCount={readyAssets.length}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documents</CardTitle>
              <CardDescription>Select a processed document to analyze</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                {assetsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : readyAssets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No processed documents</p>
                    <p className="text-sm mt-1">Upload documents on the home page first</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {readyAssets.map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => handleSelectAsset(asset.id)}
                        className={`w-full text-left p-3 rounded-md transition-colors hover-elevate ${
                          selectedAssetId === asset.id
                            ? "bg-accent"
                            : "hover:bg-accent/50"
                        }`}
                        data-testid={`button-asset-${asset.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{asset.filename}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between gap-2">
              <span>Analysis Results</span>
              {scanResult && getStatusBadge(scanResult.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedAssetId ? (
              <div className="text-center py-12 text-muted-foreground">
                <Scan className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a document to analyze its AI-Readiness</p>
              </div>
            ) : scanLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !scanResult ? (
              <div className="text-center py-12">
                <Scan className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">This document hasn't been scanned yet</p>
                <Button 
                  onClick={handleScan} 
                  disabled={scanMutation.isPending}
                  data-testid="button-scan"
                >
                  {scanMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Scan className="h-4 w-4 mr-2" />
                      Run AI-Readiness Scan
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Tabs defaultValue="score">
                <TabsList className="mb-4">
                  <TabsTrigger value="score" data-testid="tab-score">Score</TabsTrigger>
                  <TabsTrigger value="issues" data-testid="tab-issues">Issues ({scanResult.issues.length})</TabsTrigger>
                  <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
                  {isPrepRunning && <TabsTrigger value="progress" data-testid="tab-progress">Progress</TabsTrigger>}
                </TabsList>

                <TabsContent value="score" className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center gap-8">
                    <ScoreGauge score={scanResult.score} />
                    <div className="flex-1 space-y-4 w-full">
                      <SubscoreBar label="Extractability" value={scanResult.subscores.extractability} />
                      <SubscoreBar label="Structure" value={scanResult.subscores.structure} />
                      <SubscoreBar label="Quality" value={scanResult.subscores.quality} />
                      <SubscoreBar label="Metadata" value={scanResult.subscores.metadata} />
                    </div>
                  </div>

                  {scanResult.subscores.sensitivityAdjustment < 1 && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Sensitivity detected. Score adjusted by {Math.round((1 - scanResult.subscores.sensitivityAdjustment) * 100)}%
                      </AlertDescription>
                    </Alert>
                  )}

                  <Alert className="bg-muted/50">
                    <HelpCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm font-medium">
                      {scanResult.score >= 70 
                        ? "Great! This document is well-prepared for AI analysis."
                        : scanResult.score >= 40
                        ? "This document needs some preparation for optimal AI extraction."
                        : "This document requires significant preparation before AI can effectively analyze it."
                      }
                    </AlertTitle>
                    <AlertDescription className="text-sm mt-1">
                      <span className="block mb-2">
                        <strong>Extractability</strong> measures how well text can be read from the document.
                        <strong className="ml-2">Structure</strong> checks for headings, lists, and organized content.
                        <strong className="ml-2">Quality</strong> evaluates text clarity and encoding.
                        <strong className="ml-2">Metadata</strong> looks for title, date, and author information.
                      </span>
                      <div className="mt-3">
                        <Link href="/ai-readiness/qa">
                          <Button variant="outline" size="sm" className="gap-2" data-testid="button-learn-more">
                            <HelpCircle className="h-4 w-4" />
                            Understand Your Results
                          </Button>
                        </Link>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <Separator />

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={handleScan}
                      disabled={scanMutation.isPending}
                      data-testid="button-rescan"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Rescan
                    </Button>

                    {scanResult.status !== "READY" && (
                      <Button
                        onClick={handleStartPrep}
                        disabled={prepMutation.isPending || !!isPrepRunning}
                        data-testid="button-make-ready"
                      >
                        {prepMutation.isPending || isPrepRunning ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Preparing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Make AI-Ready
                          </>
                        )}
                      </Button>
                    )}

                    {scanResult.status === "READY" && (
                      <Badge variant="outline" className="px-3 py-2">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                        Ready for extraction
                      </Badge>
                    )}
                  </div>

                  {scanResult.estimatedImprovement && scanResult.status !== "READY" && (
                    <p className="text-sm text-muted-foreground">
                      Estimated improvement: +{scanResult.estimatedImprovement.min} to +{scanResult.estimatedImprovement.max} points
                    </p>
                  )}

                  <Separator className="my-4" />

                  <div className="flex justify-center">
                    <Link href="/full">
                      <Button variant="outline" size="lg" className="gap-2" data-testid="button-workspace-from-score">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Workspace
                      </Button>
                    </Link>
                  </div>
                </TabsContent>

                <TabsContent value="issues">
                  {scanResult.issues.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                      <p>No issues detected</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {scanResult.issues.map((issue, idx) => (
                          <div key={idx} className="p-3 rounded-md bg-muted/50">
                            <div className="flex items-start gap-3">
                              {issue.severity === "HIGH" ? (
                                <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                              ) : issue.severity === "MED" ? (
                                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                              ) : (
                                <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <p className={`font-medium ${getSeverityColor(issue.severity)}`}>
                                  {issue.message}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-sm text-muted-foreground">
                                    Action: {issue.action}
                                  </p>
                                  {issue.action === "Assign Owner" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setShowOwnerModal(true)}
                                      data-testid="button-assign-owner-issue"
                                    >
                                      <UserPlus className="h-3 w-3 mr-1" />
                                      Assign
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline" className="shrink-0">
                                {issue.severity}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="space-y-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <StickyNote className="h-4 w-4" />
                    <span className="text-sm">Add observations, next steps, or metadata about this document</span>
                  </div>
                  <Textarea
                    placeholder="Add your notes here..."
                    value={notesValue}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    className="min-h-[150px] resize-y"
                    data-testid="input-notes"
                  />
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                      {notesChanged ? "You have unsaved changes" : scanResult.notes ? "Last saved with scan" : "No notes yet"}
                    </p>
                    <Button
                      onClick={handleSaveNotes}
                      disabled={!notesChanged || notesMutation.isPending}
                      data-testid="button-save-notes"
                    >
                      {notesMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Notes
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>

                {isPrepRunning && (
                  <TabsContent value="progress">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Progress value={jobStatus?.progress || 0} className="flex-1" />
                        <span className="text-sm font-medium">{jobStatus?.progress || 0}%</span>
                      </div>
                      <ScrollArea className="h-[200px] rounded-md border p-3">
                        <div className="space-y-1 font-mono text-sm">
                          {jobStatus?.logs.map((log, idx) => (
                            <div key={idx} className="flex gap-2">
                              <span className="text-muted-foreground shrink-0">
                                {new Date(log.ts).toLocaleTimeString()}
                              </span>
                              <span className={log.level === "error" ? "text-red-500" : ""}>
                                {log.msg}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            How AI-Readiness Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <h4 className="font-medium mb-1">Extractability (40%)</h4>
              <p className="text-sm text-muted-foreground">
                Measures how much text can be extracted. Scanned PDFs (OCR) score lower initially.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Structure (25%)</h4>
              <p className="text-sm text-muted-foreground">
                Detects headings, lists, and tables. Well-structured documents are easier to chunk.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Quality & Metadata (35%)</h4>
              <p className="text-sm text-muted-foreground">
                Checks for encoding issues, duplicates, and document metadata like title and date.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <OwnerAssignmentModal
        open={showOwnerModal}
        onOpenChange={setShowOwnerModal}
        documentIds={selectedAssetId ? [selectedAssetId] : []}
        documentName={selectedAsset?.filename}
        onSuccess={() => {
          refetchScan();
        }}
      />
    </div>
  );
}
