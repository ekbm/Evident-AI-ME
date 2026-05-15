import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, FolderOpen, FileStack, Download, Calendar, Play, Plus, AlertCircle, Loader2, Check, TrendingUp, BarChart3, Shield, Sparkles, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface Workspace {
  id: string;
  userId: string;
  name: string;
  createdAt: string | null;
}

interface Report {
  id: string;
  workspaceId: string;
  type: string;
  schedule: string;
  lastRun: string | null;
  nextRun: string | null;
  content: string | null;
  createdAt: string | null;
}

interface PremiumOrgFeaturesProps {
  onWorkspaceSelect?: (workspaceId: string | null) => void;
  selectedWorkspaceId: string | null;
}

export function PremiumOrgFeatures({ onWorkspaceSelect, selectedWorkspaceId }: PremiumOrgFeaturesProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [selectedReportType, setSelectedReportType] = useState("weekly_summary");
  const [selectedSchedule, setSelectedSchedule] = useState("weekly");
  const { toast } = useToast();

  const { data: workspacesData } = useQuery<{ workspaces: Workspace[] }>({
    queryKey: ["/api/premium/workspaces"],
  });

  const workspaces = workspacesData?.workspaces || [];

  const { data: reportsData, refetch: refetchReports } = useQuery<{ reports: Report[] }>({
    queryKey: ["/api/premium/reports"],
    queryFn: async () => {
      if (!selectedWorkspaceId) return { reports: [] };
      const res = await fetch(`/api/premium/reports?workspaceId=${selectedWorkspaceId}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
    enabled: !!selectedWorkspaceId,
  });

  const reports = reportsData?.reports || [];

  const createWorkspaceMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/premium/workspaces", { name });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/premium/workspaces"] });
      setShowCreateDialog(false);
      setNewWorkspaceName("");
      if (onWorkspaceSelect && data.workspace) {
        onWorkspaceSelect(data.workspace.id);
      }
      toast({
        title: "Workspace Created",
        description: `"${data.workspace?.name}" is ready to use. Select it to add documents and schedule reports.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create workspace",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createReportMutation = useMutation({
    mutationFn: async ({ workspaceId, type, schedule }: { workspaceId: string; type: string; schedule: string }) => {
      const res = await apiRequest("POST", "/api/premium/reports", { workspaceId, type, schedule });
      return res.json();
    },
    onSuccess: () => {
      refetchReports();
      toast({
        title: "Report Scheduled",
        description: "Your report has been scheduled and will run automatically.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to schedule report",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const runReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await apiRequest("POST", `/api/premium/reports/${reportId}/run`);
      return res.json();
    },
    onSuccess: () => {
      refetchReports();
      toast({
        title: "Report Generated",
        description: "Your report has been generated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to run report",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Demo workspace creation for onboarding
  const createDemoWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/demo/create-policy-workspace");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/premium/workspaces"] });
      if (onWorkspaceSelect && data.workspace) {
        onWorkspaceSelect(data.workspace.id);
      }
      toast({
        title: "Demo Workspace Created",
        description: `Created "${data.workspace?.name}" with ${data.clausesCreated} sample policy clauses. Upload documents and ask questions to see policy citations!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create demo workspace",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const exportTrainingMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      const res = await apiRequest("POST", "/api/premium/export-training-data", { workspaceId, format: "json" });
      return res.json();
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data.qa_pairs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `training-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Export Complete",
        description: "Training data has been downloaded.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to export training data",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatReportType = (type: string) => {
    const types: Record<string, string> = {
      weekly_summary: "Weekly Summary",
      monthly_gaps: "Monthly Gaps",
      obligations_report: "Obligations Report",
    };
    return types[type] || type;
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-b from-chart-2/10 to-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-chart-2" />
            <span>Premium Org</span>
          </div>
          <Badge variant="outline" className="text-xs border-chart-2 text-chart-2">
            Enterprise
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Link href="/premium" className="flex items-center gap-2 p-2 rounded-md bg-primary/10 hover-elevate text-xs" data-testid="link-ai-readiness">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span>AI Readiness Dashboard</span>
          <Badge variant="outline" className="ml-auto text-xs">View</Badge>
        </Link>

        <Link href="/visualize" className="flex items-center gap-2 p-2 rounded-md bg-chart-1/10 hover-elevate text-xs" data-testid="link-visualize">
          <BarChart3 className="w-3.5 h-3.5 text-chart-1" />
          <span>Visualization Tool</span>
          <Badge variant="outline" className="ml-auto text-xs">New</Badge>
        </Link>

        <Link href="/policy" className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover-elevate text-xs" data-testid="link-policy-settings">
          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Policy Settings</span>
          <Badge variant="outline" className="ml-auto text-xs">Configure</Badge>
        </Link>

        <Link href="/demo" className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/10 hover-elevate text-xs" data-testid="link-demo">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          <span>Feature Demo</span>
          <Badge variant="outline" className="ml-auto text-xs border-emerald-500/50 text-emerald-500">Tour</Badge>
        </Link>

        <Link href="/agent-control" className="flex items-center gap-2 p-2 rounded-md bg-blue-500/10 hover-elevate text-xs" data-testid="link-agent-control">
          <Bot className="w-3.5 h-3.5 text-blue-500" />
          <span>Agent Control</span>
          <Badge variant="outline" className="ml-auto text-xs border-blue-500/50 text-blue-500">Stats</Badge>
        </Link>
        
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Workspace</label>
          <div className="flex gap-2">
            <Select
              value={selectedWorkspaceId || ""}
              onValueChange={(val) => onWorkspaceSelect?.(val || null)}
            >
              <SelectTrigger className="flex-1" data-testid="select-workspace">
                <SelectValue placeholder="Select workspace..." />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id} data-testid={`workspace-option-${ws.id}`}>
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-3 h-3" />
                      {ws.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setShowCreateDialog(true)}
              data-testid="button-create-workspace"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            onClick={() => createDemoWorkspaceMutation.mutate()}
            disabled={createDemoWorkspaceMutation.isPending}
            data-testid="button-create-demo-workspace"
          >
            {createDemoWorkspaceMutation.isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 mr-1" />
            )}
            Try Demo with Policy Citations
          </Button>
        </div>

        {selectedWorkspaceId && (
          <Tabs defaultValue="reports" className="mt-3">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="reports" data-testid="tab-reports">
                <Calendar className="w-3 h-3 mr-1" />
                Reports
              </TabsTrigger>
              <TabsTrigger value="export" data-testid="tab-export">
                <Download className="w-3 h-3 mr-1" />
                Export
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reports" className="space-y-3 mt-3">
              <div className="flex gap-2">
                <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                  <SelectTrigger className="flex-1 text-xs" data-testid="select-report-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly_summary">Weekly Summary</SelectItem>
                    <SelectItem value="monthly_gaps">Monthly Gaps</SelectItem>
                    <SelectItem value="obligations_report">Obligations</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
                  <SelectTrigger className="w-24 text-xs" data-testid="select-schedule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={createReportMutation.isPending}
                  onClick={() => createReportMutation.mutate({
                    workspaceId: selectedWorkspaceId,
                    type: selectedReportType,
                    schedule: selectedSchedule,
                  })}
                  data-testid="button-schedule-report"
                >
                  {createReportMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Schedule"}
                </Button>
              </div>

              {reports.length > 0 && (
                <div className="space-y-2">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs"
                      data-testid={`report-item-${report.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <FileStack className="w-3 h-3 text-muted-foreground" />
                        <span>{formatReportType(report.type)}</span>
                        <Badge variant="outline" className="text-xs">
                          {report.schedule}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={runReportMutation.isPending}
                        onClick={() => runReportMutation.mutate(report.id)}
                        data-testid={`button-run-report-${report.id}`}
                      >
                        {runReportMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {reports.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No scheduled reports yet
                </p>
              )}
            </TabsContent>

            <TabsContent value="export" className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground">
                Export Q&A training pairs from this workspace for AI model fine-tuning.
              </p>
              <Button
                className="w-full"
                variant="outline"
                size="sm"
                disabled={exportTrainingMutation.isPending}
                onClick={() => exportTrainingMutation.mutate(selectedWorkspaceId)}
                data-testid="button-export-training"
              >
                {exportTrainingMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export Training Data (JSON)
              </Button>

              {exportTrainingMutation.isError && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="w-3 h-3" />
                  Export failed. Make sure the workspace has documents.
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {!selectedWorkspaceId && workspaces.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Create a workspace to organize your documents
          </p>
        )}
      </CardContent>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Create Workspace
            </DialogTitle>
            <DialogDescription>
              Workspaces help you organize documents and enable multi-file reasoning.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Workspace name..."
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              data-testid="input-workspace-name"
            />
            <Button
              className="w-full"
              disabled={!newWorkspaceName.trim() || createWorkspaceMutation.isPending}
              onClick={() => createWorkspaceMutation.mutate(newWorkspaceName.trim())}
              data-testid="button-confirm-create-workspace"
            >
              {createWorkspaceMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Workspace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
