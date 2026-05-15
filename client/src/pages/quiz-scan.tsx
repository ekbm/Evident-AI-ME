import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  GraduationCap,
  Trophy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lightbulb,
  ChevronLeft,
  Send,
  Clock,
  ArrowRight,
  Hash,
  User,
} from "lucide-react";

interface QuizQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  questionType: string;
  options?: string[];
  maxMarks: number;
}

interface QuizInfo {
  id: string;
  title: string;
  questionCount: number;
  questionType: string;
  createdAt: string;
  timeLimitSeconds: number | null;
  teacherName: string;
  teacherEmail: string;
  questions: QuizQuestion[];
}

interface GradedAnswer {
  questionId: string;
  questionNumber: number;
  questionText: string;
  userAnswer: string;
  modelAnswer: string;
  score: number;
  maxMarks: number;
  isCorrect: boolean;
  feedback: string;
}

interface SubmitResult {
  totalScore: number;
  maxScore: number;
  percentageScore: number;
  studentNumber: string | null;
  overallFeedback: string;
  answers: GradedAnswer[];
}

type PageStep = "student-number" | "taking-quiz" | "results";

export default function QuizScanPage() {
  const [, setLocation] = useLocation();
  const [, paramsWithStudent] = useRoute("/quiz/scan/:quizId/:studentNumber");
  const [, paramsBase] = useRoute("/quiz/scan/:quizId");
  const quizId = paramsWithStudent?.quizId || paramsBase?.quizId || "";
  const urlStudentNumber = paramsWithStudent?.studentNumber || null;

  const [step, setStep] = useState<PageStep>(urlStudentNumber ? "taking-quiz" : "student-number");
  const [studentNumber, setStudentNumber] = useState(urlStudentNumber || "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [startTime] = useState(Date.now());

  const { data: quizInfo, isLoading: quizLoading, error: quizError } = useQuery<QuizInfo>({
    queryKey: ["/api/quiz", quizId, "take"],
    queryFn: async () => {
      const res = await fetch(`/api/quiz/${quizId}/take`);
      if (!res.ok) throw new Error("Quiz not found");
      return res.json();
    },
    enabled: !!quizId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
      }));
      const timeUsedSeconds = Math.round((Date.now() - startTime) / 1000);
      const res = await fetch(`/api/quiz/${quizId}/take-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentNumber: studentNumber || null,
          answers: answersArray,
          timeUsedSeconds,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Submit failed" }));
        throw new Error(err.error || "Failed to submit quiz");
      }
      return res.json() as Promise<SubmitResult>;
    },
    onSuccess: (data) => {
      setSubmitResult(data);
      setStep("results");
    },
  });

  const handleStartQuiz = () => {
    if (!studentNumber.trim()) return;
    setStep("taking-quiz");
  };

  const handleSubmit = () => {
    submitMutation.mutate();
  };

  const answeredCount = quizInfo?.questions
    ? quizInfo.questions.filter(q => answers[q.id]?.trim()).length
    : 0;

  const teacherDisplay = quizInfo?.teacherName || quizInfo?.teacherEmail || "";

  if (quizLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          <p className="text-sm text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (quizError || !quizInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-center">Quiz Not Found</h2>
            <p className="text-sm text-muted-foreground text-center">
              This quiz may have been deleted or is no longer available.
            </p>
            <Button
              variant="outline"
              onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }}
              data-testid="button-go-home"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "results" && submitResult) {
    const scoreColor =
      submitResult.percentageScore >= 70
        ? "text-green-600 dark:text-green-400"
        : submitResult.percentageScore >= 50
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";

    const scoreBgColor =
      submitResult.percentageScore >= 70
        ? "bg-green-100 dark:bg-green-900/30"
        : submitResult.percentageScore >= 50
          ? "bg-amber-100 dark:bg-amber-900/30"
          : "bg-red-100 dark:bg-red-900/30";

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <GraduationCap className="h-6 w-6 text-cyan-600" />
            <h1 className="text-xl font-bold">Quiz Results</h1>
            {submitResult.studentNumber && (
              <Badge variant="secondary" className="ml-auto" data-testid="badge-student-number">Student #{submitResult.studentNumber}</Badge>
            )}
          </div>

          {teacherDisplay && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Teacher: {teacherDisplay}</span>
            </div>
          )}

          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="text-center text-sm text-muted-foreground font-medium">{quizInfo.title}</div>
              <div className={`flex flex-col items-center gap-2 p-6 rounded-md ${scoreBgColor}`}>
                <Trophy className="h-8 w-8 text-cyan-600 mb-1" />
                <span className={`text-5xl font-bold ${scoreColor}`} data-testid="text-score-percentage">
                  {Math.round(submitResult.percentageScore)}%
                </span>
                <span className="text-sm text-muted-foreground" data-testid="text-raw-score">
                  {submitResult.totalScore} / {submitResult.maxScore} marks
                </span>
              </div>

              {submitResult.overallFeedback && (
                <div className="flex gap-3 p-4 rounded-md bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800">
                  <Lightbulb className="h-5 w-5 text-cyan-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-cyan-800 dark:text-cyan-200">
                    {submitResult.overallFeedback}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <h4 className="font-semibold text-base mt-2">Answer Breakdown</h4>

          <div className="flex flex-col gap-3 pb-8">
            {submitResult.answers.map((ans) => {
              const isCorrect = ans.isCorrect;
              const isPartial = !isCorrect && ans.score > 0;

              return (
                <Card key={ans.questionNumber} data-testid={`result-q-${ans.questionNumber}`}>
                  <CardContent className="pt-4 pb-4 flex flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium text-sm flex-1">
                        {ans.questionNumber}. {ans.questionText}
                      </p>
                      <div className="flex items-center gap-1">
                        {isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : isPartial ? (
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                        <span className="text-sm font-medium">
                          {ans.score}/{ans.maxMarks}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 text-sm">
                      <div>
                        <span className="font-medium text-muted-foreground">Your answer: </span>
                        <span>{ans.userAnswer || "(no answer)"}</span>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Correct answer: </span>
                        <span className="text-green-700 dark:text-green-300">{ans.modelAnswer || "N/A"}</span>
                      </div>
                      {ans.feedback && (
                        <div className="text-muted-foreground italic mt-1 flex gap-2 text-xs">
                          <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{ans.feedback}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-950/20">
            <CardContent className="pt-4 pb-4 flex items-start gap-3">
              <GraduationCap className="h-5 w-5 text-cyan-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-cyan-800 dark:text-cyan-200 mb-1">Get more from Evident</p>
                <p className="text-cyan-700 dark:text-cyan-300">
                  Create a free account to access your full dashboard, save results, generate quizzes from your own documents, and more.
                </p>
                <Button
                  variant="link"
                  className="p-0 h-auto mt-1 text-cyan-600 dark:text-cyan-400"
                  onClick={() => { window.location.href = "/auth"; }}
                  data-testid="link-signup-from-quiz"
                >
                  Create a free account
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 pb-8">
            <Button
              onClick={() => {
                setAnswers({});
                setSubmitResult(null);
                setStep("taking-quiz");
              }}
              variant="outline"
              className="w-full border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300"
              data-testid="button-retry-quiz"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button
              onClick={() => { try { window.close(); } catch(e) {} sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }}
              variant="ghost"
              className="w-full"
              data-testid="button-exit-quiz"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Exit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "student-number") {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="h-6 w-6 text-cyan-600" />
              <CardTitle className="text-lg">Online Quiz</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">{quizInfo.title}</p>
            {teacherDisplay && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <User className="h-3.5 w-3.5" />
                <span>By: {teacherDisplay}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="secondary">{quizInfo.questionCount} questions</Badge>
              <Badge variant="outline">{quizInfo.questionType}</Badge>
              {quizInfo.timeLimitSeconds && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.round(quizInfo.timeLimitSeconds / 60)} min
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="student-number" className="text-sm font-medium">
                Enter your Student Number
              </Label>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="student-number"
                  placeholder="e.g. 1, 2, 3 or your ID"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleStartQuiz(); }}
                  data-testid="input-student-number"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This is the student number from your printed quiz sheet. Your teacher uses it to track your results.
              </p>
            </div>

            <Button
              onClick={handleStartQuiz}
              disabled={!studentNumber.trim()}
              className="bg-cyan-600 text-white border-cyan-700 w-full"
              data-testid="button-start-quiz"
            >
              Start Quiz
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <GraduationCap className="h-6 w-6 text-cyan-600" />
          <h1 className="text-lg font-bold flex-1">{quizInfo.title}</h1>
          {studentNumber && (
            <Badge variant="secondary" data-testid="badge-student-taking">Student #{studentNumber}</Badge>
          )}
        </div>

        {teacherDisplay && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>Teacher: {teacherDisplay}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{answeredCount} of {quizInfo.questions.length} answered</span>
          <Badge variant={answeredCount === quizInfo.questions.length ? "default" : "outline"}>
            {answeredCount === quizInfo.questions.length ? "All answered" : `${quizInfo.questions.length - answeredCount} remaining`}
          </Badge>
        </div>

        <div className="flex flex-col gap-4">
          {quizInfo.questions.map((q) => (
            <Card key={q.id} data-testid={`question-card-${q.questionNumber}`}>
              <CardContent className="pt-4 pb-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-sm flex-1">
                    {q.questionNumber}. {q.questionText}
                  </p>
                  <Badge variant="outline" className="text-xs shrink-0">{q.maxMarks} mark{q.maxMarks !== 1 ? "s" : ""}</Badge>
                </div>

                {q.questionType === "multiple_choice" && q.options ? (
                  <RadioGroup
                    value={answers[q.id] || ""}
                    onValueChange={(val) => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                    data-testid={`radio-group-${q.questionNumber}`}
                  >
                    {q.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-md hover-elevate">
                        <RadioGroupItem value={opt} id={`q${q.id}-opt${i}`} data-testid={`radio-q${q.questionNumber}-opt${i}`} />
                        <Label htmlFor={`q${q.id}-opt${i}`} className="text-sm cursor-pointer flex-1">
                          {String.fromCharCode(65 + i)}. {opt}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : q.questionType === "short_answer" ? (
                  <Input
                    placeholder="Type your answer..."
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    data-testid={`input-answer-${q.questionNumber}`}
                  />
                ) : (
                  <Textarea
                    placeholder="Write your answer here..."
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    rows={4}
                    data-testid={`textarea-answer-${q.questionNumber}`}
                    className="resize-none"
                  />
                )}

                {answers[q.id]?.trim() && (
                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Answered</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="sticky bottom-4 border-cyan-200 dark:border-cyan-800 bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-4 pb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-medium">{answeredCount}/{quizInfo.questions.length}</span>
              <span className="text-muted-foreground ml-1">questions answered</span>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || answeredCount === 0}
              className="bg-cyan-600 text-white border-cyan-700"
              data-testid="button-submit-quiz"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Grading...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Quiz
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {submitMutation.isError && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">
              {submitMutation.error?.message || "Failed to submit. Please try again."}
            </p>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
