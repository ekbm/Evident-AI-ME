import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  Search,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

interface Job {
  id: string;
  type: string;
  status: string;
  priority: number;
  payload: Record<string, any>;
  result: Record<string, any> | null;
  errorMessage: string | null;
  errorCount: number;
  maxRetries: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  userEmail: string | null;
}

interface StuckAsset {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  userId: string;
  userEmail: string | null;
  hasActiveJob: boolean;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  stuck: number;
  total: number;
  byType: Record<string, number>;
}

const statusConfig = {
  PENDING: { label: "Pending", variant: "default" as const, icon: Clock },
  PROCESSING: { label: "Processing", variant: "secondary" as const, icon: Loader2 },
  COMPLETED: { label: "Completed", variant: "outline" as const, icon: CheckCircle },
  FAILED: { label: "Failed", variant: "destructive" as const, icon: XCircle },
};

export default function AdminQueueManagementPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [forceDelete, setForceDelete] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<QueueStats>({
    queryKey: ["/api/admin/queue/stats"],
    refetchInterval: 10000,
  });

  const { data: jobs = [], isLoading: jobsLoading, error } = useQuery<Job[]>({
    queryKey: ["/api/admin/queue/jobs", statusFilter, typeFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/queue/jobs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: stuckAssets = [] } = useQuery<StuckAsset[]>({
    queryKey: ["/api/admin/queue/stuck-assets"],
    refetchInterval: 30000,
  });

  const invalidateAdminQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/queue/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/queue/jobs", statusFilter, typeFilter, searchQuery] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/queue/stuck-assets"] });
  };

  const retryJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest("POST", `/api/admin/queue/jobs/${jobId}/retry`);
    },
    onSuccess: () => {
      invalidateAdminQueries();
      toast({ title: "Job queued for retry" });
    },
    onError: () => {
      toast({ title: "Failed to retry job", variant: "destructive" });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async ({ jobId, force }: { jobId: string; force: boolean }) => {
      return apiRequest("DELETE", `/api/admin/queue/jobs/${jobId}?force=${force}`);
    },
    onSuccess: () => {
      invalidateAdminQueries();
      toast({ title: "Job deleted" });
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    },
    onError: () => {
      toast({ title: "Failed to delete job", variant: "destructive" });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      return apiRequest("DELETE", `/api/admin/assets/${assetId}`);
    },
    onSuccess: () => {
      invalidateAdminQueries();
      toast({ title: "Asset deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete asset", variant: "destructive" });
    },
  });

  const retryStuckMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/queue/retry-stuck");
    },
    onSuccess: (data: any) => {
      invalidateAdminQueries();
      toast({ title: `Retrying ${data.retriedCount} stuck jobs` });
    },
    onError: () => {
      toast({ title: "Failed to retry stuck jobs", variant: "destructive" });
    },
  });

  const handleDeleteClick = (job: Job, force: boolean) => {
    setJobToDelete(job);
    setForceDelete(force);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (jobToDelete) {
      deleteJobMutation.mutate({ jobId: jobToDelete.id, force: forceDelete });
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">
              You don't have permission to access this page.
            </p>
            <Link href="/">
              <Button data-testid="button-go-home">Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 self-start">
              <Link href="/admin">
                <Button variant="ghost" size="sm" data-testid="button-admin">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Admin Panel
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" size="sm" data-testid="button-workspace">
                  Workspace
                </Button>
              </Link>
            </div>
            <div className="flex-1">
              <h1 className="text-lg sm:text-xl font-semibold">Queue Management</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Monitor and manage document processing jobs
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => retryStuckMutation.mutate()}
              disabled={retryStuckMutation.isPending}
              data-testid="button-retry-all-stuck"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${retryStuckMutation.isPending ? "animate-spin" : ""}`} />
              Retry All Stuck
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold" data-testid="text-total-jobs">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Jobs</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600" data-testid="text-pending-jobs">{stats.pending}</div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-600" data-testid="text-processing-jobs">{stats.processing}</div>
                <div className="text-sm text-muted-foreground">Processing</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600" data-testid="text-completed-jobs">{stats.completed}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600" data-testid="text-failed-jobs">{stats.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-orange-600" data-testid="text-stuck-jobs">{stats.stuck}</div>
                <div className="text-sm text-muted-foreground">Stuck</div>
              </CardContent>
            </Card>
          </div>
        )}

        {stuckAssets.length > 0 && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="h-5 w-5" />
                Stuck Assets ({stuckAssets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                These assets have been in "processing" state for over 15 minutes without an active job.
              </p>
              <div className="space-y-2">
                {stuckAssets.slice(0, 5).map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between p-3 bg-card rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{asset.fileName}</div>
                        <div className="text-xs text-muted-foreground">
                          {asset.userEmail || asset.userId} • {format(new Date(asset.createdAt), "MMM d, h:mm a")}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteAssetMutation.mutate(asset.id)}
                      disabled={deleteAssetMutation.isPending}
                      data-testid={`button-delete-asset-${asset.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <CardTitle className="flex-1">Jobs</CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-40"
                    data-testid="input-search-jobs"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PROCESSING">Processing</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40" data-testid="select-type-filter">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="document_processing">Document Processing</SelectItem>
                    <SelectItem value="embedding_generation">Embedding Generation</SelectItem>
                    <SelectItem value="transcription">Transcription</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No jobs found
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const config = statusConfig[job.status as keyof typeof statusConfig] || statusConfig.PENDING;
                  const StatusIcon = config.icon;
                  return (
                    <div
                      key={job.id}
                      className="p-4 border rounded-lg bg-card"
                      data-testid={`job-item-${job.id}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={config.variant}>
                              <StatusIcon className={`h-3 w-3 mr-1 ${job.status === "PROCESSING" ? "animate-spin" : ""}`} />
                              {config.label}
                            </Badge>
                            <Badge variant="outline">{job.type}</Badge>
                            {job.errorCount > 0 && (
                              <Badge variant="destructive">Retries: {job.errorCount}/{job.maxRetries}</Badge>
                            )}
                          </div>
                          {job.payload?.filePath && (
                            <div className="text-sm font-medium mb-1 flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-xs" title={job.payload.filePath.split('/').pop()}>
                                {job.payload.filePath.split('/').pop()}
                              </span>
                            </div>
                          )}
                          <div className="text-sm">
                            <span className="text-muted-foreground">ID: </span>
                            <span className="font-mono text-xs">{job.id.slice(0, 8)}...</span>
                            {job.userEmail && (
                              <>
                                <span className="text-muted-foreground"> • User: </span>
                                {job.userEmail}
                              </>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Created: {format(new Date(job.createdAt), "MMM d, h:mm a")}
                            {job.startedAt && ` • Started: ${format(new Date(job.startedAt), "h:mm a")}`}
                            {job.completedAt && ` • Completed: ${format(new Date(job.completedAt), "h:mm a")}`}
                          </div>
                          {job.errorMessage && (
                            <div className="text-xs text-red-600 mt-1 truncate max-w-md">
                              Error: {job.errorMessage}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {job.status === "FAILED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryJobMutation.mutate(job.id)}
                              disabled={retryJobMutation.isPending}
                              data-testid={`button-retry-${job.id}`}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Retry
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(job, false)}
                            data-testid={`button-delete-${job.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {job.payload?.assetId && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteClick(job, true)}
                              data-testid={`button-force-delete-${job.id}`}
                            >
                              Force Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {forceDelete ? "Force Delete Job?" : "Delete Job?"}
            </DialogTitle>
            <DialogDescription>
              {forceDelete
                ? "This will delete the job AND the associated document/asset. This cannot be undone."
                : "This will remove the job from the queue. The associated document will not be affected."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteJobMutation.isPending}
            >
              {deleteJobMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {forceDelete ? "Force Delete" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
