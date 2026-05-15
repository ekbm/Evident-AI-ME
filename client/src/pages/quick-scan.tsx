import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";
import { EmailCaptureModal } from "@/components/email-capture-modal";
import {
  FolderOpen,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  Shield,
  Clock,
  Eye,
  Lock,
  FileSearch,
  Zap,
} from "lucide-react";

interface FileResult {
  name: string;
  size: number;
  type: string;
  score: number;
  status: "READY" | "NEEDS_PREP" | "MANUAL" | "UNSUPPORTED";
  issues: string[];
}

interface ScanSummary {
  totalFiles: number;
  supportedFiles: number;
  averageScore: number;
  readyCount: number;
  needsPrepCount: number;
  manualCount: number;
  topIssues: string[];
}

const SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "text/plain",
  "text/markdown",
  "text/csv",
];

const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".txt", ".md", ".csv"];

function isFileSupported(file: File): boolean {
  if (SUPPORTED_TYPES.includes(file.type)) return true;
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toUpperCase() || "FILE";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</span>
        <span className="text-xs text-muted-foreground">AI Ready</span>
      </div>
    </div>
  );
}

export default function QuickScanPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [results, setResults] = useState<FileResult[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [errorCount, setErrorCount] = useState(0);
  const [showContactModal, setShowContactModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const fileArray = Array.from(selectedFiles);
    setFiles(fileArray);
    setResults([]);
    setSummary(null);
    setErrorCount(0);
  }, []);

  const startScan = async () => {
    if (files.length === 0) return;

    setIsScanning(true);
    setScanProgress(0);
    setResults([]);
    setSummary(null);

    const supportedFiles = files.filter(isFileSupported);
    const unsupportedFiles = files.filter((f) => !isFileSupported(f));
    const scanResults: FileResult[] = [];

    for (const file of unsupportedFiles) {
      scanResults.push({
        name: file.name,
        size: file.size,
        type: file.type,
        score: 0,
        status: "UNSUPPORTED",
        issues: ["File type not supported for AI processing"],
      });
    }

    for (let i = 0; i < supportedFiles.length; i++) {
      const file = supportedFiles[i];
      setCurrentFile(file.name);
      setScanProgress(Math.round(((i + 1) / supportedFiles.length) * 100));

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/quick-scan", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          scanResults.push({
            name: file.name,
            size: file.size,
            type: file.type,
            score: result.score,
            status: result.status,
            issues: result.issues || [],
          });
        } else {
          const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
          const errorMsg = response.status === 429 
            ? "Just a moment — please try again shortly" 
            : response.status === 413 
              ? "File too large (max 5MB)" 
              : errorData.message || "Failed to analyze";
          scanResults.push({
            name: file.name,
            size: file.size,
            type: file.type,
            score: 0,
            status: "MANUAL",
            issues: [errorMsg],
          });
          setErrorCount((c) => c + 1);
        }
      } catch (error) {
        scanResults.push({
          name: file.name,
          size: file.size,
          type: file.type,
          score: 0,
          status: "MANUAL",
          issues: ["Network error - please check connection"],
        });
        setErrorCount((c) => c + 1);
      }

      await new Promise((r) => setTimeout(r, 100));
    }

    setResults(scanResults);

    const supported = scanResults.filter((r) => r.status !== "UNSUPPORTED");
    const avgScore = supported.length > 0 
      ? Math.round(supported.reduce((sum, r) => sum + r.score, 0) / supported.length)
      : 0;

    const allIssues = scanResults.flatMap((r) => r.issues);
    const issueCounts = allIssues.reduce((acc, issue) => {
      acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topIssues = Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue]) => issue);

    const failedCount = scanResults.filter((r) => r.status === "MANUAL" && r.issues.some(i => i.includes("error") || i.includes("failed") || i.includes("Network"))).length;

    setSummary({
      totalFiles: files.length,
      supportedFiles: supported.length,
      averageScore: avgScore,
      readyCount: scanResults.filter((r) => r.status === "READY").length,
      needsPrepCount: scanResults.filter((r) => r.status === "NEEDS_PREP").length,
      manualCount: scanResults.filter((r) => r.status === "MANUAL" || r.status === "UNSUPPORTED").length,
      topIssues,
    });

    setIsScanning(false);
    setCurrentFile("");

    if (failedCount > 0) {
      toast({
        title: "Some files couldn't be analyzed",
        description: `${failedCount} file(s) failed. Check the results for details or try again.`,
        variant: "destructive",
      });
    }
  };

  const resetScan = () => {
    setFiles([]);
    setResults([]);
    setSummary(null);
    setScanProgress(0);
    setErrorCount(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-cyan-950 to-slate-950">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwZDk0ODgiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40" />
      
      <div className="relative container mx-auto px-4 py-8 max-w-5xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm mb-4">
            <Zap className="h-4 w-4" />
            AI Readiness Scanner
          </div>
          <h1 className="text-4xl font-bold mb-3 text-white">
            Is Your Content AI-Ready?
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Upload your documents or select a folder to instantly check how well they'll work with AI tools.
            No sign-up required.
          </p>
        </div>

        {!summary && (
          <Card className="mb-8 bg-slate-900/80 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <FileSearch className="h-5 w-5 text-cyan-400" />
                Upload Documents
              </CardTitle>
              <CardDescription className="text-slate-400">
                Select individual files or an entire folder. We support PDF, Word, Excel, PowerPoint, and text files.
              </CardDescription>
            </CardHeader>
            
            {/* Disclaimer about scan methodology */}
            <div className="mx-6 mb-4 p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-300 space-y-2">
                  <p className="font-medium text-cyan-400">Privacy-First Quick Assessment</p>
                  <p>
                    This scan analyzes file characteristics (size, format, structure) to provide a quick readiness estimate. 
                    Your files are processed locally in your browser and are <strong className="text-white">never stored or sent to AI services</strong>.
                  </p>
                  <p className="text-slate-400 text-xs">
                    For deeper content analysis with AI-powered recommendations, upload to your workspace after this preview.
                  </p>
                </div>
              </div>
            </div>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-colors"
                  data-testid="upload-files-zone"
                >
                  <Upload className="h-10 w-10 mx-auto mb-3 text-slate-500" />
                  <p className="font-medium mb-1 text-white">Upload Files</p>
                  <p className="text-sm text-slate-500">Click to select documents</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.md,.csv"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    data-testid="input-files"
                  />
                </div>

                <div
                  onClick={() => folderInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-colors"
                  data-testid="upload-folder-zone"
                >
                  <FolderOpen className="h-10 w-10 mx-auto mb-3 text-slate-500" />
                  <p className="font-medium mb-1 text-white">Select Folder</p>
                  <p className="text-sm text-slate-500">Scan an entire folder</p>
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore - webkitdirectory is a valid attribute
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    data-testid="input-folder"
                  />
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                      {files.length} file{files.length !== 1 ? "s" : ""} selected
                      ({files.filter(isFileSupported).length} supported)
                    </p>
                    <Button variant="ghost" size="sm" onClick={resetScan} className="text-slate-400 hover:text-white" data-testid="button-clear-files">
                      Clear
                    </Button>
                  </div>

                  <ScrollArea className="h-40 border border-slate-700 rounded-md p-3 bg-slate-800/50">
                    <div className="space-y-2">
                      {files.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 text-sm"
                        >
                          <FileText className="h-4 w-4 text-slate-500 flex-shrink-0" />
                          <span className="truncate flex-1 text-white">{file.name}</span>
                          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                            {getFileExtension(file.name)}
                          </Badge>
                          <span className="text-slate-500 text-xs">
                            {formatFileSize(file.size)}
                          </span>
                          {!isFileSupported(file) && (
                            <Badge variant="secondary" className="text-xs">
                              Unsupported
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Button
                    onClick={startScan}
                    disabled={isScanning || files.filter(isFileSupported).length === 0}
                    className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
                    size="lg"
                    data-testid="button-start-scan"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Scanning... {scanProgress}%
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Start AI Readiness Scan
                      </>
                    )}
                  </Button>

                  {isScanning && (
                    <div className="space-y-2">
                      <Progress value={scanProgress} className="h-2" />
                      <p className="text-sm text-slate-400 text-center">
                        Analyzing: {currentFile}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {summary && (
          <>
            <Card className="mb-6 bg-slate-900/80 border-slate-700" data-testid="card-scan-results">
              <CardHeader className="pb-2">
                <CardTitle className="text-white">Scan Results</CardTitle>
                <CardDescription className="text-slate-400">
                  Analyzed {summary.supportedFiles} of {summary.totalFiles} files
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6 items-center">
                  <div className="flex justify-center">
                    <ScoreRing score={summary.averageScore} />
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20" data-testid="stat-ready-count">
                        <div className="text-2xl font-bold text-green-400">
                          {summary.readyCount}
                        </div>
                        <div className="text-sm text-slate-400">AI Ready</div>
                      </div>
                      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20" data-testid="stat-needs-prep-count">
                        <div className="text-2xl font-bold text-amber-400">
                          {summary.needsPrepCount}
                        </div>
                        <div className="text-sm text-slate-400">Need Prep</div>
                      </div>
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20" data-testid="stat-manual-count">
                        <div className="text-2xl font-bold text-red-400">
                          {summary.manualCount}
                        </div>
                        <div className="text-sm text-slate-400">Manual Review</div>
                      </div>
                    </div>

                    {summary.topIssues.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 text-white">Top Issues Found:</p>
                        <div className="flex flex-wrap gap-2">
                          {summary.topIssues.slice(0, 3).map((issue, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs border-slate-600 text-slate-400">
                              {issue}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Explanation of what the scan measures */}
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <div className="flex items-start gap-3 text-sm">
                    <FileSearch className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-400">
                      <strong className="text-slate-300">What this score means:</strong> This quick assessment evaluates file format, size, and structure indicators. 
                      Files marked "Needs Prep" may require OCR, text extraction, or format conversion before AI processing. 
                      "Manual Review" files have characteristics that need human verification first.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Card className="bg-slate-900/80 border-slate-700" data-testid="card-file-details">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-white">
                    <Eye className="h-4 w-4 text-cyan-400" />
                    File Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {results.map((result, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-800/50"
                          data-testid={`row-file-result-${idx}`}
                        >
                          {getStatusIcon(result.status)}
                          <span className="truncate flex-1 text-sm text-white" data-testid={`text-filename-${idx}`}>{result.name}</span>
                          <span className={`font-medium ${getScoreColor(result.score)}`} data-testid={`text-score-${idx}`}>
                            {result.status === "UNSUPPORTED" ? "-" : result.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-cyan-500/40" data-testid="card-upsell">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-white">
                    <Lock className="h-4 w-4 text-cyan-400" />
                    Unlock Full Report
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-300">
                    Get detailed analysis, improvement recommendations, 
                    and personalized AI preparation guidance.
                  </p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                      <span className="text-white">Detailed per-document analysis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                      <span className="text-white">Specific improvement recommendations</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                      <span className="text-white">One-click AI preparation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                      <span className="text-white">Enterprise support options</span>
                    </div>
                  </div>

                  <Button 
                    onClick={() => setShowContactModal(true)}
                    className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white" 
                    data-testid="button-unlock-report"
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Get Full Report
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="text-center">
              <Button variant="outline" onClick={resetScan} className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white" data-testid="button-scan-more">
                Scan More Documents
              </Button>
            </div>
          </>
        )}

        <EmailCaptureModal
          open={showContactModal}
          onOpenChange={setShowContactModal}
          scanData={summary}
          scanResults={results}
        />

        {!summary && (
          <>
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-cyan-400" />
                </div>
                <h3 className="font-semibold mb-2 text-white">Private & Secure</h3>
                <p className="text-sm text-slate-400">
                  Your files are analyzed in real-time and never stored on our servers.
                </p>
              </div>
              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-6 w-6 text-cyan-400" />
                </div>
                <h3 className="font-semibold mb-2 text-white">Instant Results</h3>
                <p className="text-sm text-slate-400">
                  Get your AI readiness score in seconds, not hours.
                </p>
              </div>
              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-6 w-6 text-cyan-400" />
                </div>
                <h3 className="font-semibold mb-2 text-white">Actionable Insights</h3>
                <p className="text-sm text-slate-400">
                  Learn exactly what to improve for better AI compatibility.
                </p>
              </div>
            </div>

            <div className="mt-10 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1 text-sm text-slate-300">
                  <p>Your files are analysed only for readiness. We don't train models on them.</p>
                  <p>Preview cleaning does not overwrite your data.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
