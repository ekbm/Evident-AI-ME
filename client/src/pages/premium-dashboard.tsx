import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Building2, RefreshCw, Info, TrendingUp, FileStack, Search, 
  Clock, Users, Download, Calendar, AlertCircle, CheckCircle, Loader2, HelpCircle, ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ExtractabilityCard } from "@/components/extractability-card";

interface OrgProfile {
  id: string;
  orgName: string | null;
  industry: string | null;
  companySizeBand: string | null;
  createdAt: string;
}

interface BreakdownItem {
  score: number;
  max: number;
  details: Record<string, any>;
}

interface RecommendedAction {
  label: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
}

interface ReadinessData {
  scoreTotal: number;
  breakdown: {
    coverage: BreakdownItem;
    structure: BreakdownItem;
    retrieval: BreakdownItem;
    freshness: BreakdownItem;
    adoption: BreakdownItem;
  };
  confidence: "LOW" | "MEDIUM" | "HIGH";
  benchmarkRange: [number, number] | null;
  recommendedActions: RecommendedAction[];
  aiPreparedPercent: number;
  description: string;
  lastUpdated: string | null;
  orgProfile: OrgProfile | null;
}

interface OrgProfileData {
  profile: OrgProfile | null;
  industries: { value: string; label: string }[];
  sizeBands: { value: string; label: string }[];
}

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
    if (s >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-500 dark:text-red-400";
  };

  return (
    <div className={`flex items-center justify-center ${size === "large" ? "w-32 h-32" : "w-16 h-16"}`}>
      <div className="relative">
        <svg className={`${size === "large" ? "w-32 h-32" : "w-16 h-16"} transform -rotate-90`}>
          <circle
            cx={size === "large" ? "64" : "32"}
            cy={size === "large" ? "64" : "32"}
            r={size === "large" ? "56" : "28"}
            stroke="currentColor"
            strokeWidth={size === "large" ? "8" : "4"}
            fill="transparent"
            className="text-muted/30"
          />
          <circle
            cx={size === "large" ? "64" : "32"}
            cy={size === "large" ? "64" : "32"}
            r={size === "large" ? "56" : "28"}
            stroke="currentColor"
            strokeWidth={size === "large" ? "8" : "4"}
            fill="transparent"
            strokeDasharray={size === "large" ? "352" : "176"}
            strokeDashoffset={size === "large" ? 352 - (352 * score) / 100 : 176 - (176 * score) / 100}
            className={getColor(score)}
            strokeLinecap="round"
          />
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

function BreakdownBar({ label, score, max, tooltip }: { label: string; score: number; max: number; tooltip: string }) {
  const percent = (score / max) * 100;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center">
          {label}
          <InfoTooltip content={tooltip} />
        </span>
        <span className="font-medium">{score.toFixed(1)} / {max}</span>
      </div>
      <Progress value={percent} className="h-2" />
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: "LOW" | "MEDIUM" | "HIGH" }) {
  const variants: Record<string, { className: string; label: string }> = {
    LOW: { className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", label: "Low Confidence" },
    MEDIUM: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", label: "Medium Confidence" },
    HIGH: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "High Confidence" },
  };
  
  const { className, label } = variants[confidence];
  
  return (
    <Badge variant="outline" className={`${className} border-0 text-xs`}>
      {label}
    </Badge>
  );
}

function ImpactBadge({ impact }: { impact: "HIGH" | "MEDIUM" | "LOW" }) {
  const variants: Record<string, string> = {
    HIGH: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    LOW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  };
  
  return (
    <Badge variant="outline" className={`${variants[impact]} border-0 text-xs`}>
      {impact}
    </Badge>
  );
}

export default function PremiumDashboard() {
  const { toast } = useToast();
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [sizeBand, setSizeBand] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  const { data: readinessData, isLoading: readinessLoading, refetch: refetchReadiness } = useQuery<ReadinessData>({
    queryKey: ["/api/readiness"],
  });

  const { data: profileData } = useQuery<OrgProfileData>({
    queryKey: ["/api/org-profile"],
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { orgName: string; industry: string; companySizeBand: string }) => {
      const res = await apiRequest("POST", "/api/org-profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/readiness"] });
      setShowSetup(false);
      toast({ title: "Profile Updated", description: "Your organization profile has been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const recomputeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/readiness/recompute");
      return res.json();
    },
    onSuccess: () => {
      refetchReadiness();
      toast({ title: "Score Recomputed", description: "Your AI Readiness Score has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveProfile = () => {
    if (!orgName || !industry || !sizeBand) {
      toast({ title: "Missing Fields", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    updateProfileMutation.mutate({ orgName, industry, companySizeBand: sizeBand });
  };

  if (readinessLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const data = readinessData;
  const profile = data?.orgProfile || profileData?.profile;

  return (
    <TooltipProvider>
      <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="premium-dashboard">
        {/* Top Context Bar */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/5 to-card">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-go-workspace">
                    <ArrowLeft className="w-4 h-4" />
                    Go to Workspace
                  </Button>
                </Link>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="font-semibold" data-testid="text-org-name">
                    {profile?.orgName || "Your Organization"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {profile?.industry && profile?.companySizeBand 
                      ? `${profileData?.industries?.find(i => i.value === profile.industry)?.label || profile.industry} | ${profileData?.sizeBands?.find(s => s.value === profile.companySizeBand)?.label || profile.companySizeBand}`
                      : "Set up your organization profile"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary text-primary">
                  Premium Organisation
                </Badge>
                <Link href="/ai-readiness/qa">
                  <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-ai-readiness-guide">
                    <HelpCircle className="w-4 h-4" />
                    AI Readiness Guide
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSetup(!showSetup)}
                  data-testid="button-edit-profile"
                >
                  {showSetup ? "Cancel" : "Edit Profile"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => recomputeMutation.mutate()}
                  disabled={recomputeMutation.isPending}
                  data-testid="button-refresh-score"
                >
                  {recomputeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {showSetup && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Organization Name</label>
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Enter organization name"
                      data-testid="input-org-name"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Industry</label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger data-testid="select-industry">
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {profileData?.industries?.map((ind) => (
                          <SelectItem key={ind.value} value={ind.value}>
                            {ind.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Company Size</label>
                    <Select value={sizeBand} onValueChange={setSizeBand}>
                      <SelectTrigger data-testid="select-size-band">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {profileData?.sizeBands?.map((size) => (
                          <SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save Profile
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hero Card: AI Readiness Score */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              AI Readiness Score
              <InfoTooltip content="This score measures how prepared your document knowledge base is for AI-assisted workflows. It reflects coverage, structure, retrieval quality, freshness, and adoption patterns. It does NOT indicate automation readiness, correctness, or compliance." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <ScoreGauge score={data?.scoreTotal || 0} />
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-lg font-medium" data-testid="text-score-description">
                    {data?.description || "Loading..."}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <ConfidenceBadge confidence={data?.confidence || "LOW"} />
                    {data?.lastUpdated && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last updated: {new Date(data.lastUpdated).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                
                {data?.benchmarkRange && (
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center">
                      <Users className="w-3 h-3 mr-1" />
                      Compared to similar organisations
                      <InfoTooltip content="Not a market survey. Based on internal readiness templates for organizations of similar industry and size." />
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        Estimated typical range (template-based): <strong>{data.benchmarkRange[0]}–{data.benchmarkRange[1]}%</strong>
                      </span>
                    </div>
                    <p className="text-sm">
                      You: <strong className="text-primary">{Math.round(data.scoreTotal)}%</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Breakdown Card */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileStack className="w-4 h-4 text-primary" />
                Readiness Breakdown
                <InfoTooltip content="Each component contributes to your overall score. Focus on areas with lower scores to improve AI readiness." />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data?.breakdown && (
                <>
                  <BreakdownBar
                    label="Coverage"
                    score={data.breakdown.coverage.score}
                    max={data.breakdown.coverage.max}
                    tooltip="Measures how many documents you've uploaded relative to your target, minus penalties for missing context responses."
                  />
                  <BreakdownBar
                    label="Structure"
                    score={data.breakdown.structure.score}
                    max={data.breakdown.structure.max}
                    tooltip="Measures how many documents have been processed with structured extraction (e.g., obligations, summaries)."
                  />
                  <BreakdownBar
                    label="Retrieval Quality"
                    score={data.breakdown.retrieval.score}
                    max={data.breakdown.retrieval.max}
                    tooltip="Ratio of questions that received answers with citations vs. questions that returned 'not found' responses."
                  />
                  <BreakdownBar
                    label="Freshness & Governance"
                    score={data.breakdown.freshness.score}
                    max={data.breakdown.freshness.max}
                    tooltip="Measures document metadata completeness minus penalties for detected conflicts."
                  />
                  <BreakdownBar
                    label="Adoption & Workflow"
                    score={data.breakdown.adoption.score}
                    max={data.breakdown.adoption.max}
                    tooltip="Points for enabled reports, running reports, and consistent usage patterns."
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                Recommended Next Actions
              </CardTitle>
              <CardDescription>Top 3 actions to improve your AI readiness</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.recommendedActions && data.recommendedActions.length > 0 ? (
                data.recommendedActions.map((action, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 rounded-lg bg-muted/50 space-y-1"
                    data-testid={`action-item-${idx}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{action.label}</span>
                      <ImpactBadge impact={action.impact} />
                    </div>
                    <p className="text-xs text-muted-foreground">{action.explanation}</p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No specific actions needed. Keep up the good work!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scheduled Reports Card */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Scheduled Reports
                <InfoTooltip content="Reports help monitor knowledge quality without manual review. Enable weekly or monthly reports to track progress." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 text-center">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground mb-3">
                  Configure scheduled reports in the Premium Org panel on your main dashboard.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/" data-testid="link-to-dashboard">Go to Dashboard</a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Training Data Preparation Card */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" />
                Training Data Preparation
                <InfoTooltip content="Training-ready documents have structured outputs suitable for internal copilots or downstream systems. Review before use." />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">AI-Prepared documents</span>
                  <span className="font-medium">{Math.round(data?.aiPreparedPercent || 0)}%</span>
                </div>
                <Progress value={data?.aiPreparedPercent || 0} className="h-3" />
              </div>
              <p className="text-xs text-muted-foreground">
                Export training data from the Premium Org panel on your main dashboard.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="/" data-testid="link-export-training">Go to Export</a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Knowledge Extractability Card */}
        <ExtractabilityCard workspaceId="default" />

        {/* Trust Footer Disclaimer */}
        <Card className="border-0 bg-muted/30">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground text-center">
              <AlertCircle className="w-3 h-3 inline-block mr-1" />
              <strong>Important:</strong> Evident supports gradual AI adoption. Scores indicate preparedness of information — not automation readiness, correctness, or compliance. Human review is recommended.
            </p>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
