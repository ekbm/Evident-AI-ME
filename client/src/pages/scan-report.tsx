import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  Shield, 
  Zap,
  TrendingUp,
  Target,
  Lightbulb,
  Download,
  Mail
} from "lucide-react";

interface LeadData {
  name: string | null;
  email: string;
  scanScore: number | null;
  totalFiles: number | null;
  readyCount: number | null;
  needsPrepCount: number | null;
  manualCount: number | null;
  topIssues: string[];
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-400";
    if (s >= 60) return "text-amber-400";
    return "text-red-400";
  };

  const getStrokeColor = (s: number) => {
    if (s >= 80) return "#4ade80";
    if (s >= 60) return "#fbbf24";
    return "#f87171";
  };

  return (
    <div className="relative w-32 h-32">
      <svg className="w-32 h-32 transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-slate-700"
        />
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke={getStrokeColor(score)}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</span>
        <span className="text-xs text-slate-400">out of 100</span>
      </div>
    </div>
  );
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "AI Ready";
  if (score >= 60) return "Needs Preparation";
  return "Manual Review Required";
}

function getScoreBadgeVariant(score: number): "default" | "secondary" | "destructive" {
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "destructive";
}

export default function ScanReportPage() {
  const { token } = useParams<{ token: string }>();
  const [scanResults, setScanResults] = useState<any>(null);

  const { data, isLoading, error } = useQuery<{ ok: boolean; lead: LeadData }>({
    queryKey: ["/api/scan-leads/verify", token],
    queryFn: async () => {
      const res = await fetch(`/api/scan-leads/verify/${token}`);
      if (!res.ok) throw new Error("Invalid or expired report link");
      return res.json();
    },
    enabled: !!token,
  });

  useEffect(() => {
    const storedResults = sessionStorage.getItem(`scan-results-${token}`);
    if (storedResults) {
      setScanResults(JSON.parse(storedResults));
    }
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-cyan-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your report...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-cyan-950 to-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-900 border-slate-700 max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Report Not Found</h2>
            <p className="text-slate-400 mb-6">This report link is invalid or has expired.</p>
            <Link href="/scan">
              <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600">
                Run a New Scan
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lead = data.lead;
  const score = lead.scanScore || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-cyan-950 to-slate-950">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwZDk0ODgiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40" />
      
      <div className="relative container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/scan">
          <Button variant="ghost" size="sm" className="mb-6 text-slate-400 hover:text-white" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Scanner
          </Button>
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm mb-4">
            <FileText className="h-4 w-4" />
            AI Readiness Report
          </div>
          <h1 className="text-3xl font-bold mb-2 text-white">
            Your Document Analysis Report
          </h1>
          {lead.name && (
            <p className="text-slate-400">Prepared for {lead.name}</p>
          )}
        </div>

        <Card className="mb-6 bg-slate-900/80 border-slate-700">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-white">Overall AI Readiness Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ScoreRing score={score} />
            <Badge 
              variant={getScoreBadgeVariant(score)}
              className="mt-4 text-sm px-4 py-1"
            >
              {getScoreLabel(score)}
            </Badge>
            <p className="text-slate-400 text-sm mt-4 text-center max-w-md">
              {score >= 80 
                ? "Your documents are well-prepared for AI processing. Minor optimizations may still improve results."
                : score >= 60
                ? "Your documents need some preparation before optimal AI processing. Focus on the recommendations below."
                : "Your documents require significant preparation. We recommend addressing the issues identified below."}
            </p>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-slate-900/80 border-slate-700">
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              </div>
              <div className="text-3xl font-bold text-green-400">{lead.readyCount || 0}</div>
              <div className="text-sm text-slate-400">AI Ready</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-700">
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <div className="text-3xl font-bold text-amber-400">{lead.needsPrepCount || 0}</div>
              <div className="text-sm text-slate-400">Need Preparation</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-700">
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
                <XCircle className="h-6 w-6 text-red-400" />
              </div>
              <div className="text-3xl font-bold text-red-400">{lead.manualCount || 0}</div>
              <div className="text-sm text-slate-400">Manual Review</div>
            </CardContent>
          </Card>
        </div>

        {lead.topIssues && lead.topIssues.length > 0 && (
          <Card className="mb-6 bg-slate-900/80 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-cyan-400" />
                Key Issues Identified
              </CardTitle>
              <CardDescription className="text-slate-400">
                Common problems found across your documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lead.topIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                    <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white">{issue}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 bg-slate-900/80 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-cyan-400" />
              Recommendations
            </CardTitle>
            <CardDescription className="text-slate-400">
              Steps to improve your AI readiness
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-400 font-semibold">1</span>
                </div>
                <div>
                  <p className="text-white font-medium">Standardize Document Formats</p>
                  <p className="text-slate-400 text-sm">Convert documents to consistent formats (PDF, DOCX) for better AI processing.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-400 font-semibold">2</span>
                </div>
                <div>
                  <p className="text-white font-medium">Add Document Metadata</p>
                  <p className="text-slate-400 text-sm">Include clear titles, authors, and dates to help AI understand context.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-400 font-semibold">3</span>
                </div>
                <div>
                  <p className="text-white font-medium">Improve Text Clarity</p>
                  <p className="text-slate-400 text-sm">Use clear headings, bullet points, and structured layouts for better extraction.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-400 font-semibold">4</span>
                </div>
                <div>
                  <p className="text-white font-medium">Address Scanned Documents</p>
                  <p className="text-slate-400 text-sm">Run OCR on image-based PDFs to make text searchable and AI-readable.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-900/20 border-cyan-500/30">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-semibold text-white mb-2">Need Help Preparing Your Documents?</h3>
                <p className="text-slate-300">
                  Our team can help you prepare your document library for AI. Get personalized recommendations and hands-on support.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href="mailto:support@evident-ai.net?subject=AI%20Readiness%20Support">
                  <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white">
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Us
                  </Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1 text-sm text-slate-300">
              <p>Your files were analysed only for readiness. We don't train models on them.</p>
              <p>This report is confidential and was generated based on your scan from the Evident AI Readiness Scanner.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
