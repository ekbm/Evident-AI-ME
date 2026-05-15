import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  HeartPulse,
  FileText,
  Loader2,
  RefreshCw,
  Scan,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Shield,
  Zap,
  Server,
  Activity,
  Microscope,
  Check,
  Pencil,
  UserPlus,
  Calendar,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Type,
  Upload,
  Wrench,
  Building2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
  scoreBefore?: number;
  scoreAfter?: number;
  scoreDelta?: number;
  error?: string;
}

interface DeepScanPythonAnalysis {
  used: boolean;
  tableCount: number;
  ocrConfidence: number | null;
  pageCount: number;
  totalCharsExtracted: number;
  serviceHealthy: boolean;
  enhancedSignals: {
    tableQuality: number;
    ocrQuality: number;
    structureDepth: number;
  };
}

interface PythonServiceStatus {
  configured: boolean;
  healthy: boolean;
  serviceUrl: string;
  apiKey: string;
  processingMode: string;
}

interface SummaryDocument {
  assetId: string;
  filename: string;
  displayName: string;
  score: number | null;
  status: "READY" | "NEEDS_PREP" | "MANUAL" | "NOT_SCANNED";
  issueCount: number;
  highIssueCount: number;
  topIssue: string | null;
  subscores: { extractability: number; structure: number; quality: number; metadata: number } | null;
  scannedAt: string | null;
  hasMetadata: boolean;
}

interface SummaryData {
  totalDocuments: number;
  scannedCount: number;
  notScannedCount: number;
  readyCount: number;
  needsPrepCount: number;
  manualCount: number;
  averageScore: number;
  documentsWithMetadata: number;
  aiPreparedPercent: number;
  documents: SummaryDocument[];
}

interface KnowledgeHealthTabProps {
  assets: Asset[];
}

type SortField = "score" | "status" | "issues" | "name";
type SortDir = "asc" | "desc";
type FilterTab = "all" | "needs_attention" | "ready" | "not_scanned";

function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help inline-block ml-1" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

function ScoreGauge({ score, size = "large" }: { score: number; size?: "large" | "small" }) {
  const getColor = (s: number) => {
    if (s >= 70) return "text-green-600 dark:text-green-400";
    if (s >= 40) return "text-amber-600 dark:text-amber-400";
    return "text-red-500 dark:text-red-400";
  };

  const r = size === "large" ? 56 : 28;
  const dim = size === "large" ? 128 : 64;
  const c = dim / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className={`flex items-center justify-center ${size === "large" ? "w-32 h-32" : "w-16 h-16"}`}>
      <div className="relative">
        <svg className={`${size === "large" ? "w-32 h-32" : "w-16 h-16"} transform -rotate-90`}>
          <circle cx={c} cy={c} r={r} stroke="currentColor" strokeWidth={size === "large" ? 8 : 4} fill="transparent" className="text-muted/30" />
          <circle cx={c} cy={c} r={r} stroke="currentColor" strokeWidth={size === "large" ? 8 : 4} fill="transparent"
            strokeDasharray={circumference} strokeDashoffset={circumference - (circumference * score) / 100}
            className={getColor(score)} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${size === "large" ? "text-2xl" : "text-sm"} font-bold ${getColor(score)}`}>
            {Math.round(score)}%
          </span>
        </div>
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

function getStatusBadge(status: string) {
  switch (status) {
    case "READY":
      return <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" data-testid="badge-status-ready">Ready</Badge>;
    case "NEEDS_PREP":
      return <Badge variant="default" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" data-testid="badge-status-needs-prep">Needs Prep</Badge>;
    case "MANUAL":
      return <Badge variant="default" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" data-testid="badge-status-manual">Manual Review</Badge>;
    default:
      return <Badge variant="secondary" data-testid="badge-status-unknown">Not Scanned</Badge>;
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "READY":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "NEEDS_PREP":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "MANUAL":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusDot(status: string) {
  switch (status) {
    case "READY":
      return <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />;
    case "NEEDS_PREP":
      return <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />;
    case "MANUAL":
      return <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />;
    default:
      return <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 shrink-0" />;
  }
}

function getSeverityIcon(highCount: number, totalCount: number) {
  if (highCount > 0) return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
  if (totalCount > 0) return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  return null;
}

const STATUS_SORT_ORDER: Record<string, number> = { MANUAL: 0, NEEDS_PREP: 1, NOT_SCANNED: 2, READY: 3 };

export default function KnowledgeHealthTab({ assets }: KnowledgeHealthTabProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [scanAllProgress, setScanAllProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastDeepScanResult, setLastDeepScanResult] = useState<DeepScanPythonAnalysis | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkDate, setBulkDate] = useState("");
  const [bulkAuthor, setBulkAuthor] = useState("");
  const [bulkOwnerMode, setBulkOwnerMode] = useState<"none" | "me" | "system" | "custom">("none");
  const [bulkOwnerEmail, setBulkOwnerEmail] = useState("");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [serviceOpen, setServiceOpen] = useState(false);
  const [prepAllProgress, setPrepAllProgress] = useState<{ current: number; total: number } | null>(null);
  const [listHeight, setListHeight] = useState(320);
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null);

  const onResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const startY = "touches" in e ? e.touches[0].clientY : e.clientY;
    resizeRef.current = { startY, startH: listHeight };
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!resizeRef.current) return;
      const clientY = "touches" in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      const delta = clientY - resizeRef.current.startY;
      setListHeight(Math.max(160, Math.min(800, resizeRef.current.startH + delta)));
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove);
    document.addEventListener("touchend", onUp);
  }, [listHeight]);

  const bulkMetaMutation = useMutation({
    mutationFn: async (data: { assetIds: string[]; sourceDate?: string; sourceAuthor?: string; assignOwnerMode?: string; assignOwnerEmail?: string }) => {
      const res = await apiRequest("PATCH", "/api/assets/bulk-metadata", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Metadata Updated", description: data.message || `Updated ${data.updated} documents` });
      qc.invalidateQueries({ queryKey: ["/api/readiness/summary"] });
      qc.invalidateQueries({ queryKey: ["/api/assets"] });
      setBulkDate("");
      setBulkAuthor("");
      setBulkOwnerMode("none");
      setBulkOwnerEmail("");
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Bulk Update Failed", description: err?.message || "Could not apply metadata to all selected documents." });
    },
  });

  const { data: summaryData, isLoading: summaryLoading, isFetching: summaryFetching, refetch: refetchSummary } = useQuery<SummaryData>({
    queryKey: ["/api/readiness/summary"],
    placeholderData: keepPreviousData,
    staleTime: 10000,
  });

  const { data: pythonStatus, isLoading: pythonStatusLoading, isFetching: pythonFetching, refetch: refetchPythonStatus } = useQuery<PythonServiceStatus>({
    queryKey: ["/api/admin/python-service/status"],
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
    staleTime: 15000,
  });

  useEffect(() => {
    setLastDeepScanResult(null);
  }, [selectedAssetId]);

  const { data: scanResult, isLoading: scanLoading, refetch: refetchScan } = useQuery<ReadinessScan>({
    queryKey: ["/api/readiness", selectedAssetId],
    enabled: !!selectedAssetId,
  });

  const { data: jobStatus } = useQuery<PrepJobStatus>({
    queryKey: ["/api/prep/status", activeJobId],
    enabled: !!activeJobId,
    refetchInterval: activeJobId ? 2000 : false,
  });

  useEffect(() => {
    if (jobStatus?.status === "DONE" || jobStatus?.status === "FAILED") {
      const completedAssetId = jobStatus?.assetId || selectedAssetId;
      setActiveJobId(null);
      if (completedAssetId) {
        qc.invalidateQueries({ queryKey: ["/api/readiness", completedAssetId] });
      }
      if (selectedAssetId && selectedAssetId !== completedAssetId) {
        qc.invalidateQueries({ queryKey: ["/api/readiness", selectedAssetId] });
      }
      qc.invalidateQueries({ queryKey: ["/api/readiness/summary"] });
      setTimeout(() => {
        refetchScan();
        refetchSummary();
      }, 500);
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

  const scanMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiRequest("POST", "/api/readiness/scan", { assetId });
      return response.json() as Promise<ReadinessScan>;
    },
    onSuccess: (data) => {
      qc.setQueryData(["/api/readiness", data.assetId], data);
      refetchSummary();
      toast({ title: "Scan Complete", description: `AI-Readiness score: ${data.score}` });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Scan Failed", description: error.message });
    },
  });

  const deepScanMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiRequest("POST", "/api/readiness/deep-scan", { assetId });
      return response.json() as Promise<ReadinessScan & { pythonAnalysis: DeepScanPythonAnalysis }>;
    },
    onSuccess: (data) => {
      qc.setQueryData(["/api/readiness", data.assetId], data);
      setLastDeepScanResult(data.pythonAnalysis);
      refetchSummary();
      toast({ title: "Deep Scan Complete", description: `Insight-enhanced score: ${data.score}` });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Deep Scan Failed", description: error.message });
    },
  });

  const [metadataEditing, setMetadataEditing] = useState<Record<string, string>>({});
  const [metadataSaving, setMetadataSaving] = useState<string | null>(null);

  const saveMetadata = useCallback(async (assetId: string, field: "sourceAuthor" | "sourceDate", value: string) => {
    if (!value.trim()) return;
    setMetadataSaving(field);
    try {
      await apiRequest("PATCH", `/api/assets/${assetId}/metadata`, { [field]: value.trim() });
      toast({ title: "Metadata Updated", description: field === "sourceAuthor" ? "Author saved." : "Date saved." });
      setMetadataEditing(prev => { const next = { ...prev }; delete next[field]; return next; });
      if (selectedAssetId) {
        qc.invalidateQueries({ queryKey: ["/api/readiness", selectedAssetId] });
      }
      refetchSummary();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save Failed", description: err.message });
    }
    setMetadataSaving(null);
  }, [selectedAssetId, toast, qc, refetchSummary]);

  const assignOwner = useCallback(async (assetId: string, ownerType: string, ownerId: string, ownerDisplayName: string) => {
    setMetadataSaving("owner");
    try {
      await apiRequest("POST", `/api/documents/${assetId}/assign-owner`, {
        ownerId,
        ownerType,
        ownerDisplayName,
      });
      const label = ownerType === "SYSTEM" ? "System Account" : (ownerId === "SELF" ? "you" : ownerDisplayName);
      toast({ title: "Owner Assigned", description: `Document owner set to ${label}.` });
      if (selectedAssetId) {
        qc.invalidateQueries({ queryKey: ["/api/readiness", selectedAssetId] });
      }
      refetchSummary();
      setMetadataEditing(prev => ({ ...prev, ownerEmail: "" }));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Assignment Failed", description: err.message });
    }
    setMetadataSaving(null);
  }, [selectedAssetId, toast, qc, refetchSummary]);

  const saveTitle = useCallback(async (assetId: string, title: string) => {
    if (!title.trim()) return;
    setMetadataSaving("title");
    try {
      await apiRequest("PATCH", `/api/assets/${assetId}/rename`, { displayName: title.trim() });
      toast({ title: "Heading Added", description: "Document title saved. Re-scan to see the score improve." });
      setMetadataEditing(prev => { const next = { ...prev }; delete next["title"]; return next; });
      if (selectedAssetId) {
        qc.invalidateQueries({ queryKey: ["/api/readiness", selectedAssetId] });
      }
      refetchSummary();
      qc.invalidateQueries({ queryKey: ["/api/assets"] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save Failed", description: err.message });
    }
    setMetadataSaving(null);
  }, [selectedAssetId, toast, qc, refetchSummary]);

  const prepMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiRequest("POST", "/api/prep/start", { assetId });
      return response.json() as Promise<{ jobId: string; status: string }>;
    },
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      toast({ title: "Preparation Started", description: "Improving document AI-readiness..." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to Start", description: error.message });
    },
  });

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allDocIds = useMemo(() => summaryData?.documents.map(d => d.assetId) || [], [summaryData]);

  const toggleAll = useCallback(() => {
    if (checkedIds.size === allDocIds.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(allDocIds));
    }
  }, [checkedIds.size, allDocIds]);

  const handleBatchScan = useCallback(async (deep: boolean) => {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) return;
    setScanAllProgress({ current: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      try {
        const endpoint = deep ? "/api/readiness/deep-scan" : "/api/readiness/scan";
        await apiRequest("POST", endpoint, { assetId: ids[i] });
      } catch {}
      setScanAllProgress({ current: i + 1, total: ids.length });
    }
    setScanAllProgress(null);
    setCheckedIds(new Set());
    refetchSummary();
    ids.forEach(id => qc.invalidateQueries({ queryKey: ["/api/readiness", id] }));
    toast({ title: "Batch Scan Complete", description: `${deep ? "Deep scanned" : "Scanned"} ${ids.length} document${ids.length > 1 ? "s" : ""}.` });
  }, [checkedIds, refetchSummary, toast, qc]);

  const handleBatchPrepare = useCallback(async () => {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) return;
    setPrepAllProgress({ current: 0, total: ids.length });
    let succeeded = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      try {
        await apiRequest("POST", "/api/prep/start", { assetId: ids[i] });
        succeeded++;
      } catch {
        failed++;
      }
      setPrepAllProgress({ current: i + 1, total: ids.length });
    }
    setPrepAllProgress(null);
    setCheckedIds(new Set());
    refetchSummary();
    ids.forEach(id => qc.invalidateQueries({ queryKey: ["/api/readiness", id] }));
    const desc = failed > 0
      ? `Queued ${succeeded} document${succeeded !== 1 ? "s" : ""} for preparation. ${failed} failed.`
      : `Queued ${ids.length} document${ids.length !== 1 ? "s" : ""} for AI preparation.`;
    toast({ title: "Batch Prepare Started", description: desc });
  }, [checkedIds, refetchSummary, toast, qc]);

  const handleScanNotScanned = useCallback(async () => {
    const notScannedIds = (summaryData?.documents || []).filter(d => d.status === "NOT_SCANNED").map(d => d.assetId);
    if (notScannedIds.length === 0) return;
    setScanAllProgress({ current: 0, total: notScannedIds.length });
    for (let i = 0; i < notScannedIds.length; i++) {
      try {
        await apiRequest("POST", "/api/readiness/scan", { assetId: notScannedIds[i] });
      } catch {}
      setScanAllProgress({ current: i + 1, total: notScannedIds.length });
    }
    setScanAllProgress(null);
    refetchSummary();
    toast({ title: "Scan Complete", description: `Scanned ${notScannedIds.length} document${notScannedIds.length > 1 ? "s" : ""}.` });
  }, [summaryData, refetchSummary, toast]);

  const isPrepRunning = activeJobId && jobStatus && (jobStatus.status === "QUEUED" || jobStatus.status === "RUNNING");

  const filteredDocs = useMemo(() => {
    if (!summaryData?.documents) return [];
    let docs = [...summaryData.documents];
    switch (filterTab) {
      case "needs_attention":
        docs = docs.filter(d => d.status === "NEEDS_PREP" || d.status === "MANUAL");
        break;
      case "ready":
        docs = docs.filter(d => d.status === "READY");
        break;
      case "not_scanned":
        docs = docs.filter(d => d.status === "NOT_SCANNED");
        break;
    }
    docs.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "score":
          cmp = (a.score ?? -1) - (b.score ?? -1);
          break;
        case "status":
          cmp = (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99);
          break;
        case "issues":
          cmp = a.issueCount - b.issueCount;
          break;
        case "name":
          cmp = (a.displayName || a.filename).localeCompare(b.displayName || b.filename);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return docs;
  }, [summaryData?.documents, filterTab, sortField, sortDir]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "asc");
    }
  }, [sortField]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const statusBreakdown = useMemo(() => {
    if (!summaryData || summaryData.scannedCount === 0) return null;
    const total = summaryData.scannedCount;
    return {
      readyPct: (summaryData.readyCount / total) * 100,
      needsPrepPct: (summaryData.needsPrepCount / total) * 100,
      manualPct: (summaryData.manualCount / total) * 100,
    };
  }, [summaryData]);

  return (
    <TooltipProvider>
      <div className="space-y-6" data-testid="knowledge-health-tab">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <HeartPulse className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold" data-testid="text-health-title">Knowledge Health</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">AI document scanning, readiness scores, and preparation engine</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {summaryFetching && summaryData && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
            <Badge variant="outline" className="border-primary/30 text-primary text-xs gap-1">
              <Shield className="w-3 h-3" />
              Admin Only
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex gap-3 items-start" data-testid="health-intro-message">
          <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Preparing your knowledge for AI</p>
            <p className="text-xs text-muted-foreground mt-1">Knowledge Health continuously evaluates your documents to ensure they are structured, readable, and suitable for AI systems. This helps improve the accuracy and reliability of AI-generated insights.</p>
          </div>
        </div>

        {summaryLoading && !summaryData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Total Documents</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-total-docs">{summaryData?.totalDocuments ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">AI-Ready</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-ready-count">{summaryData?.readyCount ?? 0}</p>
                    {summaryData && summaryData.totalDocuments > 0 && (
                      <span className="text-xs text-muted-foreground">{summaryData.aiPreparedPercent}%</span>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-muted-foreground">Needs Improvement</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-needs-improvement-count">
                    {(summaryData?.needsPrepCount ?? 0) + (summaryData?.manualCount ?? 0)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Scan className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Not Scanned</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-2xl font-bold" data-testid="text-not-scanned-count">{summaryData?.notScannedCount ?? 0}</p>
                    {(summaryData?.notScannedCount ?? 0) > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleScanNotScanned}
                        disabled={!!scanAllProgress}
                        className="gap-1.5 shrink-0"
                        data-testid="button-scan-all-not-scanned"
                      >
                        {scanAllProgress ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />{scanAllProgress.current}/{scanAllProgress.total}</>
                        ) : (
                          <><Scan className="w-3 h-3" />Scan All</>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Collapsible>
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <CardContent className="p-4">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 w-full text-left mb-3" data-testid="button-toggle-dept-readiness">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium flex-1">Department Readiness</span>
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0 gap-1">
                        <Zap className="w-2.5 h-2.5" />Demo
                      </Badge>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2">
                      {[
                        { dept: "Sales", docs: 14, ready: 86, color: "bg-emerald-500" },
                        { dept: "Legal", docs: 22, ready: 72, color: "bg-purple-500" },
                        { dept: "HR", docs: 8, ready: 100, color: "bg-green-500" },
                        { dept: "Finance", docs: 18, ready: 61, color: "bg-orange-500" },
                        { dept: "Engineering", docs: 11, ready: 91, color: "bg-cyan-500" },
                        { dept: "Procurement", docs: 9, ready: 78, color: "bg-blue-500" },
                        { dept: "Marketing", docs: 6, ready: 83, color: "bg-pink-500" },
                        { dept: "Compliance", docs: 15, ready: 53, color: "bg-red-500" },
                        { dept: "Executive", docs: 4, ready: 100, color: "bg-amber-500" },
                      ].map(d => (
                        <div key={d.dept} className="flex items-center gap-3 py-1.5 px-1" data-testid={`dept-row-${d.dept.toLowerCase()}`}>
                          <div className={`w-2 h-2 rounded-full shrink-0 ${d.color}`} />
                          <span className="text-xs font-medium w-24 truncate">{d.dept}</span>
                          <span className="text-[10px] text-muted-foreground w-12 text-right">{d.docs} docs</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${d.ready >= 80 ? "bg-green-500" : d.ready >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${d.ready}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold w-10 text-right ${d.ready >= 80 ? "text-green-600 dark:text-green-400" : d.ready >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                            {d.ready}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-3 text-center">
                      Department readiness breakdown based on ingested document health scores. Available with enterprise connectors.
                    </p>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>

            {summaryData && summaryData.scannedCount > 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <ScoreGauge score={summaryData.averageScore} />
                    <div className="flex-1 space-y-3 w-full">
                      <div>
                        <p className="text-sm font-medium" data-testid="text-avg-score-label">Average Readiness Score</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Across {summaryData.scannedCount} scanned document{summaryData.scannedCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {statusBreakdown && (
                        <div className="space-y-1.5">
                          <div className="flex h-3 rounded-full overflow-hidden">
                            {statusBreakdown.readyPct > 0 && (
                              <div className="bg-green-500" style={{ width: `${statusBreakdown.readyPct}%` }} />
                            )}
                            {statusBreakdown.needsPrepPct > 0 && (
                              <div className="bg-amber-500" style={{ width: `${statusBreakdown.needsPrepPct}%` }} />
                            )}
                            {statusBreakdown.manualPct > 0 && (
                              <div className="bg-red-500" style={{ width: `${statusBreakdown.manualPct}%` }} />
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />AI-Ready ({summaryData.readyCount})</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Needs Prep ({summaryData.needsPrepCount})</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Manual ({summaryData.manualCount})</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm sm:text-base flex flex-wrap items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                    Document Insights
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {allDocIds.length > 0 && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                        <Checkbox
                          checked={checkedIds.size === allDocIds.length && allDocIds.length > 0}
                          onCheckedChange={toggleAll}
                          data-testid="checkbox-select-all"
                        />
                        {checkedIds.size === allDocIds.length ? "Deselect all" : "Select all"}
                      </label>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  {(["all", "needs_attention", "ready", "not_scanned"] as FilterTab[]).map(tab => {
                    const labels: Record<FilterTab, string> = {
                      all: "All",
                      needs_attention: "Needs Attention",
                      ready: "AI-Ready",
                      not_scanned: "Not Scanned",
                    };
                    const counts: Record<FilterTab, number> = {
                      all: summaryData?.totalDocuments ?? 0,
                      needs_attention: (summaryData?.needsPrepCount ?? 0) + (summaryData?.manualCount ?? 0),
                      ready: summaryData?.readyCount ?? 0,
                      not_scanned: summaryData?.notScannedCount ?? 0,
                    };
                    return (
                      <Button
                        key={tab}
                        size="sm"
                        variant={filterTab === tab ? "default" : "outline"}
                        className="gap-1.5"
                        onClick={() => setFilterTab(tab)}
                        data-testid={`button-filter-${tab}`}
                      >
                        {labels[tab]} ({counts[tab]})
                      </Button>
                    );
                  })}
                </div>
              </CardHeader>
              <CardContent>
                {checkedIds.size > 0 && (
                  <div className="mb-4 p-3 rounded-lg border bg-muted/30 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Zap className="h-4 w-4 text-primary" />
                      Bulk Actions ({checkedIds.size} selected)
                    </div>
                    {scanAllProgress ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Scanning {scanAllProgress.current}/{scanAllProgress.total}...
                      </div>
                    ) : prepAllProgress ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Preparing {prepAllProgress.current}/{prepAllProgress.total}...
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleBatchScan(false)} disabled={!!scanAllProgress} data-testid="button-scan-selected">
                            <Scan className="w-3.5 h-3.5" />Scan ({checkedIds.size})
                          </Button>
                          {pythonStatus?.healthy && (
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleBatchScan(true)} disabled={!!scanAllProgress} data-testid="button-deep-scan-selected">
                              <Microscope className="w-3.5 h-3.5" />Deep ({checkedIds.size})
                            </Button>
                          )}
                          <Button size="sm" variant="default" className="gap-1.5" onClick={handleBatchPrepare} disabled={!!prepAllProgress || !!scanAllProgress} data-testid="button-prepare-selected">
                            <Sparkles className="w-3.5 h-3.5" />Prepare ({checkedIds.size})
                          </Button>
                        </div>
                        <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Tag className="h-3.5 w-3.5 text-primary" />
                            <p className="text-xs font-medium">Quick Fill Metadata ({checkedIds.size} selected)</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-0.5 block">Date</label>
                              <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} className="h-7 text-xs" data-testid="input-bulk-date" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-0.5 block">Author</label>
                              <Input type="text" placeholder="e.g. System" value={bulkAuthor} onChange={(e) => setBulkAuthor(e.target.value)} className="h-7 text-xs" data-testid="input-bulk-author" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-muted-foreground block">Assign owner</label>
                            <div className="flex flex-wrap gap-1.5">
                              {([
                                { value: "none" as const, label: "Skip" },
                                { value: "me" as const, label: "Me" },
                                { value: "system" as const, label: "System" },
                                { value: "custom" as const, label: "Email..." },
                              ]).map(opt => (
                                <Button
                                  key={opt.value}
                                  type="button"
                                  size="sm"
                                  variant={bulkOwnerMode === opt.value ? "default" : "outline"}
                                  onClick={() => setBulkOwnerMode(opt.value)}
                                  data-testid={`button-owner-mode-${opt.value}`}
                                >
                                  {opt.label}
                                </Button>
                              ))}
                            </div>
                            {bulkOwnerMode === "custom" && (
                              <Input type="email" placeholder="owner@company.com" value={bulkOwnerEmail} onChange={(e) => setBulkOwnerEmail(e.target.value)} className="h-7 text-xs mt-1" data-testid="input-bulk-owner-email" />
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="w-full gap-1.5"
                            disabled={(!bulkDate && !bulkAuthor && bulkOwnerMode === "none") || (bulkOwnerMode === "custom" && !bulkOwnerEmail.trim()) || bulkMetaMutation.isPending}
                            onClick={() => {
                              bulkMetaMutation.mutate({
                                assetIds: Array.from(checkedIds),
                                sourceDate: bulkDate || undefined,
                                sourceAuthor: bulkAuthor || undefined,
                                assignOwnerMode: bulkOwnerMode !== "none" ? bulkOwnerMode : undefined,
                                assignOwnerEmail: bulkOwnerMode === "custom" ? bulkOwnerEmail.trim() : undefined,
                              });
                            }}
                            data-testid="button-bulk-apply-metadata"
                          >
                            {bulkMetaMutation.isPending ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Applying...</>
                            ) : (
                              <><Check className="h-3 w-3" /> Apply to {checkedIds.size} document{checkedIds.size !== 1 ? "s" : ""}</>
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="overflow-auto rounded-md border" style={{ maxHeight: `${listHeight}px` }}>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background z-10">
                      <tr className="border-b text-left">
                        <th className="py-2 pr-2 w-8"></th>
                        <th className="py-2 pr-2 w-8"></th>
                        <th className="py-2 pr-3">
                          <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground" onClick={() => handleSort("name")} data-testid="button-sort-name">
                            Document <SortIcon field="name" />
                          </button>
                        </th>
                        <th className="py-2 pr-3 w-20">
                          <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground" onClick={() => handleSort("score")} data-testid="button-sort-score">
                            Score <SortIcon field="score" />
                          </button>
                        </th>
                        <th className="py-2 pr-3 w-20 hidden sm:table-cell">
                          <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground" onClick={() => handleSort("issues")} data-testid="button-sort-issues">
                            Issues <SortIcon field="issues" />
                          </button>
                        </th>
                        <th className="py-2 pr-3 hidden md:table-cell">
                          <span className="text-xs font-medium text-muted-foreground">Top Issue</span>
                        </th>
                        <th className="py-2 w-24 text-right">
                          <span className="text-xs font-medium text-muted-foreground">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">
                              {filterTab === "all" ? "No documents found" : `No documents matching "${filterTab.replace("_", " ")}"`}
                            </p>
                          </td>
                        </tr>
                      ) : filteredDocs.map((doc) => (
                        <tr
                          key={doc.assetId}
                          className={`border-b last:border-b-0 cursor-pointer transition-colors ${selectedAssetId === doc.assetId ? "bg-accent" : "hover-elevate"}`}
                          onClick={() => setSelectedAssetId(selectedAssetId === doc.assetId ? null : doc.assetId)}
                          data-testid={`row-document-${doc.assetId}`}
                        >
                          <td className="py-2.5 pr-2" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={checkedIds.has(doc.assetId)}
                              onCheckedChange={() => toggleChecked(doc.assetId)}
                              data-testid={`checkbox-asset-${doc.assetId}`}
                            />
                          </td>
                          <td className="py-2.5 pr-2">
                            {getStatusDot(doc.status)}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className={`text-sm truncate block max-w-[200px] lg:max-w-[300px] ${selectedAssetId === doc.assetId ? "text-accent-foreground" : ""}`}>{doc.displayName || doc.filename}</span>
                          </td>
                          <td className="py-2.5 pr-3">
                            {doc.score !== null ? (
                              <span className={`text-sm font-medium ${
                                doc.score >= 70 ? "text-green-600 dark:text-green-400" :
                                doc.score >= 40 ? "text-amber-600 dark:text-amber-400" :
                                "text-red-600 dark:text-red-400"
                              }`} data-testid={`text-score-${doc.assetId}`}>
                                {doc.score}
                              </span>
                            ) : (
                              <span className={`text-xs ${selectedAssetId === doc.assetId ? "text-accent-foreground/70" : "text-muted-foreground"}`}>--</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 hidden sm:table-cell">
                            {doc.issueCount > 0 ? (
                              <span className="flex items-center gap-1.5">
                                {getSeverityIcon(doc.highIssueCount, doc.issueCount)}
                                <span className={`text-xs ${selectedAssetId === doc.assetId ? "text-accent-foreground/80" : "text-muted-foreground"}`}>{doc.issueCount}</span>
                              </span>
                            ) : doc.status !== "NOT_SCANNED" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : null}
                          </td>
                          <td className="py-2.5 pr-3 hidden md:table-cell">
                            {doc.topIssue && (
                              <span className={`text-xs truncate block max-w-[200px] ${selectedAssetId === doc.assetId ? "text-accent-foreground/80" : "text-muted-foreground"}`}>{doc.topIssue}</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {doc.status === "NOT_SCANNED" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => scanMutation.mutate(doc.assetId)}
                                  disabled={scanMutation.isPending}
                                  data-testid={`button-scan-${doc.assetId}`}
                                >
                                  <Scan className="h-3 w-3" />Scan
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant={doc.status === "READY" ? "outline" : "default"}
                                  className="gap-1"
                                  onClick={() => prepMutation.mutate(doc.assetId)}
                                  disabled={prepMutation.isPending}
                                  data-testid={`button-prep-${doc.assetId}`}
                                >
                                  <Sparkles className="h-3 w-3" />{doc.status === "READY" ? "Re-Prep" : "Prep"}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div
                  className="flex items-center justify-center py-1 cursor-row-resize group select-none touch-none"
                  onMouseDown={onResizeStart}
                  onTouchStart={onResizeStart}
                  data-testid="resize-handle"
                >
                  <div className="w-12 h-1 rounded-full bg-border group-hover:bg-primary/40 transition-colors" />
                </div>
              </CardContent>
            </Card>

            {selectedAssetId && (
              <Card className="border-0 shadow-sm" data-testid="document-detail-panel">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm sm:text-base flex flex-wrap items-center gap-2">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      {summaryData?.documents.find(d => d.assetId === selectedAssetId)?.displayName || "Document Details"}
                    </CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedAssetId(null)} data-testid="button-close-detail">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {scanLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !scanResult ? (
                    <div className="text-center py-12">
                      <Scan className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium mb-1">Not scanned yet</p>
                      <p className="text-xs text-muted-foreground mb-4">Run a scan to check how well this document works with the AI. You'll see a health score and any issues to fix.</p>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          onClick={() => selectedAssetId && scanMutation.mutate(selectedAssetId)}
                          disabled={scanMutation.isPending || deepScanMutation.isPending}
                          data-testid="button-scan-document"
                        >
                          {scanMutation.isPending ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Scanning...</>
                          ) : (
                            <><Scan className="h-4 w-4 mr-2" />Quick Scan</>
                          )}
                        </Button>
                        {pythonStatus?.healthy && (
                          <Button
                            variant="outline"
                            onClick={() => selectedAssetId && deepScanMutation.mutate(selectedAssetId)}
                            disabled={deepScanMutation.isPending || scanMutation.isPending}
                            className="gap-1.5"
                            data-testid="button-deep-scan-document"
                          >
                            {deepScanMutation.isPending ? (
                              <><Loader2 className="h-4 w-4 animate-spin" />Deep Scanning...</>
                            ) : (
                              <><Microscope className="h-4 w-4" />Deep Scan (Insight)</>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(scanResult.status)}
                          {getStatusBadge(scanResult.status)}
                          <span className="text-sm text-muted-foreground">
                            Score: <strong>{scanResult.score}</strong>/100
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {scanResult.status === "READY"
                          ? "This document is well-structured for AI use. You can re-prep it to try squeezing out more quality."
                          : scanResult.status === "NEEDS_PREP"
                          ? "This document has issues that can be fixed automatically. Click \"Make AI-Ready\" to run the preparation pipeline and improve the score."
                          : "This document has significant issues that may need manual review. You can still try the prep pipeline, but results may be limited."}
                      </p>
                      <div className="flex items-center justify-end">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectedAssetId && scanMutation.mutate(selectedAssetId)}
                            disabled={scanMutation.isPending || deepScanMutation.isPending}
                            data-testid="button-rescan-document"
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            Quick
                          </Button>
                          {pythonStatus?.healthy && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => selectedAssetId && deepScanMutation.mutate(selectedAssetId)}
                              disabled={deepScanMutation.isPending || scanMutation.isPending}
                              className="gap-1"
                              data-testid="button-deep-rescan-document"
                            >
                              {deepScanMutation.isPending ? (
                                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Deep...</>
                              ) : (
                                <><Microscope className="h-3.5 w-3.5" />Deep</>
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={scanResult.status === "READY" ? "outline" : "default"}
                            onClick={() => selectedAssetId && prepMutation.mutate(selectedAssetId)}
                            disabled={prepMutation.isPending || !!isPrepRunning}
                            data-testid="button-prepare-document"
                          >
                            {prepMutation.isPending || isPrepRunning ? (
                              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Preparing...</>
                            ) : scanResult?.prepJob?.status === "DONE" ? (
                              <><Wrench className="h-3.5 w-3.5 mr-1.5" />Re-Prepare</>
                            ) : (
                              <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Make AI-Ready</>
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">Extractability</p>
                          <p className="text-lg font-bold">{Math.round(scanResult.subscores.extractability * 100)}%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">Structure</p>
                          <p className="text-lg font-bold">{Math.round(scanResult.subscores.structure * 100)}%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">Quality</p>
                          <p className="text-lg font-bold">{Math.round(scanResult.subscores.quality * 100)}%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">Metadata</p>
                          <p className="text-lg font-bold">{Math.round(scanResult.subscores.metadata * 100)}%</p>
                        </div>
                      </div>

                      {lastDeepScanResult?.used && (
                        <div className="p-3 rounded-lg border bg-primary/5 space-y-2" data-testid="deep-scan-results">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Microscope className="h-4 w-4 text-primary" />
                            Evident Insight Deep Scan
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            <div className="p-2 rounded bg-background">
                              <p className="text-muted-foreground">Tables Found</p>
                              <p className="font-bold text-lg">{lastDeepScanResult.tableCount}</p>
                            </div>
                            <div className="p-2 rounded bg-background">
                              <p className="text-muted-foreground">Pages Analyzed</p>
                              <p className="font-bold text-lg">{lastDeepScanResult.pageCount}</p>
                            </div>
                            <div className="p-2 rounded bg-background">
                              <p className="text-muted-foreground">Chars Extracted</p>
                              <p className="font-bold text-lg">{lastDeepScanResult.totalCharsExtracted > 1000 ? `${(lastDeepScanResult.totalCharsExtracted / 1000).toFixed(1)}k` : lastDeepScanResult.totalCharsExtracted}</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <SubscoreBar label="Table Quality" value={lastDeepScanResult.enhancedSignals.tableQuality} />
                            <SubscoreBar label="OCR Quality" value={lastDeepScanResult.enhancedSignals.ocrQuality} />
                            <SubscoreBar label="Structure Depth" value={lastDeepScanResult.enhancedSignals.structureDepth} />
                          </div>
                        </div>
                      )}

                      {scanResult.status === "MANUAL" && (
                        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/15 space-y-2" data-testid="manual-review-guidance">
                          <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
                            <XCircle className="h-4 w-4" />
                            This document needs manual attention
                          </p>
                          <div className="text-xs text-muted-foreground space-y-1.5 pl-5">
                            {scanResult.issues.some(i => i.message.toLowerCase().includes("encoding")) && (
                              <p>The text has broken or garbled characters. Try re-exporting the original file as a clean PDF or Word document and uploading again.</p>
                            )}
                            {scanResult.issues.some(i => i.message.toLowerCase().includes("low selectable text") || i.message.toLowerCase().includes("ocr required")) && (
                              <p>The document appears to be a scanned image with little or no selectable text. Use the "Make AI-Ready" button below to run OCR, or upload a text-based version of the file.</p>
                            )}
                            {!scanResult.issues.some(i => i.message.toLowerCase().includes("encoding") || i.message.toLowerCase().includes("low selectable text") || i.message.toLowerCase().includes("ocr required")) && (
                              <p>The overall quality score is below 40%. Try fixing the issues listed below — adding metadata, running the prep pipeline, or re-uploading a better quality version of the file.</p>
                            )}
                            <p className="text-muted-foreground/70 pt-1">Once you address the main issues, re-scan to check if the status improves.</p>
                          </div>
                        </div>
                      )}

                      {scanResult.estimatedImprovement && scanResult.status !== "READY" && (
                        <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                          <p className="text-xs text-primary font-medium">
                            <Sparkles className="h-3 w-3 inline-block mr-1" />
                            The prep pipeline could improve this score by +{scanResult.estimatedImprovement.min} to +{scanResult.estimatedImprovement.max} points
                          </p>
                        </div>
                      )}

                      {scanResult.issues.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Issues Found ({scanResult.issues.length})</p>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[10px] text-muted-foreground cursor-help underline decoration-dotted" data-testid="text-score-weights">Score weights</span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[240px]">
                                  <div className="text-xs space-y-1">
                                    <p className="font-medium">How the readiness score is calculated:</p>
                                    <p>Extractability: <strong>40%</strong></p>
                                    <p>Structure: <strong>25%</strong></p>
                                    <p>Quality: <strong>20%</strong></p>
                                    <p>Metadata: <strong>10%</strong> (title 3.5, date 2.5, owner 2.5, version 1.5)</p>
                                    <p className="text-muted-foreground pt-1">Point estimates shown per issue are approximate maximums.</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <ScrollArea className="h-[280px]">
                            <div className="space-y-2 pr-2">
                              {scanResult.issues.map((issue, idx) => {
                                const msg = issue.message.toLowerCase();
                                const isTitleIssue = msg.includes("title not found");
                                const isDateIssue = msg.includes("date not found");
                                const isAuthorIssue = msg.includes("author not found");
                                const isOwnerIssue = msg.includes("owner not assigned");
                                const isOcrIssue = msg.includes("ocr required");
                                const isLowTextIssue = msg.includes("low selectable text");
                                const isHeadingIssue = msg.includes("headings not detected");
                                const isTableImageIssue = msg.includes("tables likely embedded");
                                const isNoiseIssue = msg.includes("repeated header/footer");
                                const isEncodingIssue = msg.includes("encoding");
                                const isLayoutIssue = msg.includes("complex layout");
                                const canAutoPrepFix = isOcrIssue || isLowTextIssue || isHeadingIssue || isTableImageIssue || isNoiseIssue || isLayoutIssue;
                                const prepAlreadyRun = scanResult?.prepJob?.status === "DONE";
                                const editingKey = isTitleIssue ? "title" : isDateIssue ? "sourceDate" : isAuthorIssue ? "sourceAuthor" : "";

                                return (
                                  <div key={idx} className="p-2.5 rounded-md bg-muted/30 text-sm space-y-2" data-testid={`issue-row-${idx}`}>
                                    <div className="flex items-start gap-2">
                                      {issue.severity === "HIGH" ? (
                                        <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                      ) : issue.severity === "MED" ? (
                                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                      ) : (
                                        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm">{issue.message}</p>
                                      </div>
                                      <Badge variant="outline" className="text-[10px] shrink-0">{issue.severity}</Badge>
                                    </div>

                                    {selectedAssetId && (
                                      <div className="pl-6 space-y-1.5">
                                        {canAutoPrepFix && !prepAlreadyRun && (
                                          <div className="space-y-1.5">
                                            <div className="text-[11px] text-muted-foreground space-y-0.5">
                                              {isOcrIssue && (
                                                <>
                                                  <p><strong>Step 1:</strong> Click "Make AI-Ready" below — this will run OCR to extract text from the scanned document.</p>
                                                  <p><strong>If that doesn't work:</strong> Re-upload a higher quality scan or a native PDF with selectable text.</p>
                                                </>
                                              )}
                                              {isLowTextIssue && (
                                                <>
                                                  <p><strong>Step 1:</strong> Click "Make AI-Ready" below — this will attempt to extract more text from the file.</p>
                                                  <p><strong>If that doesn't work:</strong> The file may have very little content. Try uploading a text-based version instead.</p>
                                                </>
                                              )}
                                              {isHeadingIssue && (
                                                <>
                                                  <p><strong>Step 1:</strong> Click "Make AI-Ready" below — this will add section headings to improve document structure.</p>
                                                  <p><strong>If that doesn't work:</strong> Consider re-uploading the file with clearer section headings in the original.</p>
                                                </>
                                              )}
                                              {isTableImageIssue && (
                                                <>
                                                  <p><strong>Step 1:</strong> Click "Deep Scan First" if available, then "Make AI-Ready" to extract table content.</p>
                                                  <p><strong>If that doesn't work:</strong> Export the original document with selectable tables (not images) and re-upload.</p>
                                                </>
                                              )}
                                              {isNoiseIssue && (
                                                <>
                                                  <p><strong>Step 1:</strong> Click "Make AI-Ready" below — this will remove repeated headers, footers, and duplicated text.</p>
                                                  <p><strong>If that doesn't work:</strong> The repetition may be part of the document's content. This won't affect AI accuracy much.</p>
                                                </>
                                              )}
                                              {isLayoutIssue && (
                                                <>
                                                  <p><strong>Step 1:</strong> Click "Make AI-Ready" below — this will restructure the layout for better AI readability.</p>
                                                  <p><strong>If that doesn't work:</strong> Re-export the original as a single-column PDF and upload again.</p>
                                                </>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <Button
                                                size="sm"
                                                variant="default"
                                                className="gap-1.5"
                                                onClick={() => prepMutation.mutate(selectedAssetId)}
                                                disabled={prepMutation.isPending || !!isPrepRunning}
                                                data-testid={`button-autofix-${idx}`}
                                              >
                                                {prepMutation.isPending || isPrepRunning ? (
                                                  <><Loader2 className="h-3 w-3 animate-spin" />Preparing...</>
                                                ) : (
                                                  <><Sparkles className="h-3 w-3" />Make AI-Ready</>
                                                )}
                                              </Button>
                                              {(isTableImageIssue || isLayoutIssue) && pythonStatus?.healthy && (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="gap-1.5"
                                                  onClick={() => deepScanMutation.mutate(selectedAssetId)}
                                                  disabled={deepScanMutation.isPending}
                                                  data-testid={`button-deepscan-${idx}`}
                                                >
                                                  <Microscope className="h-3 w-3" />Deep Scan First
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {canAutoPrepFix && prepAlreadyRun && (
                                          <div className="space-y-1.5">
                                            <div className="text-[11px] space-y-0.5">
                                              <p className="text-amber-600 dark:text-amber-400 font-medium">The automatic fix was applied but this issue remains.</p>
                                              <p className="text-muted-foreground">
                                                {isOcrIssue && "The OCR could not fully extract text from this scan. Try re-uploading a clearer scan or a native PDF with selectable text."}
                                                {isLowTextIssue && "There still isn't enough extractable text. Try uploading a text-based version of this document (Word, plain text, or a better PDF)."}
                                                {isHeadingIssue && "Section headings were added but the document structure is still weak. Re-upload with clearer headings in the original file for best results."}
                                                {isTableImageIssue && "Some tables are still embedded as images. Export the original with selectable table data and re-upload."}
                                                {isNoiseIssue && "Some repeated content remains. This is likely part of the document format and won't significantly affect AI answers."}
                                                {isLayoutIssue && "The layout complexity remains after restructuring. Re-export as a simple single-column PDF for better results."}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5"
                                                onClick={() => prepMutation.mutate(selectedAssetId)}
                                                disabled={prepMutation.isPending || !!isPrepRunning}
                                                data-testid={`button-retry-prep-${idx}`}
                                              >
                                                {prepMutation.isPending || isPrepRunning ? (
                                                  <><Loader2 className="h-3 w-3 animate-spin" />Preparing...</>
                                                ) : (
                                                  <><Wrench className="h-3 w-3" />Try Again</>
                                                )}
                                              </Button>
                                              <span className="text-[11px] text-muted-foreground">or</span>
                                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                                                const tab = document.querySelector('[data-testid="tab-knowledge-space"]') as HTMLElement;
                                                if (tab) tab.click();
                                              }} data-testid={`button-reupload-${idx}`}>
                                                <Upload className="h-3 w-3" />Re-upload a Better Version
                                              </Button>
                                            </div>
                                          </div>
                                        )}

                                        {isEncodingIssue && (
                                          <div className="space-y-1.5">
                                            <div className="text-[11px] text-muted-foreground space-y-0.5">
                                              {!prepAlreadyRun ? (
                                                <>
                                                  <p><strong>Step 1:</strong> Click "Try Cleanup" below — this will fix common encoding issues like garbled characters.</p>
                                                  <p><strong>If that doesn't work:</strong> Re-export the original as a clean PDF or Word document and upload again.</p>
                                                </>
                                              ) : (
                                                <>
                                                  <p className="text-amber-600 dark:text-amber-400 font-medium">Encoding cleanup was applied but character corruption remains.</p>
                                                  <p>The file has deep encoding issues that can't be fixed automatically. Re-export the original as a clean PDF or Word document and upload again.</p>
                                                </>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <Button
                                                size="sm"
                                                variant={prepAlreadyRun ? "outline" : "default"}
                                                className="gap-1.5"
                                                onClick={() => prepMutation.mutate(selectedAssetId)}
                                                disabled={prepMutation.isPending || !!isPrepRunning}
                                                data-testid={`button-autofix-encoding-${idx}`}
                                              >
                                                {prepMutation.isPending || isPrepRunning ? (
                                                  <><Loader2 className="h-3 w-3 animate-spin" />Preparing...</>
                                                ) : (
                                                  <><Wrench className="h-3 w-3" />{prepAlreadyRun ? "Try Again" : "Try Cleanup"}</>
                                                )}
                                              </Button>
                                              <span className="text-[11px] text-muted-foreground">or</span>
                                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                                                const tab = document.querySelector('[data-testid="tab-knowledge-space"]') as HTMLElement;
                                                if (tab) tab.click();
                                              }} data-testid={`button-reupload-encoding-${idx}`}>
                                                <Upload className="h-3 w-3" />Re-upload a Clean Version
                                              </Button>
                                            </div>
                                          </div>
                                        )}

                                        {isTitleIssue && metadataEditing["title"] === undefined && (
                                          <div className="space-y-1">
                                            <p className="text-[11px] text-muted-foreground">Add a clear, descriptive heading so the AI knows what this document is about.</p>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="gap-1.5"
                                              onClick={() => setMetadataEditing(prev => ({ ...prev, title: "" }))}
                                              data-testid="button-fix-title"
                                            >
                                              <Type className="h-3 w-3" />Add Heading
                                            </Button>
                                          </div>
                                        )}

                                        {isTitleIssue && metadataEditing["title"] !== undefined && (
                                          <div className="flex items-center gap-1.5">
                                            <Input
                                              className="h-7 text-xs flex-1"
                                              placeholder="e.g. Company Leave Policy 2025"
                                              value={metadataEditing["title"] || ""}
                                              onChange={e => setMetadataEditing(prev => ({ ...prev, title: e.target.value }))}
                                              onKeyDown={e => {
                                                if (e.key === "Enter" && metadataEditing["title"]?.trim()) {
                                                  saveTitle(selectedAssetId, metadataEditing["title"]);
                                                }
                                              }}
                                              autoFocus
                                              data-testid="input-title"
                                            />
                                            <Button
                                              size="icon"
                                              disabled={!metadataEditing["title"]?.trim() || metadataSaving === "title"}
                                              onClick={() => saveTitle(selectedAssetId, metadataEditing["title"]!)}
                                              data-testid="button-save-title"
                                            >
                                              {metadataSaving === "title" ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <Check className="h-3 w-3" />
                                              )}
                                            </Button>
                                          </div>
                                        )}

                                        {(isDateIssue || isAuthorIssue) && metadataEditing[editingKey] === undefined && (
                                          <div className="space-y-1">
                                            <p className="text-[11px] text-muted-foreground">
                                              {isDateIssue ? "Adding a date helps the AI prioritise recent information and track document freshness." : "Adding an author helps the AI attribute content and improves governance tracking."}
                                            </p>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="gap-1.5"
                                              onClick={() => setMetadataEditing(prev => ({ ...prev, [editingKey]: "" }))}
                                              data-testid={`button-fix-${editingKey}`}
                                            >
                                              {isDateIssue ? <Calendar className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                                              {isDateIssue ? "Add Date" : "Add Author"}
                                            </Button>
                                          </div>
                                        )}

                                        {(isDateIssue || isAuthorIssue) && metadataEditing[editingKey] !== undefined && (
                                          <div className="flex items-center gap-1.5">
                                            <Input
                                              className="h-7 text-xs flex-1"
                                              placeholder={isDateIssue ? "e.g. 2024-03-15" : "e.g. John Smith"}
                                              value={metadataEditing[editingKey] || ""}
                                              onChange={e => setMetadataEditing(prev => ({ ...prev, [editingKey]: e.target.value }))}
                                              onKeyDown={e => {
                                                if (e.key === "Enter" && metadataEditing[editingKey]) {
                                                  saveMetadata(selectedAssetId, editingKey as "sourceAuthor" | "sourceDate", metadataEditing[editingKey]);
                                                }
                                              }}
                                              autoFocus
                                              data-testid={`input-${editingKey}`}
                                            />
                                            <Button
                                              size="icon"
                                              disabled={!metadataEditing[editingKey] || metadataSaving === editingKey}
                                              onClick={() => saveMetadata(selectedAssetId, editingKey as "sourceAuthor" | "sourceDate", metadataEditing[editingKey])}
                                              data-testid={`button-save-${editingKey}`}
                                            >
                                              {metadataSaving === editingKey ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <Check className="h-3 w-3" />
                                              )}
                                            </Button>
                                          </div>
                                        )}

                                        {isOwnerIssue && (
                                          <div className="space-y-1.5 w-full">
                                            <p className="text-[11px] text-muted-foreground">Assigning an owner improves governance and adds up to ~2.5 points.</p>
                                            <div className="flex gap-1.5 flex-wrap">
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5"
                                                disabled={metadataSaving === "owner"}
                                                onClick={() => assignOwner(selectedAssetId, "USER", "SELF", "Me (Document Owner)")}
                                                data-testid="button-assign-owner-me"
                                              >
                                                {metadataSaving === "owner" ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                                                Me
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5"
                                                disabled={metadataSaving === "owner"}
                                                onClick={() => assignOwner(selectedAssetId, "SYSTEM", "system", "System Account")}
                                                data-testid="button-assign-owner-system"
                                              >
                                                <Shield className="h-3 w-3" />
                                                System
                                              </Button>
                                            </div>
                                            <div className="flex gap-1">
                                              <Input
                                                type="email"
                                                placeholder="or enter email..."
                                                className="h-7 text-xs flex-1"
                                                value={metadataEditing["ownerEmail"] || ""}
                                                onChange={e => setMetadataEditing(prev => ({ ...prev, ownerEmail: e.target.value }))}
                                                onKeyDown={e => {
                                                  if (e.key === "Enter" && metadataEditing["ownerEmail"]?.trim()) {
                                                    assignOwner(selectedAssetId, "USER", metadataEditing["ownerEmail"].trim(), metadataEditing["ownerEmail"].trim());
                                                  }
                                                }}
                                                data-testid="input-owner-email"
                                              />
                                              <Button
                                                size="icon"
                                                disabled={!metadataEditing["ownerEmail"]?.trim() || metadataSaving === "owner"}
                                                onClick={() => assignOwner(selectedAssetId, "USER", metadataEditing["ownerEmail"]!.trim(), metadataEditing["ownerEmail"]!.trim())}
                                                data-testid="button-assign-owner-custom"
                                              >
                                                {metadataSaving === "owner" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                              </Button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                          {selectedAssetId && (
                            <div className="flex items-center gap-2 pt-2 border-t">
                              {scanResult.issues.some(i => {
                                const m = i.message.toLowerCase();
                                return m.includes("date") || m.includes("author") || m.includes("owner");
                              }) && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="gap-1.5 shrink-0"
                                  onClick={async () => {
                                    try {
                                      await scanMutation.mutateAsync(selectedAssetId);
                                      prepMutation.mutate(selectedAssetId);
                                    } catch {
                                      toast({ variant: "destructive", title: "Scan Failed", description: "Could not re-scan. Preparation skipped." });
                                    }
                                  }}
                                  disabled={scanMutation.isPending || prepMutation.isPending}
                                  data-testid="button-rescan-and-prep"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  Re-scan & Prepare
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {isPrepRunning && jobStatus && (
                        <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
                          <div className="flex items-center gap-3">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-sm font-medium">Preparation in progress...</span>
                            <span className="text-sm text-muted-foreground ml-auto">{jobStatus.progress}%</span>
                          </div>
                          <Progress value={jobStatus.progress} className="h-2" />
                          <ScrollArea className="h-[100px] rounded border p-2">
                            <div className="space-y-1 font-mono text-xs">
                              {jobStatus.logs.map((log, idx) => (
                                <div key={idx} className="flex gap-2">
                                  <span className="text-muted-foreground shrink-0">{new Date(log.ts).toLocaleTimeString()}</span>
                                  <span className={log.level === "error" ? "text-red-500" : ""}>{log.msg}</span>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}

                      {selectedAssetId && !isPrepRunning && (
                        <div className="flex items-center gap-2 pt-2 border-t mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => {
                              scanMutation.mutate(selectedAssetId);
                            }}
                            disabled={scanMutation.isPending}
                            data-testid="button-refresh-status"
                          >
                            {scanMutation.isPending ? (
                              <><Loader2 className="h-3 w-3 animate-spin" />Checking...</>
                            ) : (
                              <><RefreshCw className="h-3 w-3" />Refresh Status</>
                            )}
                          </Button>
                          <p className="text-[10px] text-muted-foreground flex-1">Re-scan to check for improvements after fixes.</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Collapsible open={serviceOpen} onOpenChange={setServiceOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 w-full text-left p-3 rounded-lg border hover-elevate transition-colors" data-testid="button-toggle-service-status">
                  <Server className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-medium flex-1">Evident Insight Service</span>
                  {pythonStatus?.healthy ? (
                    <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 gap-1 no-default-hover-elevate no-default-active-elevate">
                      <Activity className="w-3 h-3" />Online
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground gap-1 no-default-hover-elevate no-default-active-elevate">
                      <AlertTriangle className="w-3 h-3" />
                      {pythonStatus?.configured ? "Unreachable" : "Not Configured"}
                    </Badge>
                  )}
                  {serviceOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 pt-2">
                  {pythonStatusLoading && !pythonStatus ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking service status...
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${pythonStatus?.healthy ? "bg-green-500 animate-pulse" : pythonStatus?.configured ? "bg-amber-500" : "bg-red-500"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" data-testid="text-python-status">
                            {pythonStatus?.healthy ? "Online & Healthy" : pythonStatus?.configured ? "Configured but Unreachable" : "Not Configured"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Processing mode: {pythonStatus?.processingMode || "hybrid"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:ml-auto">
                        {pythonStatus?.healthy ? (
                          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 gap-1">
                            <Activity className="w-3 h-3" />
                            Deep Scan Available
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Basic Scan Only
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => refetchPythonStatus()}
                      disabled={pythonFetching}
                      data-testid="button-refresh-service-status"
                    >
                      {pythonFetching ? (
                        <><Loader2 className="h-3 w-3 animate-spin" />Checking...</>
                      ) : (
                        <><RefreshCw className="h-3 w-3" />Check Connection</>
                      )}
                    </Button>
                    <p className="text-[10px] text-muted-foreground flex-1">Auto-refreshes every 30s</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    The Evident Insight Service provides advanced document analysis including OCR, table extraction, and deep structural analysis for higher accuracy health scoring.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        <Card className="border-0 bg-muted/30">
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground text-center">
              <AlertCircle className="w-3 h-3 inline-block mr-1" />
              <strong>Note:</strong> Health scores indicate document preparedness for AI analysis — not automation readiness or compliance. Human review is recommended.
            </p>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
