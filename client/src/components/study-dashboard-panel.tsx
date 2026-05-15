import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StudyMaterialRenderer } from "@/components/study-material-renderer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  BookOpen,
  Target,
  TrendingUp,
  TrendingDown,
  FileText,
  Zap,
  BarChart3,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Brain,
  Flame,
  Play,
  Eye,
  Activity,
  Award,
  CheckCircle2,
  Calendar,
  Timer,
  X,
  Map,
  GraduationCap,
  RotateCcw,
  History,
  Archive,
  HelpCircle,
  Printer,
  Download,
  ChevronRight,
} from "lucide-react";

interface StudyDashboardPanelProps {
  selectedAssetIds: string[];
  expanded?: boolean;
  onToggleExpand?: () => void;
  collapsible?: boolean;
}

interface WeakTopic {
  topic: string;
  accuracy: number;
  totalQuestions: number;
  recentAccuracy: number;
  subtopics: { subtopic: string; accuracy: number; count: number }[];
}

interface OverconfidenceAlert {
  topic: string;
  easyAccuracy: number;
  hardAccuracy: number;
  gap: number;
  totalEasy: number;
  totalHard: number;
}

interface DailyTrend {
  date: string;
  score: number;
  quizCount: number;
}

interface ConfidenceCalibration {
  highConfidentWrong: number;
  highConfidentTotal: number;
  lowConfidentRight: number;
  lowConfidentTotal: number;
  totalWithConfidence: number;
}

interface RecentActivityItem {
  id: string;
  quizId: string;
  title: string;
  score: number;
  maxScore: number;
  percentage: number;
  completedAt: string;
  timeUsedSeconds: number;
}

interface TopicBreakdownItem {
  topic: string;
  accuracy: number;
  totalQuestions: number;
  recentAccuracy: number;
  subtopics: { subtopic: string; accuracy: number; count: number }[];
}

interface OverviewData {
  readinessScore: number;
  totalQuizzes: number;
  totalQuestions: number;
  averageScore: number;
  weakTopics: WeakTopic[];
  recentActivity: RecentActivityItem[];
  topicBreakdown: TopicBreakdownItem[];
  trend7d: number | null;
  trend30d: number | null;
  overconfidenceAlerts: OverconfidenceAlert[];
  dailyTrend: DailyTrend[];
  confidenceCalibration: ConfidenceCalibration;
}

interface WrongAnswer {
  answer_id: string;
  question_id: string;
  user_answer: string;
  score: number;
  max_marks: number;
  feedback: string;
  is_correct: boolean;
  confidence: string | null;
  question_text: string;
  question_type: string;
  model_answer: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  options: string[] | null;
  source_ref: string | null;
  completed_at: string;
  quiz_title: string;
}

interface QuizHistoryItem {
  id: string;
  quizId: string;
  title: string;
  score: number;
  maxScore: number;
  percentage: number;
  completedAt: string;
  timeUsedSeconds: number;
  questionCount: number;
  questionType: string;
}

type TabId = "readiness" | "weakTopics" | "alerts" | "trends" | "countdown" | "journey" | "materials";

interface StudyMaterialItem {
  id: string;
  type: string;
  title: string;
  sourceDocumentId: string | null;
  createdAt: string;
}

interface StudyTimerStats {
  todaySeconds: number;
  weekSeconds: number;
  totalSeconds: number;
  streak: number;
  byFolder: { folderId: string; folderName: string; seconds: number }[];
  activeSession: any;
}

function formatStudyTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function getTimerAchievementTier(seconds: number): { tier: string; color: string; bgColor: string } | null {
  const hours = seconds / 3600;
  if (hours >= 4) return { tier: "Gold", color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-500/15" };
  if (hours >= 3) return { tier: "Silver", color: "text-slate-500 dark:text-slate-300", bgColor: "bg-slate-100 dark:bg-slate-500/15" };
  if (hours >= 2) return { tier: "Bronze", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-500/15" };
  return null;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function accuracyColor(accuracy: number): string {
  if (accuracy >= 70) return "text-emerald-700 dark:text-emerald-400";
  if (accuracy >= 50) return "text-amber-700 dark:text-amber-400";
  return "text-rose-700 dark:text-rose-400";
}

function accuracyBg(accuracy: number): string {
  if (accuracy >= 70) return "bg-emerald-500";
  if (accuracy >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function accuracyBgLight(accuracy: number): string {
  if (accuracy >= 70) return "bg-emerald-100 dark:bg-emerald-500/15";
  if (accuracy >= 50) return "bg-amber-100 dark:bg-amber-500/15";
  return "bg-rose-100 dark:bg-rose-500/15";
}

function strokeColor(score: number): string {
  if (score > 70) return "stroke-emerald-500";
  if (score >= 50) return "stroke-amber-500";
  return "stroke-rose-500";
}

function ReadinessRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = 45;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const viewBox = "0 0 100 100";

  return (
    <div className="flex flex-col items-center" data-testid="readiness-ring">
      <svg width={size} height={size} viewBox={viewBox}>
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          className="stroke-muted"
          strokeWidth="8"
        />
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          className={strokeColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        <text
          x="50" y="46"
          textAnchor="middle"
          className="fill-foreground font-bold"
          fontSize="24"
        >
          {score}
        </text>
        <text
          x="50" y="62"
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="10"
        >
          Readiness
        </text>
      </svg>
    </div>
  );
}

function MiniBarChart({ data }: { data: DailyTrend[] }) {
  const dayLabels = data.map(d => {
    const date = new Date(d.date + "T12:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short" });
  });

  return (
    <div className="flex items-end gap-1.5 h-28 w-full rounded-md bg-muted/40 dark:bg-muted/20 p-2 pt-4 overflow-hidden" data-testid="trend-bar-chart">
      {data.map((d, i) => {
        const heightPct = d.quizCount > 0 ? Math.max((d.score / 100) * 100, 12) : 6;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] font-medium text-foreground/80 dark:text-muted-foreground">
              {d.quizCount > 0 ? `${d.score}%` : ""}
            </span>
            <div className="w-full flex items-end justify-center" style={{ height: "60px" }}>
              <div
                className={`w-full max-w-[28px] rounded-t-sm transition-all ${
                  d.quizCount > 0 ? accuracyBg(d.score) : "bg-muted-foreground/20"
                }`}
                style={{ height: `${heightPct}%`, minHeight: "3px", opacity: d.quizCount > 0 ? 0.9 : 0.3 }}
              />
            </div>
            <span className="text-[10px] font-medium text-foreground/80 dark:text-muted-foreground">{dayLabels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

const tabConfig: Record<TabId, { label: string; description: string; icon: typeof BarChart3; color: string; activeBg: string }> = {
  readiness: { label: "Ready", description: "Your current exam readiness", icon: Target, color: "text-violet-600 dark:text-violet-400", activeBg: "bg-violet-100 dark:bg-violet-500/15" },
  weakTopics: { label: "Focus", description: "Topics requiring attention", icon: Brain, color: "text-amber-600 dark:text-amber-400", activeBg: "bg-amber-100 dark:bg-amber-500/15" },
  alerts: { label: "Alerts", description: "Performance risks detected", icon: Flame, color: "text-rose-600 dark:text-rose-400", activeBg: "bg-rose-100 dark:bg-rose-500/15" },
  trends: { label: "Trends", description: "Progress over time", icon: Activity, color: "text-sky-600 dark:text-sky-400", activeBg: "bg-sky-100 dark:bg-sky-500/15" },
  countdown: { label: "Exam", description: "Date & training phase", icon: Timer, color: "text-cyan-600 dark:text-cyan-400", activeBg: "bg-cyan-100 dark:bg-cyan-500/15" },
  journey: { label: "Journey", description: "Learn, Practice, Refine, Master", icon: Map, color: "text-indigo-600 dark:text-indigo-400", activeBg: "bg-indigo-100 dark:bg-indigo-500/15" },
  materials: { label: "My Notes", description: "Saved guides & flashcards", icon: BookOpen, color: "text-emerald-600 dark:text-emerald-400", activeBg: "bg-emerald-100 dark:bg-emerald-500/15" },
};

interface StudyCycle {
  id: string;
  cycleNumber: number;
  examDate: string | null;
  startedAt: string;
  endedAt: string | null;
  status: string;
  finalReadinessScore: number | null;
  totalQuizzes: number | null;
  totalQuestions: number | null;
  averageScore: number | null;
}

export function StudyDashboardPanel({ selectedAssetIds, expanded = false, onToggleExpand, collapsible = false }: StudyDashboardPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("readiness");
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [showCycleHistory, setShowCycleHistory] = useState(false);
  const [showNewCycleConfirm, setShowNewCycleConfirm] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false;
    try { return localStorage.getItem("evident_study_fitness_collapsed") === "true"; } catch { return false; }
  });

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("evident_study_fitness_collapsed", String(next)); } catch {}
  };

  const { data: cycleData } = useQuery<{ cycle: StudyCycle }>({
    queryKey: ["/api/study-dashboard/cycle"],
  });

  const { data: cycleHistoryData } = useQuery<{ cycles: StudyCycle[] }>({
    queryKey: ["/api/study-dashboard/cycle-history"],
    enabled: showCycleHistory || expanded,
  });

  const newCycleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/study-dashboard/cycle/new", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-dashboard/cycle"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study-dashboard/cycle-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study-dashboard/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study-dashboard/wrong-answers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study-dashboard/quiz-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study-dashboard/journey"] });
      setShowNewCycleConfirm(false);
      setActiveTab("readiness");
      toast({ title: "New cycle started", description: "Your previous cycle has been archived. Fresh start!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start new cycle", description: error.message, variant: "destructive" });
    },
  });

  const activeCycle = cycleData?.cycle;
  const pastCycles = cycleHistoryData?.cycles?.filter(c => c.status === "completed") || [];

  const { data: overview, isLoading: overviewLoading } = useQuery<OverviewData>({
    queryKey: ["/api/study-dashboard/overview"],
  });

  const { data: wrongAnswersData, isLoading: wrongAnswersLoading } = useQuery<{ wrongAnswers: WrongAnswer[] }>({
    queryKey: ["/api/study-dashboard/wrong-answers"],
    enabled: activeTab === "alerts" || expanded,
  });

  const { data: quizHistoryData, isLoading: quizHistoryLoading } = useQuery<{ history: QuizHistoryItem[] }>({
    queryKey: ["/api/study-dashboard/quiz-history"],
    enabled: activeTab === "trends" || expanded,
  });

  const { data: timerStats } = useQuery<StudyTimerStats>({
    queryKey: ["/api/study-sessions/stats"],
    refetchInterval: user ? 60000 : false,
    enabled: !!user,
  });

  const { data: studyMaterialsList = [], isLoading: materialsLoading } = useQuery<StudyMaterialItem[]>({
    queryKey: ["/api/study"],
    enabled: activeTab === "materials" || expanded,
  });

  const practiceWeaknessMutation = useMutation({
    mutationFn: async () => {
      if (!overview?.weakTopics?.length) throw new Error("No weak topics found");
      if (!selectedAssetIds.length) throw new Error("No documents selected");
      const res = await apiRequest("POST", "/api/study-dashboard/practice-weakness", {
        topics: overview.weakTopics.map(t => t.topic),
        documentIds: selectedAssetIds,
        questionCount: 5,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-dashboard/quiz-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study-dashboard/overview"] });
      toast({
        title: "Practice quiz generated",
        description: data.quiz?.title || "Your weakness practice quiz is ready",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate practice", description: error.message, variant: "destructive" });
    },
  });

  const toggleTopic = (topic: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  if (overviewLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="loading-spinner" />
        </CardContent>
      </Card>
    );
  }

  const hasData = overview && overview.totalQuizzes > 0;

  return (
    <Card className={`${expanded ? "border-0 shadow-none" : ""} w-full max-w-full`}>
      <CardContent className={`${expanded ? "p-0" : "p-3"}`}>
        <div className="flex flex-col gap-3 min-w-0 w-full">
          <div className="flex items-center justify-between gap-2">
            <button
              className={`flex items-center gap-2 ${collapsible ? "hover-elevate rounded-md px-1 py-0.5 -mx-1" : ""}`}
              onClick={collapsible ? toggleCollapsed : undefined}
              data-testid="button-toggle-study-fitness-collapse"
            >
              <div className="h-6 w-6 rounded-md bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
                <Activity className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <h2 className="text-sm font-semibold" data-testid="text-dashboard-title">Study Fitness</h2>
              {collapsible && (
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${collapsed ? "" : "rotate-180"}`} />
              )}
            </button>
            <div className="flex items-center gap-1">
              {onToggleExpand && !collapsed && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onToggleExpand}
                  data-testid="button-toggle-expand"
                >
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          {!collapsed && (
            <>
              {activeCycle && (
                <div className="flex items-center justify-between gap-2 px-1" data-testid="cycle-indicator">
                  <div className="flex items-center gap-1.5">
                    <RotateCcw className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-foreground/80 dark:text-muted-foreground">
                      Cycle {activeCycle.cycleNumber}
                      {activeCycle.examDate && (() => {
                        const d = new Date(activeCycle.examDate);
                        return ` \u00b7 ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {pastCycles.length > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setShowCycleHistory(!showCycleHistory)}
                        data-testid="button-cycle-history"
                      >
                        <History className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {hasData && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowNewCycleConfirm(true)}
                        className="h-6 text-[10px] px-2"
                        data-testid="button-new-cycle"
                      >
                        New cycle
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {showNewCycleConfirm && (
                <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2" data-testid="new-cycle-confirm">
                  <p className="text-xs text-foreground font-medium">Start a new study cycle?</p>
                  <p className="text-[11px] text-foreground/80 dark:text-muted-foreground">Your current progress will be archived. You'll start fresh with a clean slate while your history is preserved.</p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => newCycleMutation.mutate()}
                      disabled={newCycleMutation.isPending}
                      data-testid="button-confirm-new-cycle"
                    >
                      {newCycleMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Start fresh"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowNewCycleConfirm(false)}
                      data-testid="button-cancel-new-cycle"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {showCycleHistory && pastCycles.length > 0 && (
                <div className="rounded-md bg-muted/40 dark:bg-muted/20 p-2 space-y-1.5" data-testid="cycle-history-panel">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground/80 dark:text-muted-foreground">Past Cycles</span>
                    <Button size="icon" variant="ghost" onClick={() => setShowCycleHistory(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {pastCycles.map(cycle => (
                    <div key={cycle.id} className="flex items-center justify-between gap-2 rounded-md bg-background/60 dark:bg-background/30 px-2 py-1.5" data-testid={`past-cycle-${cycle.cycleNumber}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Archive className="h-3 w-3 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[11px] font-medium block truncate">
                            Cycle {cycle.cycleNumber}
                            {cycle.examDate && (() => {
                              const d = new Date(cycle.examDate);
                              return ` \u2014 ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
                            })()}
                          </span>
                          <span className="text-[10px] text-foreground/80 dark:text-muted-foreground block">
                            {cycle.totalQuizzes || 0} quizzes
                            {cycle.averageScore != null ? ` \u00b7 ${Math.round(cycle.averageScore)}% avg` : ""}
                          </span>
                        </div>
                      </div>
                      {cycle.finalReadinessScore != null && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {Math.round(cycle.finalReadinessScore)}%
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-1.5" data-testid="study-timer-stats">
                <div className="p-2 rounded-md border text-center" data-testid="stat-timer-today">
                  <p className={`text-sm font-bold ${(timerStats?.todaySeconds || 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {formatStudyTime(timerStats?.todaySeconds || 0)}
                  </p>
                  <p className="text-[10px] text-foreground/80 dark:text-muted-foreground">Today</p>
                </div>
                <div className="p-2 rounded-md border text-center" data-testid="stat-timer-week">
                  <p className={`text-sm font-bold ${(timerStats?.weekSeconds || 0) > 0 ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground"}`}>
                    {formatStudyTime(timerStats?.weekSeconds || 0)}
                  </p>
                  <p className="text-[10px] text-foreground/80 dark:text-muted-foreground">This Week</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-2 rounded-md border text-center cursor-help" data-testid="stat-timer-streak">
                      <div className="flex items-center justify-center gap-0.5">
                        <Flame className={`w-3 h-3 ${(timerStats?.streak || 0) > 0 ? "text-orange-500 dark:text-orange-400" : "text-muted-foreground"}`} />
                        <p className={`text-sm font-bold ${(timerStats?.streak || 0) > 0 ? "text-orange-500 dark:text-orange-400" : "text-muted-foreground"}`}>
                          {timerStats?.streak || 0}
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-0.5">
                        <p className="text-[10px] text-foreground/80 dark:text-muted-foreground">Streak</p>
                        <HelpCircle className="w-2.5 h-2.5 text-muted-foreground" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-center">
                    <p className="text-xs font-medium">
                      {(timerStats?.streak || 0) === 0
                        ? "Study today to start your streak! Consistency is key to mastering any subject."
                        : (timerStats?.streak || 0) < 3
                          ? "You're building momentum! Keep studying daily to grow your streak."
                          : (timerStats?.streak || 0) < 7
                            ? "Great consistency! You're forming a solid study habit."
                            : "Amazing dedication! Your daily streak shows real commitment."}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">Days you've studied in a row</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {getTimerAchievementTier(timerStats?.todaySeconds || 0) && (
                <div className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md ${getTimerAchievementTier(timerStats?.todaySeconds || 0)?.bgColor} border`} data-testid="timer-achievement">
                  <Award className={`w-3.5 h-3.5 ${getTimerAchievementTier(timerStats?.todaySeconds || 0)?.color}`} />
                  <span className={`text-xs font-bold ${getTimerAchievementTier(timerStats?.todaySeconds || 0)?.color}`}>
                    {getTimerAchievementTier(timerStats?.todaySeconds || 0)?.tier} Today!
                  </span>
                </div>
              )}

              <div className={`${expanded ? "flex gap-3" : "flex flex-col gap-3"}`}>
                <div className={`flex flex-col gap-1 rounded-md bg-muted/50 dark:bg-muted/30 p-1 ${expanded ? "w-44 shrink-0" : "w-full"}`} data-testid="tab-bar">
                  {(Object.keys(tabConfig) as TabId[]).map(tabId => {
                    const cfg = tabConfig[tabId];
                    const Icon = cfg.icon;
                    const isActive = activeTab === tabId;
                    return (
                      <button
                        key={tabId}
                        onClick={() => setActiveTab(tabId)}
                        title={cfg.description}
                        className={`group flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-md transition-all text-left ${
                          isActive
                            ? `${cfg.activeBg} ${cfg.color} shadow-sm`
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`tab-${tabId}`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-[11px] leading-tight">{cfg.label}</span>
                          <span className={`truncate text-xs font-normal leading-tight ${isActive ? "opacity-85" : "opacity-70"}`}>{cfg.description}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className={`min-w-0 flex-1 max-w-full ${expanded ? "max-h-none" : "max-h-[500px] overflow-y-auto"}`} style={{ WebkitOverflowScrolling: "touch" }}>
                  {activeTab === "readiness" && (
                    <ReadinessTab overview={overview} hasData={hasData} expanded={expanded} />
                  )}
                  {activeTab === "weakTopics" && (
                    <WeakTopicsTab
                      overview={overview}
                      hasData={hasData}
                      expanded={expanded}
                      practiceWeaknessMutation={practiceWeaknessMutation}
                      selectedAssetIds={selectedAssetIds}
                      expandedTopics={expandedTopics}
                      toggleTopic={toggleTopic}
                    />
                  )}
                  {activeTab === "alerts" && (
                    <AlertsTab
                      overview={overview}
                      hasData={hasData}
                      expanded={expanded}
                      wrongAnswers={wrongAnswersData?.wrongAnswers}
                      wrongAnswersLoading={wrongAnswersLoading}
                    />
                  )}
                  {activeTab === "trends" && (
                    <TrendsTab
                      overview={overview}
                      hasData={hasData}
                      expanded={expanded}
                      quizHistory={quizHistoryData?.history}
                      quizHistoryLoading={quizHistoryLoading}
                    />
                  )}
                  {activeTab === "countdown" && (
                    <CountdownTab overview={overview} hasData={hasData} expanded={expanded} />
                  )}
                  {activeTab === "journey" && (
                    <JourneyTab expanded={expanded} />
                  )}
                  {activeTab === "materials" && (
                    <MaterialsTab materials={studyMaterialsList} isLoading={materialsLoading} expanded={expanded} />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReadinessTab({ overview, hasData, expanded }: { overview?: OverviewData; hasData: boolean | undefined; expanded: boolean }) {
  if (!hasData || !overview) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4 text-center px-4">
        <div className="h-12 w-12 rounded-full bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
          <Activity className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div data-testid="text-empty-overview">
          <p className="text-sm font-medium text-foreground">Study Fitness activates with quiz activity</p>
          <p className="text-xs text-foreground/80 dark:text-muted-foreground mt-1.5 max-w-xs mx-auto">
            Your readiness score, topic breakdown, trends, and weak areas will all appear here once you start taking quizzes.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs text-left mt-1">
          <div className="flex items-start gap-2.5 text-xs">
            <div className="h-5 w-5 rounded-full bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">1</span>
            </div>
            <span className="text-foreground/80 dark:text-muted-foreground">Upload a document you want to study</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs">
            <div className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">2</span>
            </div>
            <span className="text-foreground/80 dark:text-muted-foreground">Use Exam Prep to generate a quiz from it</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs">
            <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">3</span>
            </div>
            <span className="text-foreground/80 dark:text-muted-foreground">Complete the quiz and your fitness tracker lights up</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center py-2">
        <ReadinessRing score={overview.readinessScore} size={expanded ? 160 : 110} />
      </div>

      <div className={`grid gap-2 ${expanded ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
        <StatCard label="Quizzes" value={overview.totalQuizzes} testId="stat-total-quizzes" icon={FileText} iconColor="text-indigo-600 dark:text-indigo-400" iconBg="bg-indigo-100 dark:bg-indigo-500/15" />
        <StatCard label="Questions" value={overview.totalQuestions} testId="stat-total-questions" icon={Zap} iconColor="text-amber-600 dark:text-amber-400" iconBg="bg-amber-100 dark:bg-amber-500/15" />
        <StatCard label="Avg Score" value={`${overview.averageScore}%`} testId="stat-avg-score" color={accuracyColor(overview.averageScore)} bgTint={accuracyBgLight(overview.averageScore)} icon={Award} iconColor={accuracyColor(overview.averageScore)} />
        <StatCard
          label="7-Day Avg"
          value={overview.trend7d !== null ? `${overview.trend7d}%` : "--"}
          testId="stat-trend-7d"
          color={overview.trend7d !== null ? accuracyColor(overview.trend7d) : undefined}
          bgTint={overview.trend7d !== null ? accuracyBgLight(overview.trend7d) : undefined}
          icon={TrendingUp}
          iconColor={overview.trend7d !== null ? accuracyColor(overview.trend7d) : "text-muted-foreground"}
        />
      </div>

      {overview.confidenceCalibration?.totalWithConfidence > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-foreground dark:text-muted-foreground uppercase tracking-wide">Confidence Calibration</h3>
          <div className={`grid gap-2 ${expanded ? "grid-cols-2" : "grid-cols-1"}`}>
            {overview.confidenceCalibration.highConfidentWrong > 0 && (
              <div className="flex items-start gap-2.5 p-3 rounded-md bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20" data-testid="text-overconfident-count">
                <div className="h-7 w-7 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="text-sm">
                  <span className="font-bold text-rose-700 dark:text-rose-400">{overview.confidenceCalibration.highConfidentWrong}</span>
                  <span className="text-rose-600/80 dark:text-rose-300/70"> times highly confident but wrong</span>
                </div>
              </div>
            )}
            {overview.confidenceCalibration.lowConfidentRight > 0 && (
              <div className="flex items-start gap-2.5 p-3 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20" data-testid="text-underconfident-count">
                <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-sm">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{overview.confidenceCalibration.lowConfidentRight}</span>
                  <span className="text-emerald-600/80 dark:text-emerald-300/70"> times low confidence but correct</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {overview.recentActivity.length > 0 && expanded && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-foreground dark:text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Recent Activity
          </h3>
          {overview.recentActivity.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 p-3 rounded-md border flex-wrap"
              data-testid={`activity-item-${item.id}`}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium truncate">{item.title}</span>
                <div className="flex items-center gap-2 text-xs text-foreground/80 dark:text-muted-foreground flex-wrap">
                  <span>{formatRelativeDate(item.completedAt)}</span>
                  <span>{formatDuration(item.timeUsedSeconds)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground/80 dark:text-muted-foreground">
                  {item.score}/{item.maxScore}
                </span>
                <span className={`text-sm font-bold ${accuracyColor(item.percentage)}`}>
                  {item.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, testId, color, bgTint, icon: Icon, iconColor, iconBg }: {
  label: string;
  value: string | number;
  testId: string;
  color?: string;
  bgTint?: string;
  icon?: typeof BarChart3;
  iconColor?: string;
  iconBg?: string;
}) {
  return (
    <div className={`p-2.5 rounded-md border text-center ${bgTint || ""}`}>
      {Icon && (
        <div className="flex justify-center mb-1">
          <div className={`h-5 w-5 rounded-full ${iconBg || "bg-muted"} flex items-center justify-center`}>
            <Icon className={`h-3 w-3 ${iconColor || "text-muted-foreground"}`} />
          </div>
        </div>
      )}
      <div className={`text-lg font-bold ${color || ""}`} data-testid={testId}>{value}</div>
      <div className="text-xs text-foreground/80 dark:text-muted-foreground">{label}</div>
    </div>
  );
}

function WeakTopicsTab({
  overview,
  hasData,
  expanded,
  practiceWeaknessMutation,
  selectedAssetIds,
  expandedTopics,
  toggleTopic,
}: {
  overview?: OverviewData;
  hasData: boolean | undefined;
  expanded: boolean;
  practiceWeaknessMutation: ReturnType<typeof useMutation<any, Error, void>>;
  selectedAssetIds: string[];
  expandedTopics: Set<string>;
  toggleTopic: (topic: string) => void;
}) {
  if (!hasData || !overview) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
        <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
          <Brain className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Your weak topics will appear here</p>
          <p className="text-xs text-foreground/80 dark:text-muted-foreground mt-1">After completing quizzes, this tab highlights the topics you need to focus on most, ranked by accuracy.</p>
        </div>
      </div>
    );
  }

  const weakTopics = overview.weakTopics.slice(0, expanded ? undefined : 3);
  const allTopics = overview.topicBreakdown;

  return (
    <div className="flex flex-col gap-3">
      {weakTopics.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
                <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              </div>
              {expanded ? "All Weak Topics" : "Top 3 Weak Areas"}
            </h3>
            <Button
              size="sm"
              onClick={() => practiceWeaknessMutation.mutate()}
              disabled={
                practiceWeaknessMutation.isPending ||
                !overview.weakTopics.length ||
                !selectedAssetIds.length
              }
              data-testid="button-practice-weaknesses"
            >
              {practiceWeaknessMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Target className="h-4 w-4 mr-1.5" />
              )}
              Practice
            </Button>
          </div>

          {weakTopics.map((topic) => (
            <div key={topic.topic} className="rounded-md border overflow-hidden">
              <button
                className="w-full flex items-center justify-between gap-2 p-3 text-left hover-elevate"
                onClick={() => toggleTopic(topic.topic)}
                data-testid={`button-weak-topic-${topic.topic}`}
              >
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium" data-testid={`text-weak-topic-${topic.topic}`}>
                      {topic.topic}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${accuracyColor(topic.accuracy)}`}>
                        {topic.accuracy}%
                      </span>
                      {expandedTopics.has(topic.topic) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${accuracyBg(topic.accuracy)}`}
                      style={{ width: `${topic.accuracy}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-foreground/80 dark:text-muted-foreground flex-wrap">
                    <span>{topic.totalQuestions} questions</span>
                    {topic.recentAccuracy > 0 && (
                      <span className="flex items-center gap-1">
                        Recent: <span className={`font-medium ${accuracyColor(topic.recentAccuracy)}`}>{topic.recentAccuracy}%</span>
                      </span>
                    )}
                  </div>
                </div>
              </button>
              {expandedTopics.has(topic.topic) && topic.subtopics.length > 0 && (
                <div className="px-3 pb-3 flex flex-col gap-1">
                  {topic.subtopics.map((sub) => (
                    <div
                      key={sub.subtopic}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/60 dark:bg-muted/30"
                    >
                      <span className="text-xs truncate">{sub.subtopic}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-foreground/80 dark:text-muted-foreground">({sub.count})</span>
                        <span className={`text-xs font-bold ${accuracyColor(sub.accuracy)}`}>
                          {sub.accuracy}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {expanded && allTopics.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            All Topics
          </h3>
          {allTopics.map((topic) => (
            <div key={topic.topic} className="rounded-md border overflow-hidden">
              <button
                className="w-full flex items-center justify-between gap-2 p-3 text-left hover-elevate"
                onClick={() => toggleTopic(topic.topic)}
                data-testid={`button-topic-${topic.topic}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{topic.topic}</span>
                  <span className="text-xs text-foreground/80 dark:text-muted-foreground">({topic.totalQuestions})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${accuracyColor(topic.accuracy)}`}>
                    {topic.accuracy}%
                  </span>
                  {expandedTopics.has(topic.topic) ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>
              {expandedTopics.has(topic.topic) && topic.subtopics.length > 0 && (
                <div className="px-3 pb-3 flex flex-col gap-1">
                  {topic.subtopics.map((sub) => (
                    <div
                      key={sub.subtopic}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/60 dark:bg-muted/30"
                    >
                      <span className="text-xs truncate">{sub.subtopic}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-foreground/80 dark:text-muted-foreground">({sub.count})</span>
                        <span className={`text-xs font-bold ${accuracyColor(sub.accuracy)}`}>
                          {sub.accuracy}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {weakTopics.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
            <Target className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm text-foreground/80 dark:text-muted-foreground" data-testid="text-no-weak-topics">
            No weak areas detected — strong across all topics
          </p>
        </div>
      )}
    </div>
  );
}

function AlertsTab({
  overview,
  hasData,
  expanded,
  wrongAnswers,
  wrongAnswersLoading,
}: {
  overview?: OverviewData;
  hasData: boolean | undefined;
  expanded: boolean;
  wrongAnswers?: WrongAnswer[];
  wrongAnswersLoading: boolean;
}) {
  if (!hasData || !overview) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
        <div className="h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center">
          <Flame className="h-6 w-6 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">No performance alerts yet</p>
          <p className="text-xs text-foreground/80 dark:text-muted-foreground mt-1">This tab flags overconfidence gaps, wrong answers you were sure about, and topics that need extra attention.</p>
        </div>
      </div>
    );
  }

  const alerts = overview.overconfidenceAlerts || [];
  const highConfWrong = wrongAnswers?.filter(wa => wa.confidence === "high") || [];
  const videoRewatchItems = wrongAnswers?.filter(wa => wa.source_ref) || [];

  return (
    <div className="flex flex-col gap-4">
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center">
              <Flame className="h-3 w-3 text-orange-600 dark:text-orange-400" />
            </div>
            Overconfidence Alerts
          </h3>
          <p className="text-xs text-foreground/80 dark:text-muted-foreground">
            Topics where you score well on easy questions but struggle with harder ones
          </p>
          {alerts.map((alert) => (
            <div key={alert.topic} className="rounded-md border border-orange-200 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/5 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium">{alert.topic}</span>
                <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400">
                  {alert.gap}pt gap
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground/80 dark:text-muted-foreground">Easy:</span>
                  <span className={`font-bold ${accuracyColor(alert.easyAccuracy)}`}>{alert.easyAccuracy}%</span>
                  <span className="text-foreground/80 dark:text-muted-foreground">({alert.totalEasy}q)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground/80 dark:text-muted-foreground">Hard:</span>
                  <span className={`font-bold ${accuracyColor(alert.hardAccuracy)}`}>{alert.hardAccuracy}%</span>
                  <span className="text-foreground/80 dark:text-muted-foreground">({alert.totalHard}q)</span>
                </div>
              </div>
              <div className="flex gap-0.5 w-full h-2.5 rounded-full overflow-hidden bg-muted/50">
                <div className="bg-emerald-500 rounded-l-full" style={{ width: `${alert.easyAccuracy}%` }} />
                <div className="bg-rose-500 rounded-r-full flex-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {wrongAnswersLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {highConfWrong.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center">
                  <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                </div>
                High Confidence Mistakes
              </h3>
              <p className="text-xs text-foreground/80 dark:text-muted-foreground">
                You felt confident but got these wrong — review carefully
              </p>
              {highConfWrong.slice(0, expanded ? undefined : 3).map((wa) => (
                <div key={wa.answer_id} className="rounded-md border p-3 flex flex-col gap-2">
                  <p className="text-sm font-medium">{wa.question_text}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2 rounded-md bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                      <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mb-0.5">Your Answer</div>
                      <div className="text-sm">{wa.user_answer || "(No answer)"}</div>
                    </div>
                    <div className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                      <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">Correct</div>
                      <div className="text-sm">{wa.model_answer}</div>
                    </div>
                  </div>
                  {wa.source_ref && (
                    <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20">
                      <Play className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span className="text-sky-700 dark:text-sky-300">Rewatch:</span>
                      <span className="font-medium text-sky-800 dark:text-sky-200">{wa.source_ref}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {wa.topic && <Badge variant="secondary">{wa.topic}</Badge>}
                    {wa.difficulty && <Badge variant="outline">{wa.difficulty}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {videoRewatchItems.length > 0 && expanded && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center">
                  <Eye className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                </div>
                Video Rewatch Suggestions
              </h3>
              <p className="text-xs text-foreground/80 dark:text-muted-foreground">
                Questions you got wrong that came from video content — rewatch these sections
              </p>
              {videoRewatchItems.filter(wa => !wa.confidence || wa.confidence !== "high").slice(0, 10).map((wa) => (
                <div
                  key={wa.answer_id}
                  className="flex items-start gap-3 p-3 rounded-md border border-sky-200 dark:border-sky-500/20 bg-sky-50/50 dark:bg-sky-500/5"
                >
                  <div className="h-7 w-7 rounded-full bg-sky-100 dark:bg-sky-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Play className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-sm font-medium truncate">{wa.question_text}</span>
                    <span className="text-xs text-sky-700 dark:text-sky-400 font-medium">{wa.source_ref}</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {wa.topic && <Badge variant="secondary">{wa.topic}</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {alerts.length === 0 && highConfWrong.length === 0 && !wrongAnswersLoading && (
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm text-foreground/80 dark:text-muted-foreground" data-testid="text-no-alerts">
            No alerts — your confidence is well calibrated
          </p>
        </div>
      )}
    </div>
  );
}

function TrendsTab({
  overview,
  hasData,
  expanded,
  quizHistory,
  quizHistoryLoading,
}: {
  overview?: OverviewData;
  hasData: boolean | undefined;
  expanded: boolean;
  quizHistory?: QuizHistoryItem[];
  quizHistoryLoading: boolean;
}) {
  if (!hasData || !overview) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
        <div className="h-12 w-12 rounded-full bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center">
          <Activity className="h-6 w-6 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Your score trends will appear here</p>
          <p className="text-xs text-foreground/80 dark:text-muted-foreground mt-1">Complete a few quizzes to see your 7-day and 30-day performance trends, daily activity, and quiz history.</p>
        </div>
      </div>
    );
  }

  const trend7d = overview.trend7d;
  const trend30d = overview.trend30d;
  const dailyTrend = overview.dailyTrend || [];
  const activeDays = dailyTrend.filter(d => d.quizCount > 0).length;

  return (
    <div className="flex flex-col gap-3 min-w-0 w-full max-w-full overflow-hidden">
      <div className="grid gap-2 grid-cols-3 w-full">
        <div className={`p-2.5 rounded-md border text-center overflow-hidden ${trend7d !== null ? accuracyBgLight(trend7d) : ""}`}>
          <div className={`text-base font-bold flex items-center justify-center gap-1 ${
            trend7d !== null ? accuracyColor(trend7d) : ""
          }`} data-testid="stat-trend-7d-detail">
            {trend7d !== null ? (
              <>
                {trend7d}%
                {trend30d !== null && trend7d > trend30d && <TrendingUp className="h-3.5 w-3.5 shrink-0" />}
                {trend30d !== null && trend7d < trend30d && <TrendingDown className="h-3.5 w-3.5 shrink-0" />}
              </>
            ) : "--"}
          </div>
          <div className="text-[11px] text-foreground/80 dark:text-muted-foreground">7-Day</div>
        </div>
        <div className={`p-2.5 rounded-md border text-center overflow-hidden ${trend30d !== null ? accuracyBgLight(trend30d) : ""}`}>
          <div className={`text-base font-bold ${trend30d !== null ? accuracyColor(trend30d) : ""}`} data-testid="stat-trend-30d">
            {trend30d !== null ? `${trend30d}%` : "--"}
          </div>
          <div className="text-[11px] text-foreground/80 dark:text-muted-foreground">30-Day</div>
        </div>
        <div className="p-2.5 rounded-md border text-center overflow-hidden bg-sky-50 dark:bg-sky-500/10">
          <div className="text-base font-bold text-sky-700 dark:text-sky-400" data-testid="stat-active-days">{activeDays}/7</div>
          <div className="text-[11px] text-foreground/80 dark:text-muted-foreground">Active</div>
        </div>
      </div>

      {dailyTrend.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-foreground dark:text-muted-foreground uppercase tracking-wide">Last 7 Days</h3>
          <MiniBarChart data={dailyTrend} />
        </div>
      )}

      {quizHistoryLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : quizHistory && quizHistory.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-foreground dark:text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Quiz History
          </h3>
          {quizHistory.slice(0, expanded ? undefined : 5).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 p-2.5 rounded-md border"
              data-testid={`history-item-${item.id}`}
            >
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-sm font-medium truncate">{item.title}</span>
                <div className="flex items-center gap-2 text-xs text-foreground/80 dark:text-muted-foreground flex-wrap">
                  <span>{item.questionCount}q</span>
                  <Badge variant="secondary">{item.questionType}</Badge>
                  <span>{formatDuration(item.timeUsedSeconds)}</span>
                  <span>{formatRelativeDate(item.completedAt)}</span>
                </div>
              </div>
              <div className={`text-sm font-bold shrink-0 ${accuracyColor(item.percentage)}`}>
                {item.percentage}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface StudyPhase {
  name: string;
  description: string;
  recommendations: string[];
  color: string;
  bgColor: string;
  borderColor: string;
}

function getStudyPhase(daysRemaining: number): StudyPhase {
  if (daysRemaining > 120) {
    return {
      name: "Foundation",
      description: "Build deep understanding of core concepts",
      recommendations: [
        "Read through all material systematically",
        "Create concept maps and summaries",
        "Focus on understanding, not memorization",
        "Use untimed practice to explore topics",
      ],
      color: "text-sky-700 dark:text-sky-400",
      bgColor: "bg-sky-50 dark:bg-sky-500/10",
      borderColor: "border-sky-200 dark:border-sky-500/20",
    };
  }
  if (daysRemaining > 60) {
    return {
      name: "Strengthening",
      description: "Mix concept review with timed practice",
      recommendations: [
        "Alternate between reading and timed quizzes",
        "Focus extra time on weak topics",
        "Start practicing under time pressure",
        "Review wrong answers thoroughly",
      ],
      color: "text-amber-700 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-500/10",
      borderColor: "border-amber-200 dark:border-amber-500/20",
    };
  }
  if (daysRemaining > 30) {
    return {
      name: "Simulation",
      description: "Shift to exam-condition practice",
      recommendations: [
        "Take timed diagnostics regularly",
        "Simulate full exam sessions",
        "Review high-confidence mistakes",
        "Prioritize weak topics in every session",
      ],
      color: "text-orange-700 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-500/10",
      borderColor: "border-orange-200 dark:border-orange-500/20",
    };
  }
  if (daysRemaining > 7) {
    return {
      name: "Exam Mode",
      description: "Full exam simulations and rapid review",
      recommendations: [
        "Daily timed practice under exam conditions",
        "Focus only on high-impact weak areas",
        "Review all flagged mistakes",
        "Build confidence through repetition",
      ],
      color: "text-rose-700 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-rose-500/10",
      borderColor: "border-rose-200 dark:border-rose-500/20",
    };
  }
  return {
    name: "Final Sprint",
    description: "Light review and rest",
    recommendations: [
      "Quick review of key concepts only",
      "No new material — reinforce what you know",
      "Get proper rest and sleep",
      "Trust your preparation",
    ],
    color: "text-violet-700 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-500/10",
    borderColor: "border-violet-200 dark:border-violet-500/20",
  };
}

function CountdownRing({ daysRemaining, totalDays, size = 120 }: { daysRemaining: number; totalDays: number; size?: number }) {
  const r = 45;
  const circumference = 2 * Math.PI * r;
  const progress = totalDays > 0 ? Math.max(0, Math.min(1, 1 - daysRemaining / totalDays)) : 0;
  const strokeDashoffset = circumference - progress * circumference;

  const ringColor = daysRemaining > 60
    ? "stroke-cyan-500"
    : daysRemaining > 30
      ? "stroke-amber-500"
      : daysRemaining > 7
        ? "stroke-orange-500"
        : "stroke-rose-500";

  return (
    <div className="flex flex-col items-center" data-testid="countdown-ring">
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          className="stroke-muted"
          strokeWidth="8"
        />
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          className={ringColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        <text
          x="50" y="42"
          textAnchor="middle"
          className="fill-foreground font-bold"
          fontSize="22"
        >
          {daysRemaining}
        </text>
        <text
          x="50" y="58"
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="9"
        >
          {daysRemaining === 1 ? "day left" : "days left"}
        </text>
      </svg>
    </div>
  );
}

function CountdownTab({ overview, hasData, expanded }: { overview?: OverviewData; hasData: boolean | undefined; expanded: boolean }) {
  const { toast } = useToast();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateInput, setDateInput] = useState("");

  const { data: examData, isLoading: examLoading } = useQuery<{ examDate: string | null }>({
    queryKey: ["/api/study-dashboard/exam-date"],
  });

  const setExamDateMutation = useMutation({
    mutationFn: async (examDate: string | null) => {
      const res = await apiRequest("PUT", "/api/study-dashboard/exam-date", { examDate });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-dashboard/exam-date"] });
      setShowDatePicker(false);
      setDateInput("");
      toast({ title: "Exam date updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update exam date", description: error.message, variant: "destructive" });
    },
  });

  if (examLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const examDate = examData?.examDate ? new Date(examData.examDate) : null;
  const now = new Date();
  const daysRemaining = examDate ? Math.max(0, Math.ceil((examDate.getTime() - now.getTime()) / 86400000)) : null;
  const isPast = examDate && examDate.getTime() < now.getTime();

  const totalDays = daysRemaining !== null ? Math.max(daysRemaining + 1, 30) : 0;

  const phase = daysRemaining !== null ? getStudyPhase(daysRemaining) : null;

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split("T")[0];

  if (!examDate) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4 text-center px-4">
        <div className="h-14 w-14 rounded-full bg-cyan-100 dark:bg-cyan-500/15 flex items-center justify-center">
          <Calendar className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Set your exam date</p>
          <p className="text-sm text-foreground/80 dark:text-muted-foreground mt-1">
            Get a personalized study plan with smart recommendations based on how much time you have left.
          </p>
        </div>
        {showDatePicker ? (
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <input
              type="date"
              min={minDateStr}
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              data-testid="input-exam-date"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => dateInput && setExamDateMutation.mutate(dateInput)}
                disabled={!dateInput || setExamDateMutation.isPending}
                data-testid="button-save-exam-date"
              >
                {setExamDateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setShowDatePicker(false); setDateInput(""); }}
                data-testid="button-cancel-exam-date"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => setShowDatePicker(true)}
            data-testid="button-set-exam-date"
          >
            <Calendar className="h-4 w-4 mr-1.5" />
            Set Exam Date
          </Button>
        )}
      </div>
    );
  }

  if (isPast) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4 text-center px-4">
        <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
          <Award className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Exam day has passed</p>
          <p className="text-sm text-foreground/80 dark:text-muted-foreground mt-1">
            {examDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExamDateMutation.mutate(null)}
            disabled={setExamDateMutation.isPending}
            data-testid="button-clear-exam-date"
          >
            Clear Date
          </Button>
          <Button
            size="sm"
            onClick={() => setShowDatePicker(true)}
            data-testid="button-set-new-exam-date"
          >
            Set New Date
          </Button>
        </div>
        {showDatePicker && (
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <input
              type="date"
              min={minDateStr}
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              data-testid="input-exam-date-new"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => dateInput && setExamDateMutation.mutate(dateInput)}
                disabled={!dateInput || setExamDateMutation.isPending}
                data-testid="button-save-new-exam-date"
              >
                {setExamDateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowDatePicker(false); setDateInput(""); }} data-testid="button-cancel-new-exam-date">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center py-2">
        <CountdownRing daysRemaining={daysRemaining!} totalDays={Math.max(totalDays, daysRemaining! + 1)} size={expanded ? 150 : 110} />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-foreground/80 dark:text-muted-foreground">Exam Date</p>
          <p className="text-sm font-medium" data-testid="text-exam-date">
            {examDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              if (!showDatePicker && examDate) {
                setDateInput(examDate.toISOString().split("T")[0]);
              }
              setShowDatePicker(!showDatePicker);
            }}
            data-testid="button-edit-exam-date"
          >
            <Calendar className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setExamDateMutation.mutate(null)}
            disabled={setExamDateMutation.isPending}
            data-testid="button-remove-exam-date"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showDatePicker && (
        <div className="flex gap-2">
          <input
            type="date"
            min={minDateStr}
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="flex-1 px-3 py-2 rounded-md border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            data-testid="input-exam-date-edit"
          />
          <Button
            size="sm"
            onClick={() => dateInput && setExamDateMutation.mutate(dateInput)}
            disabled={!dateInput || setExamDateMutation.isPending}
          >
            {setExamDateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      )}

      {phase && (
        <div className={`rounded-md border ${phase.borderColor} ${phase.bgColor} p-3 flex flex-col gap-2`} data-testid="study-phase-card">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Timer className={`h-4 w-4 ${phase.color}`} />
              <span className={`text-sm font-semibold ${phase.color}`}>{phase.name} Phase</span>
            </div>
            {daysRemaining !== null && (
              <Badge variant="secondary" className={`${phase.bgColor} ${phase.color}`}>
                {daysRemaining <= 7 ? `${daysRemaining}d` : daysRemaining <= 30 ? `${Math.ceil(daysRemaining / 7)}w` : `${Math.ceil(daysRemaining / 30)}mo`}
              </Badge>
            )}
          </div>
          <p className="text-xs text-foreground/80 dark:text-muted-foreground">{phase.description}</p>
        </div>
      )}

      {phase && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-foreground dark:text-muted-foreground uppercase tracking-wide">Recommended Actions</h3>
          <div className="flex flex-col gap-1.5">
            {phase.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2 rounded-md border">
                <div className="h-5 w-5 rounded-full bg-cyan-100 dark:bg-cyan-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400">{i + 1}</span>
                </div>
                <span className="text-sm">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasData && overview && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-foreground dark:text-muted-foreground uppercase tracking-wide">Your Progress</h3>
          <div className={`grid gap-2 ${expanded ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="p-2.5 rounded-md border text-center">
              <div className="text-lg font-bold" data-testid="countdown-readiness">{overview.readinessScore}%</div>
              <div className="text-[11px] text-foreground/80 dark:text-muted-foreground">Readiness</div>
            </div>
            <div className="p-2.5 rounded-md border text-center">
              <div className="text-lg font-bold" data-testid="countdown-quizzes">{overview.totalQuizzes}</div>
              <div className="text-[11px] text-foreground/80 dark:text-muted-foreground">Sessions</div>
            </div>
            {expanded && (
              <div className="p-2.5 rounded-md border text-center">
                <div className={`text-lg font-bold ${accuracyColor(overview.averageScore)}`} data-testid="countdown-avg">{overview.averageScore}%</div>
                <div className="text-[11px] text-foreground/80 dark:text-muted-foreground">Avg Score</div>
              </div>
            )}
          </div>
          {overview.weakTopics.length > 0 && daysRemaining !== null && daysRemaining <= 60 && (
            <div className="rounded-md border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1.5">Priority Focus Areas</p>
              <div className="flex flex-wrap gap-1.5">
                {overview.weakTopics.slice(0, 3).map(t => (
                  <Badge key={t.topic} variant="secondary" className="bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    {t.topic} ({t.accuracy}%)
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface JourneyDocument {
  id: string;
  name: string;
  bestScore: number;
  lastScore: number;
  lastStudied: string | null;
  attemptCount: number;
}

interface JourneyData {
  stages: {
    learn: JourneyDocument[];
    practice: JourneyDocument[];
    refine: JourneyDocument[];
    mastered: JourneyDocument[];
  };
  totalDocuments: number;
}

const journeyStageConfig = [
  { key: "learn" as const, label: "Learn", description: "Quiz generated, not yet completed", icon: BookOpen, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-500/15", border: "border-sky-200 dark:border-sky-500/20", barColor: "bg-sky-500" },
  { key: "practice" as const, label: "Practice", description: "Best score below 70%", icon: Target, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/15", border: "border-amber-200 dark:border-amber-500/20", barColor: "bg-amber-500" },
  { key: "refine" as const, label: "Refine", description: "Best score 70\u201389%", icon: Brain, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-500/15", border: "border-violet-200 dark:border-violet-500/20", barColor: "bg-violet-500" },
  { key: "mastered" as const, label: "Mastered", description: "Best score 90%+", icon: GraduationCap, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/15", border: "border-emerald-200 dark:border-emerald-500/20", barColor: "bg-emerald-500" },
];

function JourneyTab({ expanded }: { expanded: boolean }) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const { data: journeyData, isLoading } = useQuery<JourneyData>({
    queryKey: ["/api/study-dashboard/journey"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stages = journeyData?.stages || { learn: [], practice: [], refine: [], mastered: [] };
  const total = journeyData?.totalDocuments || 0;

  const masteredCount = stages.mastered.length;
  const masteryPct = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
  const selectedDocs = selectedStage ? stages[selectedStage as keyof typeof stages] : null;
  const isEmpty = total === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center px-2 py-4">
        <div className="flex items-center w-full max-w-md">
          {journeyStageConfig.map((stage, idx) => {
            const count = stages[stage.key].length;
            const isActive = count > 0;
            const isSelected = selectedStage === stage.key;
            const StageIcon = stage.icon;
            const isLast = idx === journeyStageConfig.length - 1;

            return (
              <div key={stage.key} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
                <button
                  onClick={() => !isEmpty && setSelectedStage(isSelected ? null : stage.key)}
                  className={`flex flex-col items-center gap-1.5 group relative ${isEmpty ? "cursor-default" : ""}`}
                  data-testid={`button-journey-stage-${stage.key}`}
                >
                  <div
                    className={`relative h-10 w-10 rounded-full flex items-center justify-center transition-all border-2 ${
                      isSelected
                        ? `${stage.bg} ${stage.color} border-current shadow-sm scale-110`
                        : isActive
                          ? `${stage.bg} ${stage.color} border-transparent`
                          : `bg-muted/30 dark:bg-muted/15 ${isEmpty ? stage.color + " opacity-40" : "text-muted-foreground"} border-transparent`
                    }`}
                  >
                    <StageIcon className="h-4 w-4" />
                    {isActive && count > 0 && (
                      <span className={`absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full text-xs font-bold flex items-center justify-center ${stage.barColor} text-white`}>
                        {count}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium leading-tight ${
                    isSelected ? stage.color : isActive ? "text-foreground" : isEmpty ? "text-foreground/50 dark:text-muted-foreground/60" : "text-foreground/80 dark:text-muted-foreground"
                  }`}>
                    {stage.label}
                  </span>
                </button>

                {!isLast && (
                  <div className="flex-1 flex items-center px-1 -mt-4">
                    {(() => {
                      const nextStage = journeyStageConfig[idx + 1];
                      const nextCount = stages[nextStage.key].length;
                      const hasFlow = isActive && nextCount > 0;
                      return (
                        <div className={`h-0.5 w-full rounded-full transition-colors ${
                          hasFlow ? stage.barColor : "bg-muted-foreground/15"
                        }`} />
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isEmpty ? (
        <div className="text-center px-4 pb-2">
          <p className="text-xs text-foreground/80 dark:text-muted-foreground">Take a quiz to start tracking your documents through each stage.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] text-foreground/80 dark:text-muted-foreground">{masteredCount}/{total} mastered</span>
            <span className={`text-[11px] font-medium ${masteryPct >= 90 ? "text-emerald-600 dark:text-emerald-400" : masteryPct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-foreground/80 dark:text-muted-foreground"}`} data-testid="journey-mastery-pct">
              {masteryPct}%
            </span>
          </div>
          <div className="flex gap-0.5 w-full h-2 rounded-full overflow-hidden bg-muted/50">
            {journeyStageConfig.map((stage) => {
              const count = stages[stage.key].length;
              if (count === 0) return null;
              const width = (count / total) * 100;
              return (
                <div
                  key={stage.key}
                  className={`${stage.barColor} first:rounded-l-full last:rounded-r-full transition-all`}
                  style={{ width: `${width}%` }}
                />
              );
            })}
          </div>

          {selectedStage && selectedDocs && (
            <div className="flex flex-col gap-1.5" data-testid={`journey-docs-${selectedStage}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">
                  {journeyStageConfig.find(s => s.key === selectedStage)?.label} ({selectedDocs.length})
                </span>
                <button onClick={() => setSelectedStage(null)} className="text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {selectedDocs.length === 0 ? (
                <p className="text-xs text-foreground/80 dark:text-muted-foreground py-2 text-center">No documents in this stage</p>
              ) : (
                selectedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40 dark:bg-muted/20"
                    data-testid={`journey-doc-${doc.id}`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-xs font-medium truncate">{doc.name}</span>
                      <div className="flex items-center gap-2 text-[10px] text-foreground/80 dark:text-muted-foreground flex-wrap">
                        {doc.attemptCount > 0 && (
                          <span>{doc.attemptCount} {doc.attemptCount === 1 ? "attempt" : "attempts"}</span>
                        )}
                        {doc.lastStudied && (
                          <span>{formatRelativeDate(doc.lastStudied)}</span>
                        )}
                      </div>
                    </div>
                    {doc.bestScore > 0 && (
                      <span className={`text-xs font-bold shrink-0 ${accuracyColor(doc.bestScore)}`}>
                        {doc.bestScore}%
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const materialTypeConfig: Record<string, { label: string; icon: typeof BookOpen; color: string; bgColor: string }> = {
  exam_focus: { label: "Exam Focus", icon: GraduationCap, color: "text-violet-600 dark:text-violet-400", bgColor: "bg-violet-100 dark:bg-violet-500/15" },
  study_summary: { label: "Summary", icon: FileText, color: "text-sky-600 dark:text-sky-400", bgColor: "bg-sky-100 dark:bg-sky-500/15" },
  practice_questions: { label: "Practice Q's", icon: Zap, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-500/15" },
  flashcards: { label: "Flashcards", icon: Brain, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-500/15" },
  cheat_sheet: { label: "Cheat Sheet", icon: FileText, color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-100 dark:bg-rose-500/15" },
};

function MaterialsTab({ materials, isLoading, expanded }: { materials: StudyMaterialItem[]; isLoading: boolean; expanded: boolean }) {
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingData, setViewingData] = useState<{ type: string; content: any; title: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const openMaterial = async (id: string) => {
    setLoadingId(id);
    try {
      const response = await fetch(`/api/study/${id}`, { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setViewingData({ type: data.type, content: data.content, title: data.title });
        setViewingId(id);
      }
    } catch (error) {
      console.error("Failed to fetch study material:", error);
    } finally {
      setLoadingId(null);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById("study-material-print-area");
    if (!printContent) return;

    const printStyleId = "study-print-styles";
    let printStyle = document.getElementById(printStyleId);
    if (!printStyle) {
      printStyle = document.createElement("style");
      printStyle.id = printStyleId;
      document.head.appendChild(printStyle);
    }
    printStyle.textContent = `
      @media print {
        body > *:not(#study-material-print-wrapper) { display: none !important; }
        #study-material-print-wrapper {
          display: block !important;
          position: fixed !important;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 99999;
          background: white;
          padding: 24px;
          overflow: visible;
          color: #1a1a1a;
        }
        #study-material-print-wrapper h1 { font-size: 20px; margin-bottom: 16px; }
        #study-material-print-wrapper h4 { font-size: 14px; margin: 16px 0 8px; }
        #study-material-print-wrapper .space-y-2 > * + * { margin-top: 8px; }
        #study-material-print-wrapper .space-y-4 > * + * { margin-top: 16px; }
        #study-material-print-wrapper p, #study-material-print-wrapper span, #study-material-print-wrapper div { font-size: 13px; line-height: 1.5; }
      }
    `;

    let wrapper = document.getElementById("study-material-print-wrapper");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = "study-material-print-wrapper";
      wrapper.style.display = "none";
      document.body.appendChild(wrapper);
    }
    wrapper.innerHTML = `<h1>${viewingData?.title || "Study Material"}</h1>${printContent.innerHTML}`;

    window.print();

    setTimeout(() => {
      if (wrapper) wrapper.innerHTML = "";
    }, 1000);
  };

  const handleDownload = () => {
    if (!viewingData) return;
    const printContent = document.getElementById("study-material-print-area");
    const textContent = printContent?.innerText || JSON.stringify(viewingData.content, null, 2);
    const blob = new Blob([`${viewingData.title}\n${"=".repeat(viewingData.title.length)}\n\n${textContent}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${viewingData.title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_")}.txt`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!materials || materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
        <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
          <BookOpen className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div data-testid="text-empty-materials">
          <p className="text-sm font-medium text-foreground">No notes saved yet</p>
          <p className="text-xs text-foreground/80 dark:text-muted-foreground mt-1">
            Use Exam Focus, Flashcards, or Practice Questions on any document to generate study notes. They'll all appear here for quick access.
          </p>
        </div>
      </div>
    );
  }

  const byType: Record<string, StudyMaterialItem[]> = {};
  materials.forEach(m => {
    const key = m.type || "other";
    if (!byType[key]) byType[key] = [];
    byType[key].push(m);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className={`grid gap-2 ${expanded ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3"}`} data-testid="materials-summary">
        {Object.entries(materialTypeConfig).map(([type, cfg]) => {
          const count = byType[type]?.length || 0;
          const Icon = cfg.icon;
          return (
            <div key={type} className="p-2 rounded-md border text-center" data-testid={`materials-count-${type}`}>
              <div className="flex justify-center mb-1">
                <div className={`h-6 w-6 rounded-md ${cfg.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-3 w-3 ${cfg.color}`} />
                </div>
              </div>
              <p className={`text-sm font-bold ${count > 0 ? cfg.color : "text-muted-foreground"}`}>{count}</p>
              <p className="text-[10px] text-foreground/80 dark:text-muted-foreground">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5" data-testid="materials-list">
        <h3 className="text-xs font-semibold text-foreground dark:text-muted-foreground uppercase tracking-wide">
          All Notes ({materials.length})
        </h3>
        {materials.map((material) => {
          const cfg = materialTypeConfig[material.type] || { label: material.type, icon: FileText, color: "text-muted-foreground", bgColor: "bg-muted" };
          const Icon = cfg.icon;
          const isOpening = loadingId === material.id;
          return (
            <button
              key={material.id}
              onClick={() => openMaterial(material.id)}
              disabled={isOpening}
              className="flex items-center gap-2.5 p-2.5 rounded-md bg-muted/40 dark:bg-muted/20 hover-elevate text-left w-full"
              data-testid={`material-item-${material.id}`}
            >
              <div className={`h-7 w-7 rounded-md ${cfg.bgColor} flex items-center justify-center shrink-0`}>
                {isOpening ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{material.title}</p>
                <div className="flex items-center gap-2 text-[10px] text-foreground/80 dark:text-muted-foreground flex-wrap">
                  <Badge variant="secondary">{cfg.label}</Badge>
                  <span>{formatRelativeDate(material.createdAt)}</span>
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>

      <Dialog open={viewingId !== null} onOpenChange={(open) => { if (!open) { setViewingId(null); setViewingData(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[85vh] h-[100dvh] sm:h-auto w-full sm:w-auto flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap pr-8">
              <DialogTitle className="text-base">{viewingData?.title || "Study Note"}</DialogTitle>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" onClick={handlePrint} data-testid="button-print-material">
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Print</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" onClick={handleDownload} data-testid="button-download-material">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save as file</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            <div id="study-material-print-area" className="pr-4">
              {viewingData && (
                <StudyMaterialRenderer
                  type={viewingData.type}
                  content={viewingData.content}
                  title={viewingData.title}
                />
              )}
            </div>
          </ScrollArea>
          <div className="pt-3 border-t flex justify-end sm:hidden">
            <Button
              variant="outline"
              onClick={() => { setViewingId(null); setViewingData(null); }}
              data-testid="button-close-material-mobile"
            >
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
