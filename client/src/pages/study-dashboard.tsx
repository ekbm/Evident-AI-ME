import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMode } from "@/contexts/mode-context";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  HelpCircle,
  Target,
  TrendingUp,
  TrendingDown,
  Trophy,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Users,
  Percent,
} from "lucide-react";

type TabId = "overview" | "practice" | "review" | "attention";

interface WeakTopic {
  topic: string;
  accuracy: number;
  totalQuestions: number;
  recentAccuracy: number;
  subtopics: { subtopic: string; accuracy: number; count: number }[];
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
}

interface EducatorDashboardData {
  totalQuizzes: number;
  totalQuestions: number;
  totalSubmissions: number;
  onlineSubmissions: number;
  paperSubmissions: number;
  uniqueStudents: number;
  averageScore: number;
  completionRate: number;
  topicBreakdown: { topic: string; questionCount: number; averageScore: number | null; attemptCount: number }[];
  recentQuizzes: { id: string; title: string; questionCount: number; submissionCount: number; averageScore: number | null }[];
  scoreDistribution: { excellent: number; good: number; average: number; needsWork: number };
  lowestPerformingTopic: { topic: string; averageScore: number | null } | null;
  highestPerformingTopic: { topic: string; averageScore: number | null } | null;
  needsAttention: {
    strugglingStudents: { studentId: string; averageScore: number; attemptCount: number }[];
    lowestTopic: { topic: string; averageScore: number | null } | null;
    incompleteAttempts: number;
  };
}

interface WrongAnswer {
  answer_id: string;
  question_id: string;
  user_answer: string;
  score: number;
  max_marks: number;
  feedback: string;
  is_correct: boolean;
  question_text: string;
  question_type: string;
  model_answer: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  options: string[] | null;
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

function getAccuracyColor(accuracy: number): string {
  if (accuracy < 50) return "text-red-600 dark:text-red-400";
  if (accuracy < 70) return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

function getAccuracyBg(accuracy: number): string {
  if (accuracy < 50) return "bg-red-500/10";
  if (accuracy < 70) return "bg-amber-500/10";
  return "bg-green-500/10";
}

function formatTime(seconds: number): string {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CircularProgress({ score, size = 140 }: { score: number; size?: number }) {
  const strokeWidth = 10;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const viewBoxSize = 100;

  let strokeColor = "stroke-red-500";
  if (score >= 70) strokeColor = "stroke-green-500";
  else if (score >= 50) strokeColor = "stroke-amber-500";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="transform -rotate-90"
        data-testid="readiness-score-circle"
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          className={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground rotate-90 origin-center"
          style={{ fontSize: "22px", fontWeight: 700 }}
        >
          {score}
        </text>
      </svg>
      <span className="text-sm font-medium text-muted-foreground">Readiness Score</span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, subtext }: { label: string; value: string | number; icon: typeof BarChart3; subtext?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
          {subtext && <span className="text-xs text-muted-foreground/70">{subtext}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function EducatorOverviewTab({ data, isLoading }: { data: EducatorDashboardData | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const d = data || {
    totalQuizzes: 0, totalQuestions: 0, totalSubmissions: 0,
    onlineSubmissions: 0, paperSubmissions: 0, uniqueStudents: 0,
    averageScore: 0, topicBreakdown: [], recentQuizzes: [],
    scoreDistribution: { excellent: 0, good: 0, average: 0, needsWork: 0 },
    completionRate: 0, lowestPerformingTopic: null, highestPerformingTopic: null,
    needsAttention: { strugglingStudents: [], lowestTopic: null, incompleteAttempts: 0 },
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card data-testid="card-metric-total-quizzes">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-medium">Total Quizzes</span>
            </div>
            <span className="text-2xl font-bold">{d.totalQuizzes}</span>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-students-attempted">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Students Attempted</span>
            </div>
            <span className="text-2xl font-bold">{d.uniqueStudents}</span>
            <span className="text-xs text-muted-foreground">{d.totalSubmissions} total submissions</span>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-avg-class-score">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium">Average Class Score</span>
            </div>
            <span className={`text-2xl font-bold ${d.averageScore >= 70 ? 'text-green-600 dark:text-green-400' : d.averageScore >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
              {d.averageScore}%
            </span>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-lowest-topic">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-medium">Lowest Performing Topic</span>
            </div>
            {d.lowestPerformingTopic ? (
              <>
                <span className="text-sm font-semibold truncate">{d.lowestPerformingTopic.topic}</span>
                <span className="text-xs text-red-600 dark:text-red-400">{d.lowestPerformingTopic.averageScore}% avg</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No data yet</span>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-metric-highest-topic">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Highest Performing Topic</span>
            </div>
            {d.highestPerformingTopic ? (
              <>
                <span className="text-sm font-semibold truncate">{d.highestPerformingTopic.topic}</span>
                <span className="text-xs text-green-600 dark:text-green-400">{d.highestPerformingTopic.averageScore}% avg</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No data yet</span>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-metric-completion-rate">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Percent className="h-4 w-4" />
              <span className="text-xs font-medium">Completion Rate</span>
            </div>
            <span className="text-2xl font-bold">{d.completionRate}%</span>
            <span className="text-xs text-muted-foreground">quizzes with submissions</span>
          </CardContent>
        </Card>
      </div>

      {d.totalQuizzes === 0 && (
        <Card>
          <CardContent className="p-6 text-center flex flex-col items-center gap-3">
            <GraduationCap className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Create your first quiz to start seeing performance data here.
            </p>
            <Link href="/full?mode=educators">
              <Button data-testid="button-create-first-quiz-educator">
                <BookOpen className="h-4 w-4 mr-2" />
                Create Your First Quiz
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NeedsAttentionTab({ data, isLoading }: { data: EducatorDashboardData | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  const na = data?.needsAttention || { strugglingStudents: [], lowestTopic: null, incompleteAttempts: 0 };
  const hasAttentionItems = na.strugglingStudents.length > 0 || na.incompleteAttempts > 0 || na.lowestTopic;

  if (!hasAttentionItems) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <Target className="h-12 w-12 text-green-500/50" />
        <h3 className="text-lg font-semibold">Everything looks good</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          No students or topics need immediate attention right now. Keep up the great work!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {na.strugglingStudents.length > 0 && (
          <Card data-testid="card-attention-struggling-students">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold">Students Scoring &lt; 60%</span>
              </div>
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">{na.strugglingStudents.length}</span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {na.strugglingStudents.slice(0, 5).map((s) => (
                  <div key={s.studentId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground truncate">
                      {s.studentId.length > 20 ? `Student ${s.studentId.slice(-6)}` : s.studentId}
                    </span>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {s.averageScore}% avg
                    </Badge>
                  </div>
                ))}
                {na.strugglingStudents.length > 5 && (
                  <span className="text-xs text-muted-foreground">+{na.strugglingStudents.length - 5} more</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {na.lowestTopic && na.lowestTopic.averageScore !== null && (
          <Card data-testid="card-attention-lowest-topic">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold">Weakest Topic</span>
              </div>
              <span className="text-sm font-medium">{na.lowestTopic.topic}</span>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${(na.lowestTopic.averageScore ?? 0) < 50 ? "bg-red-500" : "bg-amber-500"}`}
                  style={{ width: `${na.lowestTopic.averageScore}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{na.lowestTopic.averageScore}% class average</span>
            </CardContent>
          </Card>
        )}

        {na.incompleteAttempts > 0 && (
          <Card data-testid="card-attention-incomplete">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold">Incomplete Attempts</span>
              </div>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{na.incompleteAttempts}</span>
              <span className="text-xs text-muted-foreground">students started but didn't finish</span>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ data, isLoading }: { data: OverviewData | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex justify-center"><Skeleton className="h-36 w-36 rounded-full" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!data || data.totalQuizzes === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <GraduationCap className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="text-lg font-semibold">Your performance journey starts here</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Complete your first quiz to unlock insights, track weak areas, and build your study momentum.
        </p>
        <Link href="/full?mode=students">
          <Button data-testid="button-start-first-quiz">
            <BookOpen className="h-4 w-4 mr-2" />
            Start Your First Quiz
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        <CircularProgress score={data.readinessScore} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Quizzes" value={data.totalQuizzes} icon={FileText} />
        <StatCard label="Total Questions" value={data.totalQuestions} icon={HelpCircle} />
        <StatCard label="Average Score" value={`${data.averageScore}%`} icon={Target} />
        <StatCard
          label="7-Day Trend"
          value={data.trend7d !== null ? `${data.trend7d}%` : "--"}
          icon={TrendingUp}
          subtext={data.trend30d !== null ? `30d: ${data.trend30d}%` : undefined}
        />
      </div>

      {data.weakTopics.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Weak Topics
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {data.weakTopics.map((topic) => (
              <Card key={topic.topic} data-testid={`card-weak-topic-${topic.topic}`}>
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-sm">{topic.topic}</span>
                    <Badge variant="secondary" className={getAccuracyBg(topic.accuracy)}>
                      <span className={getAccuracyColor(topic.accuracy)}>{topic.accuracy}%</span>
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {topic.totalQuestions} questions answered
                    {topic.recentAccuracy > 0 && ` · Recent: ${topic.recentAccuracy}%`}
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${topic.accuracy < 50 ? "bg-red-500" : "bg-amber-500"}`}
                      style={{ width: `${topic.accuracy}%` }}
                    />
                  </div>
                  <Link href="/full?mode=students">
                    <Button variant="outline" size="sm" data-testid={`button-practice-${topic.topic}`}>
                      Practice Now
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {data.recentActivity.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Recent Activity
          </h3>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.recentActivity.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 p-4 flex-wrap" data-testid={`activity-${item.id}`}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(item.completedAt)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.timeUsedSeconds > 0 && (
                        <span className="text-xs text-muted-foreground">{formatTime(item.timeUsedSeconds)}</span>
                      )}
                      <Badge variant="secondary" className={getAccuracyBg(item.percentage)}>
                        <span className={getAccuracyColor(item.percentage)}>{item.score}/{item.maxScore} ({item.percentage}%)</span>
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function PracticeTab({ overview, history, isOverviewLoading, isHistoryLoading }: {
  overview: OverviewData | undefined;
  history: { history: QuizHistoryItem[] } | undefined;
  isOverviewLoading: boolean;
  isHistoryLoading: boolean;
}) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const toggleTopic = (topic: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <Link href="/full?mode=students">
          <Button data-testid="button-practice-weaknesses">
            <Target className="h-4 w-4 mr-2" />
            Practice My Weaknesses
          </Button>
        </Link>
        <Link href="/full">
          <Button variant="outline" data-testid="button-full-quiz">
            <BookOpen className="h-4 w-4 mr-2" />
            Full Quiz
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          Quiz History
        </h3>
        {isHistoryLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : !history?.history?.length ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No completed quizzes yet.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {history.history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 p-4 flex-wrap" data-testid={`history-${item.id}`}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{item.title}</span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(item.completedAt)}</span>
                        <span>{item.questionCount} questions</span>
                        <Badge variant="outline" className="text-xs">{item.questionType}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.timeUsedSeconds > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(item.timeUsedSeconds)}
                        </span>
                      )}
                      <Badge variant="secondary" className={getAccuracyBg(item.percentage)}>
                        <span className={getAccuracyColor(item.percentage)}>{item.percentage}%</span>
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Topic Breakdown
        </h3>
        {isOverviewLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !overview?.topicBreakdown?.length ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No topic data yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {overview.topicBreakdown.map((topic) => {
              const isExpanded = expandedTopics.has(topic.topic);
              return (
                <Card key={topic.topic}>
                  <CardContent className="p-0">
                    <button
                      className="w-full flex items-center justify-between gap-3 p-4 text-left hover-elevate active-elevate-2 rounded-md"
                      onClick={() => toggleTopic(topic.topic)}
                      data-testid={`button-topic-${topic.topic}`}
                    >
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{topic.topic}</span>
                          <Badge variant="secondary" className={`${getAccuracyBg(topic.accuracy)}`}>
                            <span className={getAccuracyColor(topic.accuracy)}>{topic.accuracy}%</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{topic.totalQuestions} questions</span>
                          {topic.recentAccuracy > 0 && <span>Recent: {topic.recentAccuracy}%</span>}
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                          <div
                            className={`h-1.5 rounded-full transition-all ${topic.accuracy < 50 ? "bg-red-500" : topic.accuracy < 70 ? "bg-amber-500" : "bg-green-500"}`}
                            style={{ width: `${topic.accuracy}%` }}
                          />
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    </button>
                    {isExpanded && topic.subtopics.length > 0 && (
                      <div className="px-4 pb-4 flex flex-col gap-1">
                        {topic.subtopics.map((sub) => (
                          <div key={sub.subtopic} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-muted/50 text-sm">
                            <span className="text-muted-foreground truncate">{sub.subtopic}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground">{sub.count}q</span>
                              <span className={`text-xs font-medium ${getAccuracyColor(sub.accuracy)}`}>{sub.accuracy}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewTab({ wrongAnswers, isLoading }: { wrongAnswers: { wrongAnswers: WrongAnswer[] } | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  if (!wrongAnswers?.wrongAnswers?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500/50" />
        <h3 className="text-lg font-semibold">No Wrong Answers</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Great job! You haven't gotten any answers wrong yet, or you haven't taken any quizzes.
        </p>
      </div>
    );
  }

  const grouped = new Map<string, WrongAnswer[]>();
  for (const wa of wrongAnswers.wrongAnswers) {
    const topic = wa.topic || "General";
    if (!grouped.has(topic)) grouped.set(topic, []);
    grouped.get(topic)!.push(wa);
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(grouped.entries()).map(([topic, answers]) => (
        <div key={topic} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{topic}</h3>
          <div className="flex flex-col gap-3">
            {answers.map((wa) => (
              <Card key={wa.answer_id} data-testid={`wrong-answer-${wa.answer_id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <CardTitle className="text-sm font-medium leading-snug flex-1">{wa.question_text}</CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      {wa.difficulty && (
                        <Badge variant="outline" className="text-xs">{wa.difficulty}</Badge>
                      )}
                      <Badge variant="secondary" className="bg-red-500/10">
                        <span className="text-red-600 dark:text-red-400 text-xs">{wa.score}/{wa.max_marks}</span>
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{wa.quiz_title}</span>
                    {wa.subtopic && <span>{wa.subtopic}</span>}
                    <span>{formatDate(wa.completed_at)}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-muted-foreground">Your Answer</span>
                        <span className="text-sm">{wa.user_answer || "(No answer provided)"}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-muted-foreground">Model Answer</span>
                        <span className="text-sm">{wa.model_answer || "--"}</span>
                      </div>
                    </div>
                  </div>
                  {wa.feedback && (
                    <div className="p-3 bg-muted/50 rounded-md">
                      <span className="text-xs font-medium text-muted-foreground">Feedback</span>
                      <p className="text-sm mt-0.5">{wa.feedback}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StudyDashboard() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { mode } = useMode();
  const isEducatorMode = mode === "educators";

  const { data: overviewData, isLoading: overviewLoading } = useQuery<OverviewData>({
    queryKey: ["/api/study-dashboard/overview"],
    enabled: !isEducatorMode,
  });

  const { data: educatorData, isLoading: educatorLoading } = useQuery<EducatorDashboardData>({
    queryKey: ["/api/educator/dashboard"],
    enabled: isEducatorMode,
  });

  const { data: wrongAnswersData, isLoading: wrongAnswersLoading } = useQuery<{ wrongAnswers: WrongAnswer[] }>({
    queryKey: ["/api/study-dashboard/wrong-answers"],
    enabled: activeTab === "review" && !isEducatorMode,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<{ history: QuizHistoryItem[] }>({
    queryKey: ["/api/study-dashboard/quiz-history"],
    enabled: activeTab === "practice",
  });

  const baseTabs: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "practice", label: "Assignments", icon: GraduationCap },
    { id: "review", label: "Insights", icon: BookOpen },
  ];

  const tabs = isEducatorMode
    ? [...baseTabs, { id: "attention" as TabId, label: "Needs Attention", icon: AlertTriangle }]
    : baseTabs;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/full")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold" data-testid="text-page-title">
              {isEducatorMode ? "Educator Dashboard" : "My Study Dashboard"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEducatorMode ? "Monitor class performance and identify learning gaps" : "Track your progress and build study momentum"}
            </p>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-muted rounded-md">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover-elevate"
                }`}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "overview" && isEducatorMode && (
          <EducatorOverviewTab data={educatorData} isLoading={educatorLoading} />
        )}

        {activeTab === "overview" && !isEducatorMode && (
          <OverviewTab data={overviewData} isLoading={overviewLoading} />
        )}

        {activeTab === "practice" && !isEducatorMode && (
          <PracticeTab
            overview={overviewData}
            history={historyData}
            isOverviewLoading={overviewLoading}
            isHistoryLoading={historyLoading}
          />
        )}

        {activeTab === "practice" && isEducatorMode && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-3">
              <Button asChild data-testid="button-create-new-quiz">
                <a href="/full?mode=educators">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Create New Quiz
                </a>
              </Button>
              <Button variant="outline" asChild data-testid="button-view-all-quizzes">
                <a href="/educator-dashboard">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View All Quiz Results
                </a>
              </Button>
            </div>
            {historyLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : !historyData?.history?.length ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">No quizzes created yet. Create your first quiz to see it here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  Recent Quizzes
                </h3>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {historyData.history.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 p-4 flex-wrap" data-testid={`quiz-history-${item.id}`}>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{item.title}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(item.completedAt)}</span>
                          </div>
                          <Badge variant="secondary">
                            <span className="text-xs">{item.score}/{item.maxScore} ({item.percentage}%)</span>
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {activeTab === "review" && !isEducatorMode && (
          <ReviewTab wrongAnswers={wrongAnswersData} isLoading={wrongAnswersLoading} />
        )}

        {activeTab === "review" && isEducatorMode && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">Class Insights</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Detailed class insights and analytics are available on the full educator dashboard.
            </p>
            <Button asChild data-testid="button-go-full-educator-dashboard">
              <a href="/educator-dashboard">
                <GraduationCap className="h-4 w-4 mr-2" />
                Open Educator Dashboard
              </a>
            </Button>
          </div>
        )}

        {activeTab === "attention" && isEducatorMode && (
          <NeedsAttentionTab data={educatorData} isLoading={educatorLoading} />
        )}
      </div>
    </div>
  );
}
