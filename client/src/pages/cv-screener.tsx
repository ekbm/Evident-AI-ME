import { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/features/packs/useEntitlements";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AuthRequiredMessage } from "@/components/auth-required-message";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  FileText, 
  Users, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  Download,
  Loader2,
  Brain,
  Search,
  ListFilter,
  AlertTriangle,
  Sparkles,
  Lock,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  TrendingDown,
  BarChart3
} from "lucide-react";
import type { Asset } from "@shared/schema";

interface Criterion {
  id: string;
  name: string;
  description: string;
  type: "must_have" | "nice_to_have" | "red_flag";
  weight: number;
}

interface CandidateResult {
  id: string;
  filename: string;
  candidateName: string | null;
  candidateEmail: string | null;
  candidatePhone?: string | null;
  currentRole?: string | null;
  yearsExperience?: string | null;
  keySkills?: string[];
  education?: string[];
  strengths?: string[];
  concerns?: string[];
  overallScore: number;
  status: "shortlist" | "borderline" | "not_a_match";
  mustHavePass: boolean;
  summary: string | null;
  criteriaScores?: Record<string, { score: number; passed: boolean; evidence: string | null }>;
}

type Tab = "understand" | "analyse" | "shortlist";

export default function CVScreenerPage() {
  useDocumentTitle("HR Intelligence Pack");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isPackEnabled, isLoading: entitlementsLoading } = useEntitlements();
  
  const isHRPackEnabled = isPackEnabled("hr");
  
  const [showLanding, setShowLanding] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("understand");
  const [packName, setPackName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newCriterionName, setNewCriterionName] = useState("");
  const [newCriterionType, setNewCriterionType] = useState<"must_have" | "nice_to_have" | "red_flag">("must_have");
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const cvAssets = assets.filter(a => 
    a.status === "READY" && 
    (a.mime.includes("pdf") || a.mime.includes("word") || a.mime.includes("document"))
  );

  const screeningMutation = useMutation({
    mutationFn: async (data: { name: string; criteria: Criterion[]; assetIds: string[] }) => {
      const res = await apiRequest("POST", "/api/cv-screener/sessions", data);
      return res.json();
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setIsProcessing(true);
      setActiveTab("shortlist");
      toast({ title: "Screening started", description: "Processing CVs..." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  interface ScreeningResults {
    session: {
      id: string;
      status: "processing" | "completed" | "failed";
      processedCVs: number;
      totalCVs: number;
    };
    candidates: CandidateResult[];
  }

  const { data: results } = useQuery<ScreeningResults>({
    queryKey: ["/api/cv-screener/sessions", sessionId],
    enabled: !!sessionId,
    refetchInterval: isProcessing ? 3000 : false,
  });

  if (results?.session?.status === "completed" && isProcessing) {
    setIsProcessing(false);
  }

  const addCriterion = useCallback(() => {
    if (!newCriterionName.trim()) return;
    setCriteria(prev => [...prev, {
      id: crypto.randomUUID(),
      name: newCriterionName.trim(),
      description: "",
      type: newCriterionType,
      weight: newCriterionType === "must_have" ? 0 : newCriterionType === "nice_to_have" ? 5 : -5,
    }]);
    setNewCriterionName("");
  }, [newCriterionName, newCriterionType]);

  const removeCriterion = useCallback((id: string) => {
    setCriteria(prev => prev.filter(c => c.id !== id));
  }, []);

  const toggleAsset = useCallback((id: string) => {
    setSelectedAssetIds(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  }, []);

  const startScreening = useCallback(() => {
    if (criteria.length === 0 || selectedAssetIds.length === 0) {
      toast({ title: "Please add criteria and select CVs", variant: "destructive" });
      return;
    }
    screeningMutation.mutate({
      name: packName || "Untitled Screening",
      criteria,
      assetIds: selectedAssetIds,
    });
  }, [packName, criteria, selectedAssetIds, screeningMutation, toast]);

  const exportCSV = useCallback(() => {
    if (!results?.candidates) return;
    const headers = ["Rank", "Name", "Email", "Score", "Status", "Summary"];
    const rows = results.candidates
      .sort((a: CandidateResult, b: CandidateResult) => b.overallScore - a.overallScore)
      .map((c: CandidateResult, i: number) => [
        i + 1,
        c.candidateName || c.filename,
        c.candidateEmail || "",
        c.overallScore,
        c.status,
        (c.summary || "").replace(/,/g, ";"),
      ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${packName || "screening"}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, packName]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "must_have": return <Badge variant="destructive" className="text-xs">Must Have</Badge>;
      case "nice_to_have": return <Badge className="text-xs">Nice to Have</Badge>;
      case "red_flag": return <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Red Flag</Badge>;
      default: return null;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "shortlist": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "borderline": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      case "not_a_match": return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      default: return "";
    }
  };

  // Loading state
  if (authLoading || entitlementsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Auth gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" className="mb-6" onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Close & Return to Knowledge Space
          </Button>
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-2">HR Intelligence Pack</h1>
            <p className="text-muted-foreground mb-6">Sign in to access CV screening tools</p>
            <AuthRequiredMessage />
          </div>
        </div>
      </div>
    );
  }

  // Pack gate - only show if HR pack is enabled by admin
  if (!isHRPackEnabled) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-lg mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" className="mb-6" onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Close & Return to Knowledge Space
          </Button>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold mb-2">HR Intelligence Pack</h1>
            <Badge variant="secondary" className="mb-4">Premium Add-on</Badge>
            <p className="text-muted-foreground mb-2">
              Screen hundreds of CVs in minutes with AI-powered candidate matching.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Add the HR Intelligence Pack to your plan to unlock this feature.
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/pricing">
                <Button className="w-full" data-testid="button-upgrade-plan">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Add to My Plan
                </Button>
              </Link>
              <Link href="/packs">
                <Button variant="outline" className="w-full" data-testid="button-view-packs">
                  View All Packs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Landing Page
  if (showLanding) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-8">
            <Button variant="ghost" size="sm" onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Close & Return to Knowledge Space
            </Button>
          </div>

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-1">HR Intelligence Pack</h1>
            <Badge variant="secondary" className="mb-3">Recruitment Intelligence</Badge>
            <p className="text-muted-foreground">Screen hundreds of CVs in minutes</p>
          </div>

          {/* 3-Step Process */}
          <div className="space-y-3 mb-8">
            <p className="text-xs text-muted-foreground text-center uppercase tracking-wide">How it works</p>
            <Card>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center shrink-0">
                  <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Understand</h3>
                  <p className="text-sm text-muted-foreground">Define your role and screening criteria</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center shrink-0">
                  <Search className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Analyse</h3>
                  <p className="text-sm text-muted-foreground">Upload CVs and let AI extract key information</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center shrink-0">
                  <ListFilter className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Shortlist</h3>
                  <p className="text-sm text-muted-foreground">Get ranked candidates with evidence</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Disclaimer */}
          <Card className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Decision support tool only. Does not make automated hiring decisions.
                </p>
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full h-12 text-lg" 
            onClick={() => setShowLanding(false)}
            data-testid="button-get-started"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Get Started
          </Button>
        </div>
      </div>
    );
  }

  // Main App with Tabs
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => setShowLanding(true)} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Recruitment Intelligence</h1>
            <p className="text-xs text-muted-foreground">HR Intelligence Pack</p>
          </div>
          {sessionId && !isProcessing && results?.candidates && results.candidates.length > 0 && (
            <Button size="sm" variant="outline" onClick={exportCSV} data-testid="button-export">
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-muted rounded-lg p-1 mb-6">
          <button
            onClick={() => setActiveTab("understand")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === "understand" 
                ? "bg-background shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-understand"
          >
            <Brain className="h-4 w-4 mx-auto mb-1" />
            Understand
          </button>
          <button
            onClick={() => setActiveTab("analyse")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === "analyse" 
                ? "bg-background shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-analyse"
          >
            <Search className="h-4 w-4 mx-auto mb-1" />
            Analyse
          </button>
          <button
            onClick={() => setActiveTab("shortlist")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === "shortlist" 
                ? "bg-background shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-shortlist"
          >
            <ListFilter className="h-4 w-4 mx-auto mb-1" />
            Shortlist
          </button>
        </div>

        {/* UNDERSTAND Tab */}
        {activeTab === "understand" && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label className="text-sm font-medium">Role Name</Label>
                  <Input
                    placeholder="e.g., Senior Developer"
                    value={packName}
                    onChange={(e) => setPackName(e.target.value)}
                    className="mt-1"
                    data-testid="input-role-name"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Description (optional)</Label>
                  <Textarea
                    placeholder="What are you looking for?"
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    className="mt-1 min-h-[60px]"
                    data-testid="input-description"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label className="text-sm font-medium">Add Your Own Criteria</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Type any skill, experience, or keyword to search for in CVs
                  </p>
                </div>
                
                {/* Add new - prominent */}
                <div className="space-y-2 p-3 border border-dashed border-primary/30 rounded-lg bg-primary/5">
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Python, AWS, project management..."
                      value={newCriterionName}
                      onChange={(e) => setNewCriterionName(e.target.value)}
                      className="flex-1"
                      onKeyDown={(e) => e.key === "Enter" && addCriterion()}
                      data-testid="input-criterion"
                    />
                    <Select value={newCriterionType} onValueChange={(v: any) => setNewCriterionType(v)}>
                      <SelectTrigger className="w-28" data-testid="select-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="must_have">Must Have</SelectItem>
                        <SelectItem value="nice_to_have">Nice to Have</SelectItem>
                        <SelectItem value="red_flag">Red Flag</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={addCriterion} data-testid="button-add">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Examples: "React experience", "MBA degree", "Fluent in Spanish", "CPA certified"
                  </p>
                </div>

                {/* List */}
                {criteria.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Your criteria ({criteria.length}):</Label>
                    {criteria.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        {getTypeBadge(c.type)}
                        <span className="flex-1 text-sm truncate">{c.name}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCriterion(c.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick add - collapsible */}
                <details className="group">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                    <span className="group-open:rotate-90 transition-transform">▶</span>
                    Quick add common criteria
                  </summary>
                  <div className="space-y-2 mt-2 pl-4 border-l-2 border-muted">
                  
                  {/* Education */}
                  <div className="flex flex-wrap gap-1">
                    {["Bachelor's degree", "Master's degree", "PhD", "Relevant certification"].map((item) => (
                      !criteria.some(c => c.name.includes(item)) && (
                        <Button
                          key={item}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setCriteria(prev => [...prev, {
                            id: crypto.randomUUID(),
                            name: item,
                            description: "",
                            type: "nice_to_have",
                            weight: 5,
                          }])}
                        >
                          + {item}
                        </Button>
                      )
                    ))}
                  </div>

                  {/* Experience */}
                  <div className="flex flex-wrap gap-1">
                    {["3+ years experience", "5+ years experience", "10+ years experience", "Industry experience"].map((item) => (
                      !criteria.some(c => c.name.includes(item)) && (
                        <Button
                          key={item}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setCriteria(prev => [...prev, {
                            id: crypto.randomUUID(),
                            name: item,
                            description: "",
                            type: "nice_to_have",
                            weight: 5,
                          }])}
                        >
                          + {item}
                        </Button>
                      )
                    ))}
                  </div>

                  {/* Soft Skills */}
                  <div className="flex flex-wrap gap-1">
                    {["Communication skills", "Leadership", "Team player", "Problem solving", "Adaptability", "Time management"].map((item) => (
                      !criteria.some(c => c.name.includes(item)) && (
                        <Button
                          key={item}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setCriteria(prev => [...prev, {
                            id: crypto.randomUUID(),
                            name: item,
                            description: "",
                            type: "nice_to_have",
                            weight: 5,
                          }])}
                        >
                          + {item}
                        </Button>
                      )
                    ))}
                  </div>

                  {/* Red Flags */}
                  <div className="flex flex-wrap gap-1">
                    {["Frequent job changes", "Employment gaps", "Missing contact info"].map((item) => (
                      !criteria.some(c => c.name.includes(item)) && (
                        <Button
                          key={item}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                          onClick={() => setCriteria(prev => [...prev, {
                            id: crypto.randomUUID(),
                            name: item,
                            description: "",
                            type: "red_flag",
                            weight: -5,
                          }])}
                        >
                          + {item}
                        </Button>
                      )
                    ))}
                  </div>
                  </div>
                </details>
              </CardContent>
            </Card>

            <Button 
              className="w-full" 
              onClick={() => setActiveTab("analyse")}
              disabled={criteria.length === 0}
              data-testid="button-next-analyse"
            >
              Continue to Analyse
            </Button>
          </div>
        )}

        {/* ANALYSE Tab */}
        {activeTab === "analyse" && (
          <div className="space-y-4">
            {/* Direct Upload Section */}
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium">Upload CVs</Label>
                  <Badge variant="outline" className="text-xs">PDF, DOC, DOCX</Badge>
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      
                      for (const file of Array.from(files)) {
                        const formData = new FormData();
                        formData.append("file", file);
                        try {
                          const res = await fetch("/api/assets", {
                            method: "POST",
                            body: formData,
                            credentials: "include",
                          });
                          if (!res.ok) throw new Error("Upload failed");
                          toast({ title: "Uploaded", description: file.name });
                        } catch (err) {
                          toast({ title: "Upload failed", description: file.name, variant: "destructive" });
                        }
                      }
                      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
                      e.target.value = "";
                    }}
                    data-testid="input-upload-cvs"
                  />
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Drop CVs here or tap to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">Upload multiple files at once</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Select from existing */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Select CVs</Label>
                  <Badge variant="secondary">{selectedAssetIds.length} selected</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Documents from your main workspace are also available here
                </p>

                {cvAssets.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">No documents found. Upload CVs above or in your main workspace.</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-primary mb-2"
                      onClick={() => setSelectedAssetIds(cvAssets.map(a => a.id))}
                    >
                      Select All ({cvAssets.length})
                    </Button>
                    {cvAssets.map(asset => (
                      <label key={asset.id} className="flex items-center gap-2 p-2 rounded hover-elevate cursor-pointer">
                        <Checkbox
                          checked={selectedAssetIds.includes(asset.id)}
                          onCheckedChange={() => toggleAsset(asset.id)}
                        />
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{asset.filename}</span>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>{criteria.length}</strong> criteria defined, 
                  <strong> {selectedAssetIds.length}</strong> CVs selected
                </p>
              </CardContent>
            </Card>

            <Button 
              className="w-full" 
              onClick={startScreening}
              disabled={selectedAssetIds.length === 0 || criteria.length === 0 || screeningMutation.isPending}
              data-testid="button-start-screening"
            >
              {screeningMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Screening
                </>
              )}
            </Button>
          </div>
        )}

        {/* SHORTLIST Tab */}
        {activeTab === "shortlist" && (
          <div className="space-y-4">
            {/* Processing */}
            {isProcessing && (
              <Card>
                <CardContent className="p-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Processing {results?.session?.processedCVs || 0} of {results?.session?.totalCVs || selectedAssetIds.length}
                  </p>
                  <Progress 
                    value={results?.session ? (results.session.processedCVs / results.session.totalCVs) * 100 : 0} 
                    className="h-2"
                  />
                </CardContent>
              </Card>
            )}

            {/* Results with Analytics */}
            {results?.candidates && results.candidates.length > 0 ? (
              <div className="space-y-4">
                {/* Summary Statistics */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Screening Summary</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-background rounded-lg p-3">
                        <p className="text-2xl font-bold">{results.candidates.length}</p>
                        <p className="text-xs text-muted-foreground">Total CVs</p>
                      </div>
                      <div className="bg-green-500/10 rounded-lg p-3">
                        <p className="text-2xl font-bold text-green-600">
                          {results.candidates.filter((c) => c.status === "shortlist").length}
                        </p>
                        <p className="text-xs text-muted-foreground">Shortlisted</p>
                      </div>
                      <div className="bg-red-500/10 rounded-lg p-3">
                        <p className="text-2xl font-bold text-red-600">
                          {results.candidates.filter((c) => c.status === "not_a_match").length}
                        </p>
                        <p className="text-xs text-muted-foreground">Not a Match</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Criteria Breakdown */}
                {criteria.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingDown className="h-4 w-4 text-orange-500" />
                        <span className="font-medium text-sm">Criteria Failure Analysis</span>
                      </div>
                      <div className="space-y-2">
                        {criteria
                          .map(c => {
                            const candidates = results.candidates;
                            const candidatesWithScores = candidates.filter((cand) => 
                              cand.criteriaScores && (cand.criteriaScores[c.id] || cand.criteriaScores[c.name])
                            );
                            const passCount = candidatesWithScores.filter((cand) => 
                              cand.criteriaScores?.[c.id]?.passed || cand.criteriaScores?.[c.name]?.passed
                            ).length;
                            const failCount = candidatesWithScores.length - passCount;
                            const failRate = candidatesWithScores.length > 0 
                              ? Math.round((failCount / candidatesWithScores.length) * 100) 
                              : 0;
                            return { ...c, passCount, failCount, failRate, evaluated: candidatesWithScores.length };
                          })
                          .sort((a, b) => b.failRate - a.failRate)
                          .map(c => (
                            <div key={c.id} className="flex items-center justify-between gap-2 text-sm" data-testid={`row-criterion-${c.id}`}>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Badge variant={c.type === "must_have" ? "destructive" : c.type === "red_flag" ? "secondary" : "outline"} className="text-xs shrink-0">
                                  {c.type === "must_have" ? "Must" : c.type === "red_flag" ? "Flag" : "Nice"}
                                </Badge>
                                <span className="truncate">{c.name}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-green-600 text-xs">{c.passCount} pass</span>
                                <span className="text-red-600 text-xs">{c.failCount} fail</span>
                                <span className="font-medium text-xs w-12 text-right">{c.failRate}%</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Export Button */}
                <Button variant="outline" onClick={exportCSV} className="w-full" data-testid="button-export-csv">
                  <Download className="h-4 w-4 mr-2" />
                  Export Results (CSV)
                </Button>

                {/* Individual Candidate Cards */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Individual Results (tap to expand)</p>
                  {results.candidates
                    .sort((a, b) => b.overallScore - a.overallScore)
                    .map((candidate, index) => {
                      const isExpanded = expandedCandidateId === candidate.id;
                      return (
                        <Card 
                          key={candidate.id} 
                          className="cursor-pointer hover-elevate"
                          onClick={() => setExpandedCandidateId(isExpanded ? null : candidate.id)}
                          data-testid={`card-candidate-${index}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getStatusStyle(candidate.status)}`}>
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{candidate.candidateName || candidate.filename}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusStyle(candidate.status)}`}>
                                    {candidate.status === "shortlist" && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                                    {candidate.status === "borderline" && <HelpCircle className="h-3 w-3 inline mr-1" />}
                                    {candidate.status === "not_a_match" && <XCircle className="h-3 w-3 inline mr-1" />}
                                    {candidate.status.replace("_", " ")}
                                  </span>
                                  <span className="text-sm font-semibold">{candidate.overallScore}%</span>
                                  {candidate.currentRole && (
                                    <span className="text-xs text-muted-foreground truncate">{candidate.currentRole}</span>
                                  )}
                                </div>
                              </div>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                            </div>
                            
                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t space-y-4" onClick={e => e.stopPropagation()}>
                                {/* Contact Info */}
                                <div className="flex flex-wrap gap-3 text-sm">
                                  {candidate.candidateEmail && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Mail className="h-3 w-3" />
                                      <span>{candidate.candidateEmail}</span>
                                    </div>
                                  )}
                                  {candidate.candidatePhone && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Phone className="h-3 w-3" />
                                      <span>{candidate.candidatePhone}</span>
                                    </div>
                                  )}
                                  {candidate.yearsExperience && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Briefcase className="h-3 w-3" />
                                      <span>{candidate.yearsExperience} experience</span>
                                    </div>
                                  )}
                                </div>

                                {/* Education */}
                                {candidate.education && candidate.education.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                                      <GraduationCap className="h-3 w-3" />
                                      Education
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {candidate.education.map((edu, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">{edu}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Key Skills */}
                                {candidate.keySkills && candidate.keySkills.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Key Skills</p>
                                    <div className="flex flex-wrap gap-1">
                                      {candidate.keySkills.map((skill, i) => (
                                        <Badge key={i} variant="outline" className="text-xs">{skill}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Summary */}
                                {candidate.summary && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                                    <p className="text-sm">{candidate.summary}</p>
                                  </div>
                                )}

                                {/* Strengths & Concerns */}
                                <div className="grid grid-cols-2 gap-3">
                                  {candidate.strengths && candidate.strengths.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-green-600 mb-1">Strengths</p>
                                      <ul className="text-xs space-y-1">
                                        {candidate.strengths.map((s, i) => (
                                          <li key={i} className="flex items-start gap-1">
                                            <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                                            <span>{s}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {candidate.concerns && candidate.concerns.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-orange-600 mb-1">Concerns</p>
                                      <ul className="text-xs space-y-1">
                                        {candidate.concerns.map((con, i) => (
                                          <li key={i} className="flex items-start gap-1">
                                            <AlertTriangle className="h-3 w-3 text-orange-500 mt-0.5 shrink-0" />
                                            <span>{con}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>

                                {/* Criteria Scores */}
                                {candidate.criteriaScores && Object.keys(candidate.criteriaScores).length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Criteria Results</p>
                                    <div className="space-y-2">
                                      {Object.entries(candidate.criteriaScores).map(([key, value]) => (
                                        <div key={key} className="flex items-start gap-2 text-xs">
                                          {value.passed ? (
                                            <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                                          ) : (
                                            <XCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                                          )}
                                          <div className="flex-1">
                                            <span className="font-medium">{key}</span>
                                            <span className="text-muted-foreground ml-2">({value.score}/10)</span>
                                            {value.evidence && (
                                              <p className="text-muted-foreground mt-0.5 italic">"{value.evidence}"</p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </div>
            ) : !isProcessing && (
              <Card>
                <CardContent className="p-8 text-center">
                  <ListFilter className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {sessionId ? "No results yet" : "Start screening to see results"}
                  </p>
                  {!sessionId && (
                    <Button variant="ghost" onClick={() => setActiveTab("analyse")} className="mt-2">
                      Go to Analyse tab
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
