import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { escapeHtml, printHtml } from "@/lib/print-utils";
import QRCode from "qrcode";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  Camera,
  Send,
  RotateCcw,
  Plus,
  History,
  Trash2,
  Trophy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Timer,
  BookOpen,
  GraduationCap,
  Printer,
  ScanLine,
  Upload,
  Target,
  Lightbulb,
  Eye,
  X,
  Users,
  Monitor,
  FileImage,
} from "lucide-react";
import type { Asset } from "@shared/schema";

interface StudyQuizProps {
  assets: Asset[];
  selectedAssetIds: string[];
  isVisible: boolean;
  isTrialMode?: boolean;
  canGenerateQuiz?: boolean;
}

type QuizView = "setup" | "taking" | "results" | "scan" | "scan-results";

interface QuizQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  questionType: "multiple_choice" | "short_answer" | "essay";
  options?: string[] | null;
  maxMarks: number;
  modelAnswer?: string;
}

interface QuizData {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

interface AttemptData {
  id: string;
}

interface SubmitResult {
  totalScore: number;
  maxScore: number;
  percentageScore: number;
  timeUsedSeconds: number;
  answers: Array<{
    questionId: string;
    score: number;
    maxMarks: number;
    isCorrect: boolean;
    feedback: string;
    answer?: string;
  }>;
  questions: QuizQuestion[];
}

interface ScanGradeResult {
  totalScore: number;
  maxScore: number;
  percentageScore: number;
  overallFeedback: string;
  answers: Array<{
    questionId: string;
    questionNumber: number;
    readText: string;
    score: number;
    maxMarks: number;
    isCorrect: boolean;
    coverage: string;
    accuracy: string;
    clarity: string;
    feedback: string;
  }>;
  questions: QuizQuestion[];
}

interface QuizHistoryItem {
  id: string;
  title: string;
  questionCount: number;
  questionType: string;
  status: string;
  createdAt: string;
  attempts?: Array<{
    id: string;
    totalScore: number;
    maxScore: number;
    percentageScore: number;
    completedAt: string;
  }>;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function StudyQuiz({ assets, selectedAssetIds, isVisible, isTrialMode = false, canGenerateQuiz = true }: StudyQuizProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const teacherName = user?.firstName || "";
  const teacherEmail = user?.email || "";

  const [view, setView] = useState<QuizView>("setup");
  const [samplePaperFile, setSamplePaperFile] = useState<File | null>(null);
  const [samplePaperUploading, setSamplePaperUploading] = useState(false);
  const [samplePaperId, setSamplePaperId] = useState<string>("");
  const [questionCount, setQuestionCount] = useState(5);
  const [questionType, setQuestionType] = useState("mixed");
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null);
  const [customTimeMinutes, setCustomTimeMinutes] = useState("");
  const [showCustomTime, setShowCustomTime] = useState(false);

  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [attemptData, setAttemptData] = useState<AttemptData | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confidences, setConfidences] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [quizStartTime, setQuizStartTime] = useState<number | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  const [results, setResults] = useState<SubmitResult | null>(null);
  const [scanResults, setScanResults] = useState<ScanGradeResult | null>(null);
  const [scanQuizId, setScanQuizId] = useState<string | null>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printCopies, setPrintCopies] = useState(1);
  const [pendingPrintData, setPendingPrintData] = useState<{ quizId: string; title: string; questions: QuizQuestion[] } | null>(null);
  const [viewingSubmissionsQuizId, setViewingSubmissionsQuizId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const autoSubmitTriggered = useRef(false);

  const readyAssets = assets.filter((a) => a.status === "READY");

  const selectedReadyIds = selectedAssetIds.filter((id) =>
    readyAssets.some((a) => a.id === id)
  );

  const quizHistoryKey = "/api/quiz/history";

  const { data: quizHistory, isLoading: historyLoading } = useQuery<QuizHistoryItem[]>({
    queryKey: [quizHistoryKey],
    enabled: isVisible,
  });

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

  const { data: submissionsData, isLoading: submissionsLoading } = useQuery<SubmissionsData>({
    queryKey: ["/api/quiz", viewingSubmissionsQuizId, "submissions"],
    queryFn: async () => {
      const res = await fetch(`/api/quiz/${viewingSubmissionsQuizId}/submissions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!viewingSubmissionsQuizId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        documentIds: selectedReadyIds,
        questionCount,
        questionType,
      };
      if (samplePaperId) body.samplePaperId = samplePaperId;
      if (timeLimitSeconds) body.timeLimitSeconds = timeLimitSeconds;
      const res = await apiRequest("POST", "/api/quiz/generate", body);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [quizHistoryKey] });
      setQuizData(data.quiz);
      startMutation.mutate(data.quiz.id);
    },
    onError: (error: Error) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    },
  });

  const startMutation = useMutation({
    mutationFn: async (quizId: string) => {
      const res = await apiRequest("POST", `/api/quiz/${quizId}/start`);
      return res.json();
    },
    onSuccess: (data) => {
      setAttemptData(data.attempt);
      setQuestions(data.questions);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setConfidences({});
      autoSubmitTriggered.current = false;
      const startTime = Date.now();
      setQuizStartTime(startTime);

      if (data.timeLimitSeconds) {
        setTimeRemaining(data.timeLimitSeconds);
      } else {
        setTimeRemaining(null);
      }

      setView("taking");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start quiz", description: error.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!quizData || !attemptData) throw new Error("No active quiz");
      const timeUsedSeconds = quizStartTime
        ? Math.floor((Date.now() - quizStartTime) / 1000)
        : 0;
      const answerArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
        confidence: confidences[questionId] || null,
      }));
      const body = {
        attemptId: attemptData.id,
        answers: answerArray,
        timeUsedSeconds,
      };
      const res = await apiRequest("POST", `/api/quiz/${quizData.id}/submit`, body);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [quizHistoryKey] });
      setResults(data);
      setView("results");
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    },
    onError: (error: Error) => {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (quizId: string) => {
      await apiRequest("DELETE", `/api/quiz/${quizId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [quizHistoryKey] });
      toast({ title: "Quiz deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const scanGradeMutation = useMutation({
    mutationFn: async ({ quizId, photo }: { quizId: string; photo: File }) => {
      const formData = new FormData();
      formData.append("photo", photo);
      const res = await fetch(`/api/quiz/${quizId}/scan-grade`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Scan failed" }));
        throw new Error(err.error || "Failed to scan and grade");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [quizHistoryKey] });
      setScanResults(data);
      setView("scan-results");
    },
    onError: (error: Error) => {
      toast({ title: "Scan & Grade failed", description: error.message, variant: "destructive" });
    },
  });

  const handlePrintQuiz = (quizId: string, title: string, questionsList: QuizQuestion[]) => {
    setPendingPrintData({ quizId, title, questions: questionsList });
    setPrintCopies(1);
    setShowPrintDialog(true);
  };

  const executePrint = async () => {
    if (!pendingPrintData) return;
    const { quizId, title, questions: questionsList } = pendingPrintData;
    setShowPrintDialog(false);

    const copies = Math.max(1, Math.min(printCopies, 100));
    const teacherDisplay = teacherName || teacherEmail || "";
    const allCopiesHtml: string[] = [];

    for (let copyNum = 1; copyNum <= copies; copyNum++) {
      const scanUrl = copies > 1
        ? `${window.location.origin}/quiz/scan/${quizId}/${copyNum}`
        : `${window.location.origin}/quiz/scan/${quizId}`;
      let qrDataUrl = "";
      try {
        qrDataUrl = await QRCode.toDataURL(scanUrl, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: "H",
          color: { dark: "#000000", light: "#ffffff" },
        });
      } catch (e) {
        console.error("QR code generation failed:", e);
      }

      const questionsHtml = questionsList
        .map((q) => {
          let answerArea = "";
          if (q.questionType === "multiple_choice" && q.options) {
            answerArea = q.options
              .map((opt, i) => `<div style="margin: 6px 0; padding: 4px 0;"><span style="display: inline-block; width: 20px; height: 20px; border: 2px solid #999; border-radius: 50%; margin-right: 10px; vertical-align: middle;"></span> ${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}</div>`)
              .join("");
          } else if (q.questionType === "short_answer") {
            answerArea = `<div style="margin-top: 10px; border-bottom: 1.5px solid #ccc; height: 40px;"></div>`;
          } else {
            answerArea = Array(5)
              .fill(`<div style="margin-top: 8px; border-bottom: 1.5px solid #ccc; height: 30px;"></div>`)
              .join("");
          }
          return `
            <div style="margin-bottom: 28px; page-break-inside: avoid;">
              <p style="font-weight: 600; margin-bottom: 6px; font-size: 14px;">
                ${q.questionNumber}. ${escapeHtml(q.questionText)}
                <span style="color: #888; font-weight: 400; font-size: 12px; margin-left: 8px;">[${q.maxMarks} mark${q.maxMarks !== 1 ? "s" : ""}]</span>
              </p>
              ${answerArea}
            </div>`;
        })
        .join("");

      const studentLabel = copies > 1 ? `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 10px 14px; border: 2px solid #333; border-radius: 6px; background: #f8f8f8;">
          <div style="font-size: 18px; font-weight: 700;">Student #${copyNum}</div>
          <div style="font-size: 13px; color: #555;">Copy ${copyNum} of ${copies}</div>
        </div>` : "";

      const teacherLine = teacherDisplay
        ? `<div style="font-size: 12px; color: #555; margin-bottom: 8px;">Teacher: ${escapeHtml(teacherDisplay)}${teacherEmail && teacherName ? ` (${escapeHtml(teacherEmail)})` : ""}</div>`
        : "";

      const qrBarHtml = qrDataUrl ? `
        <div style="display: flex; align-items: center; gap: 14px; padding: 10px 14px; border: 2px solid #ccc; border-radius: 8px; background: #fafafa; margin-bottom: 14px;">
          <img src="${qrDataUrl}" alt="QR Code" style="width: 90px; height: 90px;" />
          <div style="flex: 1;">
            <p style="font-weight: 700; font-size: 13px; margin: 0 0 4px 0; color: #111;">Scan to Take Quiz Online</p>
            ${teacherDisplay ? `<p style="font-size: 11px; color: #444; margin: 0 0 3px 0;">Teacher: ${escapeHtml(teacherDisplay)}${teacherEmail && teacherName ? ` (${escapeHtml(teacherEmail)})` : ""}</p>` : ""}
            <p style="font-size: 9px; color: #888; margin: 0; word-break: break-all;">${scanUrl}</p>
            ${copies > 1 ? `<p style="font-size: 12px; color: #111; margin: 4px 0 0 0; font-weight: 700;">Student #${copyNum}</p>` : ""}
          </div>
        </div>` : "";

      const qrFooterHtml = qrDataUrl ? `
        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #ccc; display: flex; align-items: center; gap: 16px; page-break-inside: avoid;">
          <img src="${qrDataUrl}" alt="QR Code" style="width: 120px; height: 120px;" />
          <div>
            <p style="font-weight: 700; font-size: 14px; margin: 0 0 5px 0; color: #111;">Scan QR Code to Take This Quiz Online</p>
            ${teacherDisplay ? `<p style="font-size: 12px; color: #444; margin: 0 0 4px 0;">Teacher: ${escapeHtml(teacherDisplay)}${teacherEmail && teacherName ? ` (${escapeHtml(teacherEmail)})` : ""}</p>` : ""}
            <p style="font-size: 11px; color: #555; margin: 0 0 4px 0;">Open your phone camera and point it at the QR code above.</p>
            <p style="font-size: 9px; color: #888; margin: 0; word-break: break-all;">${scanUrl}</p>
            ${copies > 1 ? `<p style="font-size: 13px; color: #111; margin: 6px 0 0 0; font-weight: 700;">Student #${copyNum}</p>` : ""}
          </div>
        </div>` : "";

      const copyHtml = `
        <div class="quiz-copy" style="page-break-after: always;">
          <h1 style="font-size: 22px; margin-bottom: 4px;">${escapeHtml(title)}</h1>
          <div style="color: #666; font-size: 13px; margin-bottom: 4px;">${questionsList.length} questions</div>
          ${teacherLine}
          ${qrBarHtml}
          ${studentLabel}
          <div style="margin: 14px 0 24px; padding: 10px 0; border-bottom: 2px solid #333; font-size: 14px;">Name: __________________________________ &nbsp;&nbsp;&nbsp; Date: ______________</div>
          ${questionsHtml}
          ${qrFooterHtml}
        </div>`;

      allCopiesHtml.push(copyHtml);
    }

    printHtml(`<!DOCTYPE html><html><head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: 'Inter', -apple-system, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 30px; color: #222; }
          .quiz-copy:last-child { page-break-after: avoid; }
          @media print { body { padding: 20px; } }
        </style>
      </head><body>
        ${allCopiesHtml.join("")}
      </body></html>`);
  };

  const handleScanFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scanQuizId) return;

    if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
    setScanPreviewUrl(URL.createObjectURL(file));
    scanGradeMutation.mutate({ quizId: scanQuizId, photo: file });
  };

  const handleStartScan = (quizId: string) => {
    setScanQuizId(quizId);
    setScanResults(null);
    if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
    setScanPreviewUrl(null);
    if (scanFileInputRef.current) scanFileInputRef.current.value = "";
    setView("scan");
  };

  const handleAutoSubmit = useCallback(() => {
    if (autoSubmitTriggered.current) return;
    autoSubmitTriggered.current = true;
    toast({ title: "Time is up", description: "Your quiz has been auto-submitted." });
    submitMutation.mutate();
  }, [submitMutation, toast]);

  useEffect(() => {
    if (view !== "taking" || timeRemaining === null) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        const next = prev - 1;
        if (next <= 0) {
          handleAutoSubmit();
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [view, timeRemaining === null, handleAutoSubmit]);

  useEffect(() => {
    if (view !== "taking") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [view]);

  const samplePaperInputRef = useRef<HTMLInputElement>(null);

  const handleSamplePaperUpload = async (file: File) => {
    setSamplePaperFile(file);
    setSamplePaperUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (data.asset?.id) {
        setSamplePaperId(data.asset.id);
        toast({ title: "Sample paper uploaded", description: file.name });
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      setSamplePaperFile(null);
      if (samplePaperInputRef.current) samplePaperInputRef.current.value = "";
    } finally {
      setSamplePaperUploading(false);
    }
  };

  const setTimePreset = (minutes: number | null) => {
    setShowCustomTime(false);
    setCustomTimeMinutes("");
    setTimeLimitSeconds(minutes ? minutes * 60 : null);
  };

  const applyCustomTime = () => {
    const mins = parseInt(customTimeMinutes, 10);
    if (mins > 0 && mins <= 180) {
      setTimeLimitSeconds(mins * 60);
    }
  };

  const handleGenerate = () => {
    if (selectedReadyIds.length === 0) {
      toast({ title: "No documents selected", description: "Select documents from your Active Files or Knowledge Vault first.", variant: "destructive" });
      return;
    }
    if (!canGenerateQuiz) {
      toast({ title: "Quiz limit reached", description: "You've reached your quiz limit.", variant: "destructive" });
      return;
    }
    generateMutation.mutate();
  };

  const handleSubmitQuiz = () => {
    setShowSubmitDialog(false);
    submitMutation.mutate();
  };

  const handleTryAgain = () => {
    if (quizData) {
      startMutation.mutate(quizData.id);
    }
  };

  const handleNewQuiz = () => {
    setView("setup");
    setQuizData(null);
    setAttemptData(null);
    setQuestions([]);
    setResults(null);
    setScanResults(null);
    setScanQuizId(null);
    if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
    setScanPreviewUrl(null);
    setTimeRemaining(null);
    setQuizStartTime(null);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setConfidences({});
  };

  if (!isVisible) return null;

  const currentQuestion = questions[currentQuestionIndex];
  const isGenerating = generateMutation.isPending || startMutation.isPending;

  const isOverlayView = view === "taking" || view === "results" || view === "scan" || view === "scan-results";

  const renderTakingView = () => {
    if (!currentQuestion) return null;
    const timerColor =
      timeRemaining !== null && timeRemaining <= 60
        ? "text-red-600 dark:text-red-400"
        : timeRemaining !== null && timeRemaining <= 300
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";

    const answeredCount = Object.keys(answers).filter((k) => answers[k]?.trim()).length;

    return (
      <div className="flex flex-col gap-4" data-testid="quiz-taking-screen">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold" data-testid="text-quiz-title">
              {quizData?.title}
            </h3>
            <span className="text-sm text-muted-foreground" data-testid="text-question-progress">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
          </div>
          {timeRemaining !== null && (
            <div className={`flex items-center gap-2 text-2xl font-mono font-bold ${timerColor}`} data-testid="text-timer">
              <Timer className="h-5 w-5" />
              {formatTime(timeRemaining)}
            </div>
          )}
        </div>

        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-cyan-600 h-2 rounded-full transition-all"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            data-testid="progress-bar"
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
            <div className="flex flex-col gap-1">
              <Badge variant="outline" className="w-fit">
                {currentQuestion.questionType === "multiple_choice"
                  ? "Multiple Choice"
                  : currentQuestion.questionType === "short_answer"
                    ? "Short Answer"
                    : "Essay"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {currentQuestion.maxMarks} {currentQuestion.maxMarks === 1 ? "mark" : "marks"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-base font-medium" data-testid={`text-question-${currentQuestion.questionNumber}`}>
              {currentQuestion.questionNumber}. {currentQuestion.questionText}
            </p>

            {currentQuestion.questionType === "multiple_choice" && currentQuestion.options && (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={(val) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: val }))}
                data-testid={`input-answer-${currentQuestion.id}`}
              >
                {currentQuestion.options.map((option, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-md border">
                    <RadioGroupItem
                      value={option}
                      id={`option-${currentQuestion.id}-${i}`}
                      data-testid={`radio-option-${currentQuestion.id}-${i}`}
                    />
                    <Label htmlFor={`option-${currentQuestion.id}-${i}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentQuestion.questionType === "short_answer" && (
              <Input
                placeholder="Type your answer..."
                value={answers[currentQuestion.id] || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                data-testid={`input-answer-${currentQuestion.id}`}
              />
            )}

            {currentQuestion.questionType === "essay" && (
              <Textarea
                placeholder="Write your answer..."
                value={answers[currentQuestion.id] || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                className="min-h-[120px]"
                data-testid={`input-answer-${currentQuestion.id}`}
              />
            )}

            {answers[currentQuestion.id] && (
              <div className="flex flex-col gap-1.5" data-testid={`confidence-selector-${currentQuestion.id}`}>
                <span className="text-xs text-muted-foreground">How confident are you?</span>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as const).map((level) => (
                    <Button
                      key={level}
                      size="sm"
                      variant={confidences[currentQuestion.id] === level ? "default" : "outline"}
                      onClick={() => setConfidences((prev) => ({ ...prev, [currentQuestion.id]: level }))}
                      data-testid={`button-confidence-${level}-${currentQuestion.id}`}
                    >
                      {level === "low" ? "Low" : level === "medium" ? "Medium" : "High"}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
            disabled={currentQuestionIndex === 0}
            data-testid="button-prev-question"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground" data-testid="text-answered-count">
            {answeredCount}/{questions.length} answered
          </span>

          {currentQuestionIndex < questions.length - 1 ? (
            <Button
              onClick={() => setCurrentQuestionIndex((i) => Math.min(questions.length - 1, i + 1))}
              data-testid="button-next-question"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => setShowSubmitDialog(true)}
              disabled={submitMutation.isPending}
              data-testid="button-submit-quiz"
              className="bg-cyan-600 text-white border-cyan-700"
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Submit Quiz
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {quizData && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePrintQuiz(quizData.id, quizData.title, questions)}
              data-testid="button-print-during-quiz"
            >
              <Printer className="h-4 w-4 mr-1" />
              Print Quiz
            </Button>
          )}
          {currentQuestionIndex < questions.length - 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSubmitDialog(true)}
              disabled={submitMutation.isPending}
              data-testid="button-submit-early"
            >
              <Send className="h-4 w-4 mr-1" />
              Submit Quiz Early
            </Button>
          )}
        </div>

        <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Print Quiz</DialogTitle>
              <DialogDescription>
                Choose how many copies to print. Each copy will have a unique student number and QR code for individual grading.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Number of Copies</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={printCopies}
                  onChange={(e) => setPrintCopies(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                  data-testid="input-print-copies"
                />
                <p className="text-xs text-foreground/80 dark:text-muted-foreground">
                  {printCopies === 1
                    ? "Single copy with scan-to-grade QR code"
                    : `${printCopies} copies, each with a unique Student # (1-${printCopies}) and individual QR code for grading`}
                </p>
              </div>
            </div>
            <DialogFooter className="flex flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPrintDialog(false)} data-testid="button-cancel-print">
                Cancel
              </Button>
              <Button onClick={executePrint} className="bg-cyan-600 text-white border-cyan-700" data-testid="button-confirm-print">
                <Printer className="h-4 w-4 mr-1" />
                {printCopies === 1 ? "Print" : `Print ${printCopies} Copies`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Quiz</DialogTitle>
              <DialogDescription>
                You have answered {answeredCount} of {questions.length} questions.
                {answeredCount < questions.length && " Some questions are unanswered."}
                {" "}Are you sure you want to submit?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSubmitDialog(false)} data-testid="button-cancel-submit">
                Cancel
              </Button>
              <Button
                onClick={handleSubmitQuiz}
                disabled={submitMutation.isPending}
                data-testid="button-confirm-submit"
                className="bg-cyan-600 text-white border-cyan-700"
              >
                {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Confirm Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  const renderResultsView = () => {
    if (!results) return null;
    const scoreColor =
      results.percentageScore >= 70
        ? "text-green-600 dark:text-green-400"
        : results.percentageScore >= 50
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";

    const scoreBgColor =
      results.percentageScore >= 70
        ? "bg-green-100 dark:bg-green-900/30"
        : results.percentageScore >= 50
          ? "bg-amber-100 dark:bg-amber-900/30"
          : "bg-red-100 dark:bg-red-900/30";

    const timeLimitForDisplay = quizData && timeLimitSeconds ? timeLimitSeconds : null;

    return (
      <div className="flex flex-col gap-4" data-testid="quiz-results-screen">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cyan-600" />
              Quiz Results
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className={`flex flex-col items-center gap-2 p-6 rounded-md ${scoreBgColor}`}>
              <span className={`text-5xl font-bold ${scoreColor}`} data-testid="text-percentage-score">
                {Math.round(results.percentageScore)}%
              </span>
              <span className="text-sm text-muted-foreground" data-testid="text-raw-score">
                {results.totalScore} / {results.maxScore} marks
              </span>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1" data-testid="text-time-used">
                  <Clock className="h-3.5 w-3.5" />
                  Time used: {formatTime(results.timeUsedSeconds)}
                </span>
                {timeLimitForDisplay && (
                  <span data-testid="text-time-allowed">
                    / {formatTime(timeLimitForDisplay)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={handleTryAgain} disabled={startMutation.isPending} data-testid="button-try-again">
                {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                Try Again
              </Button>
              <Button variant="outline" onClick={handleNewQuiz} data-testid="button-new-quiz">
                <Plus className="h-4 w-4 mr-1" />
                New Quiz
              </Button>
              {quizData && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handlePrintQuiz(quizData.id, quizData.title, results.questions || questions)}
                    data-testid="button-print-results"
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Print Quiz
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleStartScan(quizData.id)}
                    data-testid="button-scan-results"
                  >
                    <ScanLine className="h-4 w-4 mr-1" />
                    Scan & Grade
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => { handleNewQuiz(); }} data-testid="button-view-history">
                <History className="h-4 w-4 mr-1" />
                View History
              </Button>
            </div>
          </CardContent>
        </Card>

        <h4 className="font-semibold text-base mt-2">Question Breakdown</h4>

        <div className="flex flex-col gap-3">
            {(results.questions || questions).map((q, i) => {
              const answerResult = results.answers?.find((a) => a.questionId === q.id);
              const studentAnswer = answers[q.id] || answerResult?.answer || "";
              const isCorrect = answerResult?.isCorrect;
              const score = answerResult?.score ?? 0;
              const maxMarks = answerResult?.maxMarks ?? q.maxMarks;
              const isPartial = !isCorrect && score > 0;

              const borderColor = isCorrect
                ? "border-l-green-500"
                : isPartial
                  ? "border-l-amber-500"
                  : "border-l-red-500";

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-md border ${borderColor} border-l-4`}
                  data-testid={`result-question-${q.questionNumber}`}
                  style={{ borderRadius: 0 }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <p className="font-medium text-sm flex-1">
                      {q.questionNumber}. {q.questionText}
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
                        {score}/{maxMarks}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground">Your answer: </span>
                      <span className={isCorrect ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
                        {studentAnswer || "(No answer)"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Model answer: </span>
                      <span className="text-green-700 dark:text-green-300">
                        {q.modelAnswer || "N/A"}
                      </span>
                    </div>
                    {answerResult?.feedback && (
                      <div className="text-muted-foreground italic mt-1">
                        {answerResult.feedback}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  const renderScanView = () => {
    return (
      <div className="flex flex-col gap-4" data-testid="scan-upload-screen">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-cyan-600" />
              Scan & Grade
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Take a photo of your handwritten answers and let AI grade them for you
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <input
              ref={scanFileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleScanFileSelect}
              data-testid="input-scan-photo"
            />

            {!scanGradeMutation.isPending && !scanPreviewUrl && (
              <div className="flex flex-col items-center gap-4 p-8 rounded-md border-2 border-dashed border-cyan-300 dark:border-cyan-700 bg-cyan-50/30 dark:bg-cyan-950/10">
                <div className="w-16 h-16 rounded-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
                  <Camera className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">Upload a photo of your completed quiz</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Make sure your handwriting is clear and all questions are visible
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    onClick={() => scanFileInputRef.current?.click()}
                    data-testid="button-take-photo"
                    className="bg-cyan-600 text-white border-cyan-700"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (scanFileInputRef.current) {
                        scanFileInputRef.current.removeAttribute("capture");
                        scanFileInputRef.current.click();
                        setTimeout(() => scanFileInputRef.current?.setAttribute("capture", "environment"), 1000);
                      }
                    }}
                    data-testid="button-upload-photo"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload from Gallery
                  </Button>
                </div>
              </div>
            )}

            {scanGradeMutation.isPending && (
              <div className="flex flex-col items-center gap-4 p-8 rounded-md bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                {scanPreviewUrl && (
                  <div className="w-full max-w-sm rounded-md overflow-hidden border">
                    <img src={scanPreviewUrl} alt="Scanned paper" className="w-full h-auto" />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
                  <div className="text-center">
                    <p className="font-medium text-sm text-cyan-700 dark:text-cyan-300">Reading and grading your answers...</p>
                    <p className="text-xs text-cyan-600/80 dark:text-cyan-400/80 mt-1">
                      This usually takes 15-30 seconds
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button variant="outline" onClick={handleNewQuiz} data-testid="button-cancel-scan">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Study & Revision
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderScanResultsView = () => {
    if (!scanResults) return null;
    const scoreColor =
      scanResults.percentageScore >= 70
        ? "text-green-600 dark:text-green-400"
        : scanResults.percentageScore >= 50
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";

    const scoreBgColor =
      scanResults.percentageScore >= 70
        ? "bg-green-100 dark:bg-green-900/30"
        : scanResults.percentageScore >= 50
          ? "bg-amber-100 dark:bg-amber-900/30"
          : "bg-red-100 dark:bg-red-900/30";

    return (
      <div className="flex flex-col gap-4" data-testid="scan-results-screen">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cyan-600" />
              Scan & Grade Results
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className={`flex flex-col items-center gap-2 p-6 rounded-md ${scoreBgColor}`}>
              <span className={`text-5xl font-bold ${scoreColor}`} data-testid="text-scan-percentage">
                {Math.round(scanResults.percentageScore)}%
              </span>
              <span className="text-sm text-muted-foreground" data-testid="text-scan-raw-score">
                {scanResults.totalScore} / {scanResults.maxScore} marks
              </span>
            </div>

            {scanResults.overallFeedback && (
              <div className="flex gap-3 p-4 rounded-md bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800">
                <Lightbulb className="h-5 w-5 text-cyan-600 shrink-0 mt-0.5" />
                <div className="text-sm text-cyan-800 dark:text-cyan-200">
                  {scanResults.overallFeedback}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              {scanQuizId && (
                <Button
                  variant="outline"
                  onClick={() => handleStartScan(scanQuizId)}
                  data-testid="button-rescan"
                >
                  <ScanLine className="h-4 w-4 mr-1" />
                  Scan Again
                </Button>
              )}
              <Button variant="outline" onClick={handleNewQuiz} data-testid="button-back-setup">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Study & Revision
              </Button>
            </div>
          </CardContent>
        </Card>

        <h4 className="font-semibold text-base mt-2">Answer Breakdown</h4>

        <div className="flex flex-col gap-3">
            {scanResults.answers.map((ans) => {
              const question = scanResults.questions?.find((q) => q.questionNumber === ans.questionNumber);
              const isCorrect = ans.isCorrect;
              const isPartial = !isCorrect && ans.score > 0;

              const borderColor = isCorrect
                ? "border-l-green-500"
                : isPartial
                  ? "border-l-amber-500"
                  : "border-l-red-500";

              return (
                <div
                  key={ans.questionNumber}
                  className={`p-4 rounded-md border ${borderColor} border-l-4`}
                  data-testid={`scan-result-q-${ans.questionNumber}`}
                  style={{ borderRadius: 0 }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <p className="font-medium text-sm flex-1">
                      {ans.questionNumber}. {question?.questionText || "Question"}
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

                  <div className="flex flex-col gap-2 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground">What we read: </span>
                      <span className={isCorrect ? "text-green-700 dark:text-green-300" : "text-foreground"}>
                        {ans.readText || "(could not read)"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Expected answer: </span>
                      <span className="text-green-700 dark:text-green-300">
                        {question?.modelAnswer || "N/A"}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 mt-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Target className="h-3.5 w-3.5 shrink-0" />
                        <span><strong>Coverage:</strong> {ans.coverage}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span><strong>Accuracy:</strong> {ans.accuracy}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Eye className="h-3.5 w-3.5 shrink-0" />
                        <span><strong>Clarity:</strong> {ans.clarity}</span>
                      </div>
                    </div>

                    {ans.feedback && (
                      <div className="text-muted-foreground italic mt-1 flex gap-2">
                        <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{ans.feedback}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  if (isOverlayView) {
    const overlayContent =
      view === "taking" ? renderTakingView() :
      view === "results" ? renderResultsView() :
      view === "scan" ? renderScanView() :
      view === "scan-results" ? renderScanResultsView() :
      null;

    return (
      <div
        className="fixed inset-0 z-[100] bg-background flex flex-col"
        data-testid="quiz-overlay"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-background sticky top-0 z-[101]">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-cyan-600" />
            <span className="font-semibold text-sm">
              {view === "taking" ? "Quiz in Progress" :
               view === "results" ? "Quiz Results" :
               view === "scan" ? "Scan & Grade" :
               "Scan Results"}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleNewQuiz}
            data-testid="button-close-quiz-overlay"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-4">
            {overlayContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="quiz-setup-screen">
      <Card className="border-0 shadow-lg bg-gradient-to-b from-card to-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-600 to-cyan-500 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            Study & Revision
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Generate practice questions from your documents to test your knowledge
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Documents to Quiz On</Label>
            {selectedReadyIds.length === 0 ? (
              <div className="p-3 rounded-md border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  No documents selected. Select documents from your Active Files or Knowledge Vault above to generate a quiz.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedReadyIds.map((id) => {
                  const asset = readyAssets.find((a) => a.id === id);
                  if (!asset) return null;
                  return (
                    <Badge key={id} variant="secondary" className="gap-1.5" data-testid={`badge-doc-${id}`}>
                      <FileText className="h-3 w-3" />
                      <span className="max-w-[150px] truncate">{asset.displayName || asset.filename}</span>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Example Question Paper (optional)</Label>
            <p className="text-xs text-muted-foreground">Upload a past exam or sample paper to match its question style</p>
            <input
              ref={samplePaperInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSamplePaperUpload(file);
              }}
              data-testid="input-sample-paper-upload"
            />
            {samplePaperFile ? (
              <div className="flex items-center gap-2 p-2 rounded-md border bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800">
                {samplePaperUploading ? (
                  <Loader2 className="h-4 w-4 text-cyan-600 shrink-0 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 text-cyan-600 shrink-0" />
                )}
                <span className="text-sm truncate flex-1">{samplePaperFile.name}{samplePaperUploading ? " (uploading...)" : ""}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { setSamplePaperFile(null); setSamplePaperId(""); if (samplePaperInputRef.current) samplePaperInputRef.current.value = ""; }}
                  data-testid="button-remove-sample-paper"
                >
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => samplePaperInputRef.current?.click()}
                data-testid="button-upload-sample-paper"
                className="w-fit gap-2"
              >
                <Plus className="h-4 w-4" />
                Upload Sample Paper
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Number of Questions</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                data-testid="input-question-count"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Question Type</Label>
              <Select value={questionType} onValueChange={setQuestionType}>
                <SelectTrigger data-testid="select-question-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">Mixed</SelectItem>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                  <SelectItem value="essay">Essay</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Time Limit</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={timeLimitSeconds === null ? "default" : "outline"}
                size="sm"
                onClick={() => setTimePreset(null)}
                data-testid="button-time-none"
              >
                No limit
              </Button>
              <Button
                variant={timeLimitSeconds === 900 ? "default" : "outline"}
                size="sm"
                onClick={() => setTimePreset(15)}
                data-testid="button-time-15"
              >
                15 min
              </Button>
              <Button
                variant={timeLimitSeconds === 1800 ? "default" : "outline"}
                size="sm"
                onClick={() => setTimePreset(30)}
                data-testid="button-time-30"
              >
                30 min
              </Button>
              <Button
                variant={timeLimitSeconds === 2700 ? "default" : "outline"}
                size="sm"
                onClick={() => setTimePreset(45)}
                data-testid="button-time-45"
              >
                45 min
              </Button>
              <Button
                variant={timeLimitSeconds === 3600 ? "default" : "outline"}
                size="sm"
                onClick={() => setTimePreset(60)}
                data-testid="button-time-60"
              >
                1 hour
              </Button>
              <Button
                variant={showCustomTime ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCustomTime(true)}
                data-testid="button-time-custom"
              >
                Custom
              </Button>
            </div>
            {showCustomTime && (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={1}
                  max={180}
                  placeholder="Minutes"
                  value={customTimeMinutes}
                  onChange={(e) => setCustomTimeMinutes(e.target.value)}
                  className="w-28"
                  data-testid="input-custom-time"
                />
                <Button size="sm" variant="outline" onClick={applyCustomTime} data-testid="button-apply-custom-time">
                  Apply
                </Button>
              </div>
            )}
            {timeLimitSeconds !== null && (
              <span className="text-xs text-muted-foreground">
                Time limit: {formatTime(timeLimitSeconds)}
              </span>
            )}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || selectedReadyIds.length === 0}
            data-testid="button-generate-quiz"
            className="bg-cyan-600 text-white border-cyan-700 w-full"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <BookOpen className="h-4 w-4 mr-2" />
            )}
            {isGenerating ? "Generating Quiz..." : "Generate Quiz"}
          </Button>

          {isGenerating && (
            <div className="flex flex-col items-center gap-2 p-4 rounded-md bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800" data-testid="quiz-generating-status">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
                <span className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
                  {generateMutation.isPending ? "Reading your documents and creating questions..." : "Starting your quiz..."}
                </span>
              </div>
              <p className="text-xs text-cyan-600/80 dark:text-cyan-400/80 text-center">
                This usually takes 10-30 seconds depending on document size
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {quizHistory && quizHistory.length > 0 && (
        <Card className="border-cyan-200 dark:border-cyan-800 bg-gradient-to-b from-cyan-50/50 to-card dark:from-cyan-950/20 dark:to-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-600 to-cyan-500 flex items-center justify-center">
                <ScanLine className="w-4 h-4 text-white" />
              </div>
              Grade My Answers
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Printed a quiz? Upload a photo of your handwritten answers to get instant AI grading.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {quizHistory.map((quiz) => (
              <div
                key={quiz.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-md border bg-background"
                data-testid={`grade-quiz-${quiz.id}`}
              >
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{quiz.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {quiz.questionCount} questions &middot; {new Date(quiz.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleStartScan(quiz.id)}
                  className="bg-cyan-600 text-white border-cyan-700"
                  data-testid={`button-grade-${quiz.id}`}
                >
                  <Camera className="h-3.5 w-3.5 mr-1" />
                  Grade
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!viewingSubmissionsQuizId} onOpenChange={(open) => { if (!open) setViewingSubmissionsQuizId(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
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
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center p-3 rounded-md bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800">
                  <span className="text-2xl font-bold text-cyan-600">{submissionsData.totalSubmissions}</span>
                  <span className="text-xs text-muted-foreground">Total</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-md border">
                  <div className="flex items-center gap-1">
                    <Monitor className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-2xl font-bold">{submissionsData.onlineCount}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Online</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-md border">
                  <div className="flex items-center gap-1">
                    <FileImage className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-2xl font-bold">{submissionsData.paperCount}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Paper</span>
                </div>
              </div>

              {submissionsData.totalSubmissions > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                  <Trophy className="h-4 w-4 text-cyan-600" />
                  <span className="text-sm">Class Average: <strong>{submissionsData.averageScore}%</strong></span>
                </div>
              )}

              {submissionsData.submissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-4">
                  No student submissions yet. Share the quiz link or QR code with your students.
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
                        data-testid={`submission-${sub.id}`}
                      >
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {sub.studentNumber && (
                              <Badge variant="secondary" className="text-xs">Student #{sub.studentNumber}</Badge>
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

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Quiz History
          </h4>
          {quizHistory && quizHistory.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              asChild
              data-testid="button-educator-dashboard"
            >
              <a href="/educator-dashboard">
                <GraduationCap className="h-3.5 w-3.5 mr-1" />
                Educator Dashboard
              </a>
            </Button>
          )}
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !quizHistory || quizHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">
            No quizzes yet. Generate your first quiz above.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {quizHistory.map((quiz) => {
              const bestAttempt = quiz.attempts?.reduce(
                (best: { percentageScore: number } | null, a: { percentageScore: number }) =>
                  !best || a.percentageScore > best.percentageScore ? a : best,
                null
              );

              return (
                <div
                  key={quiz.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-md border"
                  data-testid={`history-quiz-${quiz.id}`}
                >
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">{quiz.title}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {quiz.questionCount} questions
                      </Badge>
                      {bestAttempt && (
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            bestAttempt.percentageScore >= 70
                              ? "text-green-700 dark:text-green-300"
                              : bestAttempt.percentageScore >= 50
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-red-700 dark:text-red-300"
                          }`}
                        >
                          Best: {Math.round(bestAttempt.percentageScore)}%
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {quiz.attempts?.length || 0} attempt{(quiz.attempts?.length || 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setQuizData({ id: quiz.id, title: quiz.title, questions: [] });
                        startMutation.mutate(quiz.id);
                      }}
                      disabled={startMutation.isPending}
                      data-testid={`button-retake-${quiz.id}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Retake
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          const res = await apiRequest("POST", `/api/quiz/${quiz.id}/start`);
                          const data = await res.json();
                          handlePrintQuiz(quiz.id, quiz.title, data.questions);
                        } catch {
                          toast({ title: "Could not load quiz for printing", variant: "destructive" });
                        }
                      }}
                      data-testid={`button-print-${quiz.id}`}
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleStartScan(quiz.id)}
                      data-testid={`button-scan-${quiz.id}`}
                    >
                      <ScanLine className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setViewingSubmissionsQuizId(quiz.id)}
                      data-testid={`button-submissions-${quiz.id}`}
                    >
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(quiz.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${quiz.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
