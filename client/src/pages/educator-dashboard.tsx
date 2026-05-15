import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StudyMaterialRenderer } from "@/components/study-material-renderer";
import {
  Loader2,
  BookOpen,
  Users,
  FileText,
  Trophy,
  Monitor,
  FileImage,
  BarChart3,
  TrendingUp,
  GraduationCap,
  ChevronRight,
  Clock,
  Target,
  Award,
  ArrowLeft,
  Layers,
  ListChecks,
  HelpCircle,
  StickyNote,
  Printer,
  Download,
  X,
  Zap,
  Brain,
} from "lucide-react";
import { useLocation } from "wouter";

interface EducatorDashboardData {
  totalQuizzes: number;
  totalQuestions: number;
  totalSubmissions: number;
  onlineSubmissions: number;
  paperSubmissions: number;
  uniqueStudents: number;
  averageScore: number;
  topicBreakdown: Array<{
    topic: string;
    questionCount: number;
    averageScore: number | null;
    attemptCount: number;
  }>;
  recentQuizzes: Array<{
    id: string;
    title: string;
    questionCount: number;
    questionType: string;
    createdAt: string;
    timeLimitSeconds: number | null;
    submissionCount: number;
    onlineCount: number;
    paperCount: number;
    averageScore: number | null;
    highestScore: number | null;
    lowestScore: number | null;
    topics: string[];
  }>;
  scoreDistribution: {
    excellent: number;
    good: number;
    average: number;
    needsWork: number;
  };
}

interface SubmissionsData {
  quizId: string;
  quizTitle: string;
  totalSubmissions: number;
  onlineCount: number;
  paperCount: number;
  averageScore: number;
  submissions: Array<{
    id: string;
    studentNumber: string | null;
    submissionType: string;
    totalScore: number | null;
    maxScore: number | null;
    percentageScore: number | null;
    completedAt: string | null;
    timeUsedSeconds: number | null;
  }>;
}

interface StudyMaterialItem {
  id: string;
  type: string;
  title: string;
  sourceDocumentId: string | null;
  createdAt: string;
}

const noteTypeConfig: Record<string, { label: string; icon: typeof BookOpen; color: string; bgColor: string }> = {
  exam_focus: { label: "Exam Focus", icon: GraduationCap, color: "text-violet-600 dark:text-violet-400", bgColor: "bg-violet-100 dark:bg-violet-500/15" },
  study_summary: { label: "Summary", icon: FileText, color: "text-sky-600 dark:text-sky-400", bgColor: "bg-sky-100 dark:bg-sky-500/15" },
  practice_questions: { label: "Practice Q's", icon: Zap, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-500/15" },
  flashcards: { label: "Flashcards", icon: Brain, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-500/15" },
  cheat_sheet: { label: "Cheat Sheet", icon: ListChecks, color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-100 dark:bg-rose-500/15" },
};

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

function ScoreBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3" data-testid={`score-bar-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1 h-5 rounded-md bg-muted/50 overflow-hidden">
        <div
          className={`h-full rounded-md ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right">{count}</span>
    </div>
  );
}

export default function EducatorDashboard() {
  const [, navigate] = useLocation();
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);
  const [viewingNoteData, setViewingNoteData] = useState<{ type: string; content: any; title: string } | null>(null);
  const [loadingNoteId, setLoadingNoteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<EducatorDashboardData>({
    queryKey: ["/api/educator/dashboard"],
  });

  const { data: myNotes = [], isLoading: notesLoading } = useQuery<StudyMaterialItem[]>({
    queryKey: ["/api/study"],
  });

  const { data: submissionsData, isLoading: submissionsLoading } = useQuery<SubmissionsData>({
    queryKey: ["/api/quiz", selectedQuizId, "submissions"],
    queryFn: async () => {
      const res = await fetch(`/api/quiz/${selectedQuizId}/submissions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!selectedQuizId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          <p className="text-sm text-muted-foreground">Loading your educator dashboard...</p>
        </div>
      </div>
    );
  }

  const d = data || {
    totalQuizzes: 0, totalQuestions: 0, totalSubmissions: 0,
    onlineSubmissions: 0, paperSubmissions: 0, uniqueStudents: 0,
    averageScore: 0, topicBreakdown: [], recentQuizzes: [],
    scoreDistribution: { excellent: 0, good: 0, average: 0, needsWork: 0 },
  };

  const totalDist = d.scoreDistribution.excellent + d.scoreDistribution.good + d.scoreDistribution.average + d.scoreDistribution.needsWork;

  return (
    <ScrollArea className="h-full">
      <div className="max-w-5xl mx-auto px-3 py-4 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden">
        <div className="flex items-center gap-2 md:gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate("/study-dashboard")}
            data-testid="button-back-study"
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-cyan-600 shrink-0" />
              <span className="truncate">Educator Dashboard</span>
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 truncate">
              Track quiz results, student performance, and topic coverage
            </p>
          </div>
        </div>

        {d.totalQuizzes === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6 md:p-12 gap-4">
              <div className="w-16 h-16 rounded-full bg-cyan-50 dark:bg-cyan-950/30 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-cyan-600" />
              </div>
              <h3 className="text-lg font-semibold">No quizzes created yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Create quizzes from your uploaded documents to start tracking student performance here.
              </p>
              <Button
                onClick={() => navigate("/study-dashboard")}
                data-testid="button-go-create-quiz"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Go to Study Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              <Card data-testid="metric-total-quizzes">
                <CardContent className="p-3 md:p-4 flex flex-col items-center gap-1">
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-md bg-cyan-50 dark:bg-cyan-950/30 flex items-center justify-center">
                    <BookOpen className="h-4 w-4 text-cyan-600" />
                  </div>
                  <span className="text-xl md:text-2xl font-bold">{d.totalQuizzes}</span>
                  <span className="text-[10px] md:text-xs text-muted-foreground text-center">Quizzes</span>
                </CardContent>
              </Card>

              <Card data-testid="metric-total-submissions">
                <CardContent className="p-3 md:p-4 flex flex-col items-center gap-1">
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-md bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-xl md:text-2xl font-bold">{d.totalSubmissions}</span>
                  <span className="text-[10px] md:text-xs text-muted-foreground text-center">Submissions</span>
                </CardContent>
              </Card>

              <Card data-testid="metric-unique-students">
                <CardContent className="p-3 md:p-4 flex flex-col items-center gap-1">
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-md bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                    <Users className="h-4 w-4 text-purple-600" />
                  </div>
                  <span className="text-xl md:text-2xl font-bold">{d.uniqueStudents}</span>
                  <span className="text-[10px] md:text-xs text-muted-foreground text-center">Students</span>
                </CardContent>
              </Card>

              <Card data-testid="metric-average-score">
                <CardContent className="p-3 md:p-4 flex flex-col items-center gap-1">
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-md bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-amber-600" />
                  </div>
                  <span className="text-xl md:text-2xl font-bold">{d.averageScore}%</span>
                  <span className="text-[10px] md:text-xs text-muted-foreground text-center">Avg Score</span>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <Card data-testid="card-submission-types">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-cyan-600" />
                    Submission Types
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-md border">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Online</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{d.onlineSubmissions}</span>
                      <span className="text-xs text-muted-foreground">
                        ({d.totalSubmissions > 0 ? Math.round((d.onlineSubmissions / d.totalSubmissions) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md border">
                    <div className="flex items-center gap-2">
                      <FileImage className="h-4 w-4 text-amber-500" />
                      <span className="text-sm">Paper (Scanned)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{d.paperSubmissions}</span>
                      <span className="text-xs text-muted-foreground">
                        ({d.totalSubmissions > 0 ? Math.round((d.paperSubmissions / d.totalSubmissions) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-score-distribution">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-cyan-600" />
                    Score Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <ScoreBar label="90-100%" count={d.scoreDistribution.excellent} total={totalDist} color="bg-green-500" />
                  <ScoreBar label="70-89%" count={d.scoreDistribution.good} total={totalDist} color="bg-blue-500" />
                  <ScoreBar label="50-69%" count={d.scoreDistribution.average} total={totalDist} color="bg-amber-500" />
                  <ScoreBar label="0-49%" count={d.scoreDistribution.needsWork} total={totalDist} color="bg-red-500" />
                </CardContent>
              </Card>
            </div>

            {d.topicBreakdown.length > 0 && (
              <Card data-testid="card-topic-breakdown">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-cyan-600" />
                    Topic Coverage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {d.topicBreakdown.map((topic) => (
                      <div
                        key={topic.topic}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-md border"
                        data-testid={`topic-${topic.topic}`}
                      >
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <span className="text-sm font-medium truncate">{topic.topic}</span>
                          <span className="text-xs text-muted-foreground">
                            {topic.questionCount} question{topic.questionCount !== 1 ? "s" : ""}
                            {topic.attemptCount > 0 && ` · ${topic.attemptCount} answer${topic.attemptCount !== 1 ? "s" : ""}`}
                          </span>
                        </div>
                        {topic.averageScore != null && (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              topic.averageScore >= 70
                                ? "text-green-700 dark:text-green-300"
                                : topic.averageScore >= 50
                                  ? "text-amber-700 dark:text-amber-300"
                                  : "text-red-700 dark:text-red-300"
                            }`}
                          >
                            Avg: {topic.averageScore}%
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card data-testid="card-quiz-list">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-cyan-600" />
                  All Quizzes ({d.recentQuizzes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {d.recentQuizzes.map((quiz) => {
                    const scoreColor = quiz.averageScore != null
                      ? quiz.averageScore >= 70
                        ? "text-green-600 dark:text-green-400"
                        : quiz.averageScore >= 50
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                      : "text-muted-foreground";

                    return (
                      <div
                        key={quiz.id}
                        className="p-3 rounded-md border hover-elevate cursor-pointer"
                        onClick={() => setSelectedQuizId(quiz.id)}
                        data-testid={`quiz-row-${quiz.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <span className="text-sm font-medium line-clamp-2">{quiz.title}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary" className="text-[10px] md:text-xs">
                                {quiz.questionCount} Q · {quiz.questionType}
                              </Badge>
                              {quiz.timeLimitSeconds && (
                                <Badge variant="outline" className="text-[10px] md:text-xs flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {Math.round(quiz.timeLimitSeconds / 60)}m
                                </Badge>
                              )}
                            </div>
                            {quiz.topics.length > 0 && quiz.topics[0] !== "General" && (
                              <span className="text-[10px] md:text-xs text-muted-foreground truncate">
                                {quiz.topics.slice(0, 2).join(", ")}
                              </span>
                            )}
                            <span className="text-[10px] md:text-xs text-muted-foreground">
                              {new Date(quiz.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 md:gap-3 shrink-0">
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm font-medium">{quiz.submissionCount}</span>
                              </div>
                              {quiz.submissionCount > 0 && (
                                <div className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground">
                                  <Monitor className="h-3 w-3" />
                                  {quiz.onlineCount}
                                  <FileImage className="h-3 w-3 ml-0.5" />
                                  {quiz.paperCount}
                                </div>
                              )}
                            </div>
                            {quiz.averageScore != null && (
                              <div className="flex flex-col items-center">
                                <span className={`text-base md:text-lg font-bold ${scoreColor}`}>
                                  {quiz.averageScore}%
                                </span>
                                <span className="text-[10px] md:text-xs text-muted-foreground">avg</span>
                              </div>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground hidden md:block" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card data-testid="card-my-notes" id="my-notes">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-cyan-600" />
              My Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : myNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center" data-testid="text-empty-notes">
                <div className="w-12 h-12 rounded-full bg-cyan-50 dark:bg-cyan-950/30 flex items-center justify-center">
                  <StickyNote className="h-6 w-6 text-cyan-600" />
                </div>
                <p className="text-sm font-medium">No notes saved yet</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Use Exam Focus, Practice Qs, Flashcards, Cheat Sheet, or Summary tools on any document in chat. Generated materials will appear here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2" data-testid="notes-type-summary">
                  {Object.entries(noteTypeConfig).map(([type, cfg]) => {
                    const count = myNotes.filter(n => n.type === type).length;
                    const Icon = cfg.icon;
                    return (
                      <div key={type} className="p-2 rounded-md border text-center" data-testid={`notes-count-${type}`}>
                        <div className="flex justify-center mb-1">
                          <div className={`h-6 w-6 rounded-md ${cfg.bgColor} flex items-center justify-center`}>
                            <Icon className={`h-3 w-3 ${cfg.color}`} />
                          </div>
                        </div>
                        <p className={`text-sm font-bold ${count > 0 ? cfg.color : "text-muted-foreground"}`}>{count}</p>
                        <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-1.5" data-testid="notes-list">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    All Notes ({myNotes.length})
                  </h3>
                  {myNotes.map((note) => {
                    const cfg = noteTypeConfig[note.type] || { label: note.type, icon: FileText, color: "text-muted-foreground", bgColor: "bg-muted" };
                    const Icon = cfg.icon;
                    const isOpening = loadingNoteId === note.id;
                    return (
                      <button
                        key={note.id}
                        onClick={async () => {
                          setLoadingNoteId(note.id);
                          try {
                            const response = await fetch(`/api/study/${note.id}`, { credentials: "include" });
                            if (response.ok) {
                              const data = await response.json();
                              setViewingNoteData({ type: data.type, content: data.content, title: data.title });
                              setViewingNoteId(note.id);
                            }
                          } catch (error) {
                            console.error("Failed to fetch note:", error);
                          } finally {
                            setLoadingNoteId(null);
                          }
                        }}
                        disabled={isOpening}
                        className="flex items-center gap-2.5 p-2.5 rounded-md bg-muted/40 dark:bg-muted/20 hover-elevate text-left w-full"
                        data-testid={`note-item-${note.id}`}
                      >
                        <div className={`h-7 w-7 rounded-md ${cfg.bgColor} flex items-center justify-center shrink-0`}>
                          {isOpening ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          ) : (
                            <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{note.title}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                            <Badge variant="secondary">{cfg.label}</Badge>
                            <span>{formatRelativeDate(note.createdAt)}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={viewingNoteId !== null} onOpenChange={(open) => { if (!open) { setViewingNoteId(null); setViewingNoteData(null); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[85vh] h-[100dvh] sm:h-auto w-full sm:w-auto flex flex-col p-4 sm:p-6">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap pr-8">
                <DialogTitle className="text-base">{viewingNoteData?.title || "Note"}</DialogTitle>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const printContent = document.getElementById("educator-note-print-area");
                          if (!printContent) return;
                          const printStyleId = "educator-note-print-styles";
                          let printStyle = document.getElementById(printStyleId);
                          if (!printStyle) {
                            printStyle = document.createElement("style");
                            printStyle.id = printStyleId;
                            document.head.appendChild(printStyle);
                          }
                          printStyle.textContent = `
                            @media print {
                              body > *:not(#educator-note-print-wrapper) { display: none !important; }
                              #educator-note-print-wrapper {
                                display: block !important; position: fixed !important;
                                top: 0; left: 0; right: 0; bottom: 0; z-index: 99999;
                                background: white; padding: 24px; overflow: visible; color: #1a1a1a;
                              }
                              #educator-note-print-wrapper h1 { font-size: 20px; margin-bottom: 16px; }
                              #educator-note-print-wrapper h4 { font-size: 14px; margin: 16px 0 8px; }
                              #educator-note-print-wrapper p, #educator-note-print-wrapper span, #educator-note-print-wrapper div { font-size: 13px; line-height: 1.5; }
                            }
                          `;
                          let wrapper = document.getElementById("educator-note-print-wrapper");
                          if (!wrapper) {
                            wrapper = document.createElement("div");
                            wrapper.id = "educator-note-print-wrapper";
                            wrapper.style.display = "none";
                            document.body.appendChild(wrapper);
                          }
                          wrapper.innerHTML = `<h1>${viewingNoteData?.title || "Note"}</h1>${printContent.innerHTML}`;
                          window.print();
                          setTimeout(() => { if (wrapper) wrapper.innerHTML = ""; }, 1000);
                        }}
                        data-testid="button-print-note"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Print</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (!viewingNoteData) return;
                          const printContent = document.getElementById("educator-note-print-area");
                          const textContent = printContent?.innerText || JSON.stringify(viewingNoteData.content, null, 2);
                          const blob = new Blob([`${viewingNoteData.title}\n${"=".repeat(viewingNoteData.title.length)}\n\n${textContent}`], { type: "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${viewingNoteData.title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_")}.txt`;
                          a.style.display = "none";
                          document.body.appendChild(a);
                          a.click();
                          setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
                        }}
                        data-testid="button-download-note"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save as file</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <div id="educator-note-print-area" className="pr-4">
                {viewingNoteData && (
                  <StudyMaterialRenderer
                    type={viewingNoteData.type}
                    content={viewingNoteData.content}
                    title={viewingNoteData.title}
                  />
                )}
              </div>
            </ScrollArea>
            <div className="pt-3 border-t flex justify-end sm:hidden">
              <Button
                variant="outline"
                onClick={() => { setViewingNoteId(null); setViewingNoteData(null); }}
                data-testid="button-close-note-mobile"
              >
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedQuizId} onOpenChange={(open) => { if (!open) setSelectedQuizId(null); }}>
          <DialogContent className="max-w-[95vw] md:max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-cyan-600" />
                Student Submissions
              </DialogTitle>
              {submissionsData && (
                <DialogDescription>{submissionsData.quizTitle}</DialogDescription>
              )}
            </DialogHeader>

            {submissionsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
              </div>
            ) : submissionsData ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  <div className="flex flex-col items-center p-2 md:p-3 rounded-md bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800">
                    <span className="text-xl md:text-2xl font-bold text-cyan-600">{submissionsData.totalSubmissions}</span>
                    <span className="text-[10px] md:text-xs text-muted-foreground">Total</span>
                  </div>
                  <div className="flex flex-col items-center p-2 md:p-3 rounded-md border">
                    <div className="flex items-center gap-1">
                      <Monitor className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-xl md:text-2xl font-bold">{submissionsData.onlineCount}</span>
                    </div>
                    <span className="text-[10px] md:text-xs text-muted-foreground">Online</span>
                  </div>
                  <div className="flex flex-col items-center p-2 md:p-3 rounded-md border">
                    <div className="flex items-center gap-1">
                      <FileImage className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xl md:text-2xl font-bold">{submissionsData.paperCount}</span>
                    </div>
                    <span className="text-[10px] md:text-xs text-muted-foreground">Paper</span>
                  </div>
                </div>

                {submissionsData.totalSubmissions > 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                    <Award className="h-4 w-4 text-cyan-600" />
                    <span className="text-sm">Class Average: <strong>{submissionsData.averageScore}%</strong></span>
                  </div>
                )}

                {submissionsData.submissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center p-4">
                    No student submissions yet. Share the quiz link or print QR codes.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {submissionsData.submissions.map((sub) => {
                      const scoreColor = (sub.percentageScore || 0) >= 70
                        ? "text-green-600 dark:text-green-400"
                        : (sub.percentageScore || 0) >= 50
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400";

                      return (
                        <div
                          key={sub.id}
                          className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-md border"
                          data-testid={`submission-row-${sub.id}`}
                        >
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {sub.studentNumber ? (
                                <Badge variant="secondary" className="text-xs">
                                  Student #{sub.studentNumber}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  No student number
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                {sub.submissionType === "online" ? (
                                  <><Monitor className="h-3 w-3" /> Online</>
                                ) : (
                                  <><FileImage className="h-3 w-3" /> Paper</>
                                )}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {sub.completedAt ? new Date(sub.completedAt).toLocaleString() : "In progress"}
                              {sub.timeUsedSeconds != null && ` · ${Math.floor(sub.timeUsedSeconds / 60)}m ${sub.timeUsedSeconds % 60}s`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${scoreColor}`}>
                              {sub.percentageScore != null ? `${sub.percentageScore}%` : "-"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {sub.totalScore != null && sub.maxScore != null ? `${sub.totalScore}/${sub.maxScore}` : ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center p-4">
                Could not load submissions.
              </p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
