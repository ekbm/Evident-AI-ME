import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bot,
  Brain,
  Sparkles,
  BarChart3,
  FolderSearch,
  Copy,
  FileSearch,
  RefreshCw,
  LogIn,
  Zap,
  Home,
} from "lucide-react";

interface ScanResult {
  totalFiles: number;
  score: number;
  categories: {
    formatCompatibility: number;
    structureNaming: number;
    duplicatesVersions: number;
    metadataSignals: number;
    searchability: number;
  };
  issues: string[];
  recommendations: string[];
  fileBreakdown: {
    supported: number;
    images: number;
    scanned: number;
    other: number;
  };
}

function getScoreGrade(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 80) return { label: "Excellent", color: "text-emerald-400", bgColor: "from-emerald-500 to-green-500" };
  if (score >= 60) return { label: "Good", color: "text-cyan-400", bgColor: "from-cyan-500 to-blue-500" };
  if (score >= 40) return { label: "Fair", color: "text-amber-400", bgColor: "from-amber-500 to-orange-500" };
  return { label: "Needs Work", color: "text-red-400", bgColor: "from-red-500 to-rose-500" };
}

function ScoreRing({ score }: { score: number }) {
  const grade = getScoreGrade(score);
  const circumference = 2 * Math.PI * 54;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90">
        <circle
          cx="72"
          cy="72"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-slate-800"
        />
        <circle
          cx="72"
          cy="72"
          r="54"
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${grade.color}`}>{score}</span>
        <span className="text-xs text-slate-400">{grade.label}</span>
      </div>
    </div>
  );
}

const categoryConfig = [
  { key: "formatCompatibility", label: "Format Compatibility", max: 25, icon: FileText, color: "from-cyan-500 to-blue-500" },
  { key: "structureNaming", label: "Structure & Naming", max: 20, icon: FolderSearch, color: "from-blue-500 to-indigo-500" },
  { key: "duplicatesVersions", label: "Duplicates & Versions", max: 20, icon: Copy, color: "from-indigo-500 to-purple-500" },
  { key: "metadataSignals", label: "Metadata Signals", max: 20, icon: BarChart3, color: "from-purple-500 to-pink-500" },
  { key: "searchability", label: "Searchability", max: 15, icon: FileSearch, color: "from-pink-500 to-rose-500" },
];

export default function LiveResults() {
  const [, setLocation] = useLocation();
  const [result, setResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("evidentLiveScanResult");
    if (stored) {
      setResult(JSON.parse(stored));
    } else {
      setLocation("/live");
    }
  }, [setLocation]);

  if (!result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const grade = getScoreGrade(result.score);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMjI4NDQiIGZpbGwtb3BhY2l0eT0iMC4yIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40" />
      
      <div className="relative container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/live/scan">
            <Button variant="ghost" className="text-slate-400 hover:text-white" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Scan Again
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="text-slate-400 hover:text-white" data-testid="button-home">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400 text-sm mb-4">
            <Brain className="h-4 w-4" />
            AI Readiness Score
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Your Results
          </h1>
          <p className="text-slate-400">
            Based on analysis of {result.totalFiles} files
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="md:col-span-1 bg-slate-900/80 border-slate-700" data-testid="card-score">
            <CardContent className="p-6 flex flex-col items-center justify-center">
              <ScoreRing score={result.score} />
              <p className="mt-4 text-lg font-medium text-white">AI Readiness</p>
              <Badge 
                className={`mt-2 bg-gradient-to-r ${grade.bgColor} text-white border-0`}
              >
                {grade.label}
              </Badge>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 bg-slate-900/80 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryConfig.map((cat) => {
                const value = result.categories[cat.key as keyof typeof result.categories];
                const percent = Math.round((value / cat.max) * 100);
                return (
                  <div key={cat.key} className="space-y-1" data-testid={`category-${cat.key}`}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <cat.icon className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-300">{cat.label}</span>
                      </div>
                      <span className="text-white font-medium">{value}/{cat.max}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${cat.color} rounded-full transition-all duration-1000`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-slate-900/80 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-400" />
                File Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span className="text-slate-300">AI-Ready Formats</span>
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-400/30">
                    {result.fileBreakdown.supported}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span className="text-slate-300">Images</span>
                  </div>
                  <Badge variant="outline" className="text-amber-400 border-amber-400/30">
                    {result.fileBreakdown.images}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-400" />
                    <span className="text-slate-300">Scanned Documents</span>
                  </div>
                  <Badge variant="outline" className="text-red-400 border-red-400/30">
                    {result.fileBreakdown.scanned}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                Top Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.recommendations.slice(0, 5).map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-cyan-400 font-medium">{idx + 1}</span>
                    </div>
                    <span className="text-slate-300 text-sm">{rec}</span>
                  </div>
                ))}
                {result.recommendations.length === 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Your files are well-organized!</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {result.issues.length > 0 && (
          <Card className="bg-slate-900/80 border-slate-700 mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Issues Found
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {result.issues.map((issue, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline" 
                    className="text-amber-400 border-amber-400/30 bg-amber-500/10"
                  >
                    {issue}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-slate-800 border-cyan-500/50 mb-8">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <Bot className="h-8 w-8 text-white" />
              </div>
              <div className="text-center md:text-left flex-1">
                <h3 className="text-xl font-bold text-white mb-2">
                  Want Continuous AI Readiness?
                </h3>
                <p className="text-slate-300 mb-4">
                  Our Evident Agent monitors your documents in real-time, auto-tags files, 
                  cleans up duplicates, and keeps everything AI-ready.
                </p>
                <Link href="/live/contact">
                  <Button 
                    className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-lg shadow-cyan-500/25"
                    data-testid="button-contact-agent"
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Contact Us About the Agent
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-indigo-500/50 mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1">
                  Want Deeper Analysis?
                </h3>
                <p className="text-slate-300 text-sm">
                  Get a full AI Readiness audit with document-level scoring, 
                  detailed recommendations, and preparation tools.
                </p>
              </div>
              <Link href="/live/contact">
                <Button 
                  variant="outline"
                  className="border-indigo-400 text-indigo-300 hover:bg-indigo-500/20 whitespace-nowrap"
                  data-testid="button-contact-dashboard"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Contact Us
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/live/scan">
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800" data-testid="button-scan-again">
              <RefreshCw className="h-4 w-4 mr-2" />
              Scan More Files
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
