import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { X, BookOpen, FileQuestion, Timer, RotateCcw, Check, ChevronRight, Info, GraduationCap, Eye, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useSessionAnalytics } from "@/hooks/use-session-analytics";

interface TopicGuidance {
  documentId: string;
  documentName: string | null;
  flashcardsGenerated: boolean;
  practiceQuestionsCount: number;
  quizzesTakenCount: number;
  lastActiveAt: string | null;
  lastQuizAt: string | null;
  dismissedBannerStage: number;
  postQuizNudgeDismissed: boolean;
  resumeNudgeDismissed: boolean;
  completedCycles: number;
  studyIntent: string | null;
  progressPct: number;
  currentBannerStage: number;
}

interface GuidanceData {
  topics: TopicGuidance[];
  resumeTopics: TopicGuidance[];
  defaultStudyIntent: string | null;
}

interface AssetInfo {
  id: string;
  filename: string;
}

interface StudyNudgeBannerProps {
  selectedAssets: AssetInfo[];
  onGenerateFlashcards?: (documentId: string) => void;
  onGeneratePractice?: (documentId: string) => void;
  onStartQuiz?: (documentId: string) => void;
  onReselectDocument?: (documentId: string) => void;
}

function StudyIntentPrompt({
  documentName,
  documentId,
  onSelect,
}: {
  documentName: string;
  documentId: string;
  onSelect: (intent: "exam" | "browsing", remember: boolean) => void;
}) {
  const [remember, setRemember] = useState(false);

  return (
    <div
      className="flex flex-col gap-2 px-3 py-3 rounded-md bg-[hsl(var(--guidance-muted))] border border-[hsl(var(--guidance-border))] animate-in fade-in slide-in-from-top-1 duration-300"
      data-testid={`intent-prompt-${documentId}`}
    >
      <span className="text-sm text-[hsl(var(--guidance))] dark:text-[hsl(var(--guidance))] font-medium">
        How would you like to use this topic?
      </span>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 justify-start gap-2 min-h-[44px] text-left"
          onClick={() => onSelect("exam", remember)}
          data-testid={`button-intent-exam-${documentId}`}
        >
          <GraduationCap className="h-4 w-4 flex-shrink-0 text-[hsl(var(--guidance))]" />
          <span>I'm preparing for an exam</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 justify-start gap-2 min-h-[44px] text-left"
          onClick={() => onSelect("browsing", remember)}
          data-testid={`button-intent-browsing-${documentId}`}
        >
          <BookOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span>I'm exploring this topic</span>
        </Button>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none" data-testid={`label-remember-${documentId}`}>
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="rounded border-border accent-primary h-4 w-4"
          data-testid={`checkbox-remember-${documentId}`}
        />
        <span className="text-xs text-muted-foreground">Remember my choice for future documents</span>
      </label>
    </div>
  );
}

function MultiDocIntentPrompt({
  documents,
  onSelect,
}: {
  documents: { id: string; name: string }[];
  onSelect: (intent: "exam" | "browsing", remember: boolean) => void;
}) {
  const [remember, setRemember] = useState(false);
  const docCount = documents.length;
  const docNames = documents.map(d => {
    const name = d.name || "Untitled";
    return name.length > 25 ? name.substring(0, 22) + "..." : name;
  });

  return (
    <div
      className="flex flex-col gap-2 px-3 py-3 rounded-md bg-[hsl(var(--guidance-muted))] border border-[hsl(var(--guidance-border))] animate-in fade-in slide-in-from-top-1 duration-300"
      data-testid="intent-prompt-multi"
    >
      <span className="text-sm text-[hsl(var(--guidance))] dark:text-[hsl(var(--guidance))] font-medium">
        How would you like to use these {docCount} documents?
      </span>
      <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
        {docNames.map((name, i) => (
          <span key={documents[i].id} className="bg-muted/60 px-1.5 py-0.5 rounded" data-testid={`text-multi-doc-${documents[i].id}`}>
            {name}
          </span>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 justify-start gap-2 min-h-[44px] text-left"
          onClick={() => onSelect("exam", remember)}
          data-testid="button-intent-exam-multi"
        >
          <GraduationCap className="h-4 w-4 flex-shrink-0 text-[hsl(var(--guidance))]" />
          <span>I'm preparing for an exam</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 justify-start gap-2 min-h-[44px] text-left"
          onClick={() => onSelect("browsing", remember)}
          data-testid="button-intent-browsing-multi"
        >
          <BookOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span>I'm exploring these topics</span>
        </Button>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="label-remember-multi">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="rounded border-border accent-primary h-4 w-4"
          data-testid="checkbox-remember-multi"
        />
        <span className="text-xs text-muted-foreground">Remember my choice for future documents</span>
      </label>
    </div>
  );
}

const STAGE_DESCRIPTIONS: Record<string, string> = {
  understand: "Flashcards, Key Concepts, Cheat Sheets — build your foundation",
  practice: "Practice Questions & Assignments — apply what you've learned",
  test: "Timed Quiz — measure your readiness and track progress",
};

function formatLastUsed(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatLastUsedFull(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  if (diffDays === 0) return `Last used today at ${time}`;
  if (diffDays === 1) return `Last used yesterday at ${time}`;
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Last used ${date} at ${time}`;
}

function isStale(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const diffDays = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  return diffDays >= 7;
}

function StageIndicator({ guidance, onStartFresh, showDocName }: { guidance: TopicGuidance; onStartFresh?: () => void; showDocName?: boolean }) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const stages = [
    { label: "Understand", key: "understand", done: guidance.flashcardsGenerated, icon: BookOpen },
    { label: "Practice", key: "practice", done: guidance.practiceQuestionsCount >= 10, icon: FileQuestion },
    { label: "Test", key: "test", done: guidance.quizzesTakenCount >= 1, icon: Timer },
  ];

  const currentStageIndex = stages.findIndex(s => !s.done);
  const hasAnyProgress = stages.some(s => s.done);
  const lastUsedLabel = formatLastUsed(guidance.lastActiveAt);
  const stale = isStale(guidance.lastActiveAt);

  const docLabel = guidance.documentName
    ? (guidance.documentName.length > 25 ? guidance.documentName.substring(0, 22) + "..." : guidance.documentName)
    : null;

  return (
    <div className="flex flex-col gap-1" data-testid="stage-indicator">
      {showDocName && docLabel && (
        <div className="flex items-center gap-1.5" data-testid="text-stage-doc-name">
          <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[200px]" title={guidance.documentName || ""}>
            {docLabel}
          </span>
          {guidance.lastActiveAt && (
            <span className="text-[10px] text-muted-foreground/60" data-testid="text-stage-last-used">
              · {formatLastUsedFull(guidance.lastActiveAt)}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-1">
        {stages.map((stage, i) => {
          const isCurrent = i === currentStageIndex;
          const isDone = stage.done;
          const isFuture = !isDone && !isCurrent;
          const Icon = stage.icon;
          const isExpanded = expandedStage === stage.key;

          return (
            <div key={stage.label} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className={`h-3 w-3 flex-shrink-0 ${isDone || isCurrent ? "text-muted-foreground" : "text-muted-foreground/40"}`} />
              )}
              <button
                type="button"
                onClick={() => setExpandedStage(isExpanded ? null : stage.key)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  isDone
                    ? "bg-[hsl(var(--guidance)/0.15)] text-[hsl(var(--guidance))]"
                    : isCurrent
                    ? "bg-[hsl(var(--guidance-muted))] text-foreground border border-[hsl(var(--guidance-border))]"
                    : "bg-muted/50 text-muted-foreground/50"
                }`}
                data-testid={`stage-${stage.label.toLowerCase()}`}
              >
                {isDone ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Icon className={`h-3 w-3 ${isFuture ? "opacity-40" : ""}`} />
                )}
                <span>{stage.label}</span>
                <Info className={`h-2.5 w-2.5 ml-0.5 ${isFuture ? "opacity-30" : "opacity-50"}`} />
              </button>
            </div>
          );
        })}
        {lastUsedLabel && (
          <span className={`text-[10px] ml-1 ${stale ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground/50"}`} data-testid="text-last-used">
            {stale ? `Last studied ${lastUsedLabel}` : lastUsedLabel}
          </span>
        )}
        {hasAnyProgress && onStartFresh && (
          <button
            type="button"
            onClick={onStartFresh}
            className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors ml-0.5"
            data-testid="button-start-fresh"
            title="Reset progress and start over"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            <span>Fresh start</span>
          </button>
        )}
      </div>
      {expandedStage && (
        <div className="text-[11px] text-muted-foreground/70 pl-1 animate-in fade-in duration-200" data-testid={`stage-description-${expandedStage}`}>
          {STAGE_DESCRIPTIONS[expandedStage]}
        </div>
      )}
      {stale && hasAnyProgress && (
        <div className="text-[10px] text-amber-600/70 dark:text-amber-400/70 pl-1" data-testid="text-stale-hint">
          It's been a while — pick up where you left off or start fresh
        </div>
      )}
      {guidance.completedCycles > 0 && (
        <span className="text-[10px] text-muted-foreground/50 pl-1" data-testid="text-cycle-count">
          Cycle {guidance.completedCycles + 1}
        </span>
      )}
    </div>
  );
}

export function StudyNudgeBanner({
  selectedAssets,
  onGenerateFlashcards,
  onGeneratePractice,
  onStartQuiz,
  onReselectDocument,
}: StudyNudgeBannerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { trackEvent } = useSessionAnalytics();
  const [dismissedLocal, setDismissedLocal] = useState<Set<string>>(new Set());
  const [intentSelectedLocal, setIntentSelectedLocal] = useState<Set<string>>(new Set());
  const [timeNudgeShown, setTimeNudgeShown] = useState(false);
  const [timeNudgeDismissed, setTimeNudgeDismissed] = useState(false);
  const activeTimerRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ensuredIdsRef = useRef<Set<string>>(new Set());
  const prevSelectedIdsRef = useRef<string[]>([]);
  const [guidanceOff, setGuidanceOff] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("studyGuidanceOff");
      if (stored !== null) return stored === "true";
    }
    return false;
  });

  const selectedAssetIds = [...new Set(selectedAssets.map(a => a.id))];

  const { data: guidanceData } = useQuery<GuidanceData>({
    queryKey: ["/api/study-guidance"],
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: user ? 60000 : false,
  });

  const retryTransient = (count: number, error: any) => {
    if (count >= 2) return false;
    const msg = error?.message || "";
    const statusMatch = msg.match(/^(\d{3}):/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      if (status === 401) return true;
      if (status >= 400 && status < 500) return false;
    }
    return true;
  };

  const ensureMutation = useMutation({
    mutationFn: async (documents: { id: string; name: string }[]) => {
      await apiRequest("POST", "/api/study-guidance/ensure", { documents });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-guidance"] });
    },
    retry: retryTransient,
    retryDelay: 1000,
  });

  useEffect(() => {
    if (!user || selectedAssets.length === 0) return;

    const knownIds = new Set(guidanceData?.topics.map(t => t.documentId) || []);
    const missing = selectedAssets.filter(
      a => !knownIds.has(a.id) && !ensuredIdsRef.current.has(a.id)
    );

    if (missing.length > 0) {
      missing.forEach(a => ensuredIdsRef.current.add(a.id));
      ensureMutation.mutate(missing.map(a => ({ id: a.id, name: a.filename })));
    }
  }, [selectedAssets, guidanceData, user]);

  const dismissMutation = useMutation({
    mutationFn: async ({ documentId, type }: { documentId: string; type: string }) => {
      await apiRequest("POST", "/api/study-guidance/dismiss", { documentId, type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-guidance"] });
    },
    retry: retryTransient,
    retryDelay: 1000,
  });

  const restartMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiRequest("POST", "/api/study-guidance/restart", { documentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-guidance"] });
      toast({
        variant: "guidance",
        title: "New study cycle started",
        description: "Your stages have been reset. Let's go again!",
        duration: 4000,
      });
    },
    retry: retryTransient,
    retryDelay: 1000,
  });

  const intentMutation = useMutation({
    mutationFn: async ({ documentId, intent, remember }: { documentId: string; intent: string; remember: boolean }) => {
      await apiRequest("POST", "/api/study-guidance/intent", { documentId, intent, remember });
    },
    retry: retryTransient,
    retryDelay: 1000,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-guidance"] });
      if (variables.intent === "exam") {
        toast({
          variant: "guidance",
          title: "Study path activated",
          description: "Your 3-stage study guide is ready. Let's go!",
          duration: 3000,
        });
      }
    },
    onError: (_, variables) => {
      setIntentSelectedLocal(prev => {
        const next = new Set(prev);
        next.delete(variables.documentId);
        return next;
      });
      toast({
        title: "Still warming up",
        description: "Tap your choice again — it'll work!",
        duration: 3000,
      });
    },
  });

  const handleIntentSelect = useCallback((documentId: string, intent: "exam" | "browsing", remember: boolean) => {
    setIntentSelectedLocal(prev => new Set(prev).add(documentId));
    trackEvent("intent_set", { documentId, eventData: { intent, remember } });
    intentMutation.mutate({ documentId, intent, remember });
  }, [trackEvent]);

  useEffect(() => {
    if (!guidanceData || !user || guidanceOff) {
      prevSelectedIdsRef.current = selectedAssetIds;
      return;
    }

    const prevIds = prevSelectedIdsRef.current;
    const removedIds = prevIds.filter(id => !selectedAssetIds.includes(id));

    const newlyAdded = selectedAssetIds.filter(id => !prevIds.includes(id));
    for (const addedId of newlyAdded) {
      trackEvent("document_selected", { documentId: addedId });
    }
    for (const removedId of removedIds) {
      trackEvent("document_deselected", { documentId: removedId });
    }

    if (removedIds.length > 0 && prevIds.length > 0) {
      const incompleteNames: string[] = [];
      const incompleteDocIds: string[] = [];
      for (const removedId of removedIds) {
        const topic = guidanceData.topics.find(t => t.documentId === removedId);
        if (!topic) continue;
        if (topic.quizzesTakenCount >= 1) continue;
        if (!topic.flashcardsGenerated && topic.practiceQuestionsCount === 0) continue;

        const docName = topic.documentName || "Untitled";
        const shortName = docName.length > 25 ? docName.substring(0, 22) + "..." : docName;

        let stage = "Understand";
        if (topic.flashcardsGenerated && topic.practiceQuestionsCount < 10) stage = "Practice";
        else if (topic.practiceQuestionsCount >= 10) stage = "Test";

        incompleteNames.push(`"${shortName}" (${stage})`);
        incompleteDocIds.push(removedId);
      }

      if (incompleteNames.length > 0 && incompleteDocIds.length > 0) {
        toast({
          variant: "guidance",
          title: "Study progress saved",
          description: `${incompleteNames[0]} — come back anytime to continue.`,
          duration: 8000,
          action: onReselectDocument ? (
            <ToastAction
              altText="Continue studying"
              onClick={() => {
                incompleteDocIds.forEach(id => onReselectDocument(id));
              }}
              data-testid="button-toast-continue-study"
            >
              Continue studying
            </ToastAction>
          ) : undefined,
        });
      }
    }

    prevSelectedIdsRef.current = selectedAssetIds;
  }, [selectedAssetIds, guidanceData, user, guidanceOff]);

  useEffect(() => {
    if (selectedAssetIds.length > 0 && guidanceData) {
      const selectedTopics = guidanceData.topics.filter(t => selectedAssetIds.includes(t.documentId));
      const hasUnquizzedTopic = selectedTopics.some(t => t.quizzesTakenCount === 0);

      if (hasUnquizzedTopic && !timeNudgeShown && !timeNudgeDismissed) {
        if (!timerIntervalRef.current) {
          activeTimerRef.current = 0;
          timerIntervalRef.current = setInterval(() => {
            activeTimerRef.current += 1;
            if (activeTimerRef.current >= 300) {
              setTimeNudgeShown(true);
              if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
              }
            }
          }, 1000);
        }
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [selectedAssetIds, guidanceData, timeNudgeShown, timeNudgeDismissed]);

  if (!user || !guidanceData) return null;

  const selectedTopicsRaw = guidanceData.topics.filter(t => selectedAssetIds.includes(t.documentId));
  const seenDocIds = new Set<string>();
  const selectedTopics = selectedTopicsRaw.filter(t => {
    if (seenDocIds.has(t.documentId)) return false;
    seenDocIds.add(t.documentId);
    return true;
  });

  const scrollToStudyTools = (stage?: "understand" | "practice") => {
    const el = document.getElementById("study-tools-section");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    const buttons = el.querySelectorAll<HTMLButtonElement>("[data-study-stage]");
    const matchingButtons: HTMLButtonElement[] = [];
    const nonMatchingButtons: HTMLButtonElement[] = [];

    buttons.forEach((btn) => {
      if (!stage || btn.dataset.studyStage === stage) {
        matchingButtons.push(btn);
      } else {
        nonMatchingButtons.push(btn);
      }
    });

    nonMatchingButtons.forEach((btn) => {
      btn.style.opacity = "0.35";
      btn.style.transition = "opacity 0.3s";
    });

    matchingButtons.forEach((btn) => {
      btn.classList.add("ring-2", "ring-primary/60", "scale-105");
      btn.style.transition = "all 0.3s";
    });

    setTimeout(() => {
      matchingButtons.forEach((btn) => {
        btn.classList.remove("ring-2", "ring-primary/60", "scale-105");
      });
      nonMatchingButtons.forEach((btn) => {
        btn.style.opacity = "";
      });
    }, 2500);
  };

  const handleDismiss = (documentId: string, type: string) => {
    setDismissedLocal(prev => new Set(prev).add(`${documentId}-${type}`));
    trackEvent("guidance_dismissed", { documentId, eventData: { dismissType: type } });
    dismissMutation.mutate({ documentId, type });
  };

  const intentPrompts: JSX.Element[] = [];
  const defaultIntent = guidanceData?.defaultStudyIntent || null;

  const hasStudyActivity = (topic: TopicGuidance) => {
    return topic.flashcardsGenerated || topic.practiceQuestionsCount > 0 || topic.quizzesTakenCount > 0;
  };

  if (!defaultIntent) {
    const needsIntentDocs: { id: string; name: string }[] = [];

    for (const topic of selectedTopics) {
      if (topic.studyIntent === null && !hasStudyActivity(topic) && !intentSelectedLocal.has(topic.documentId)) {
        needsIntentDocs.push({ id: topic.documentId, name: topic.documentName || "this document" });
      }
    }

    const knownDocIds = new Set(guidanceData?.topics.map(t => t.documentId) || []);
    const seenIds = new Set(needsIntentDocs.map(d => d.id));
    for (const asset of selectedAssets) {
      if (!knownDocIds.has(asset.id) && !intentSelectedLocal.has(asset.id) && !seenIds.has(asset.id)) {
        needsIntentDocs.push({ id: asset.id, name: asset.filename || "this document" });
      }
    }

    if (needsIntentDocs.length === 1) {
      const doc = needsIntentDocs[0];
      intentPrompts.push(
        <StudyIntentPrompt
          key={`intent-${doc.id}`}
          documentId={doc.id}
          documentName={doc.name}
          onSelect={(intent, remember) => handleIntentSelect(doc.id, intent, remember)}
        />
      );
    } else if (needsIntentDocs.length > 1) {
      intentPrompts.push(
        <MultiDocIntentPrompt
          key="intent-multi"
          documents={needsIntentDocs}
          onSelect={(intent, remember) => {
            for (const doc of needsIntentDocs) {
              handleIntentSelect(doc.id, intent, remember);
            }
          }}
        />
      );
    }
  }

  const getCurrentStage = (topic: TopicGuidance): number => {
    if (topic.quizzesTakenCount >= 1) return 3;
    if (topic.practiceQuestionsCount >= 10) return 2;
    if (topic.flashcardsGenerated) return 1;
    return 0;
  };

  const getEffectiveIntent = (topic: TopicGuidance) => {
    if (topic.studyIntent) return topic.studyIntent;
    if (hasStudyActivity(topic)) return "exam";
    return defaultIntent || null;
  };

  const banners: JSX.Element[] = [];

  for (const topic of selectedTopics) {
    const effectiveIntent = getEffectiveIntent(topic);
    if (effectiveIntent !== "exam") continue;
    const docName = topic.documentName || "this document";
    const shortName = docName.length > 40 ? docName.substring(0, 37) + "..." : docName;
    const isDismissedBanner = dismissedLocal.has(`${topic.documentId}-banner`);

    const currentStage = getCurrentStage(topic);

    if (currentStage === 0 && topic.dismissedBannerStage < 1 && !isDismissedBanner) {
      banners.push(
        <NudgeBanner
          key={`upload-${topic.documentId}`}
          documentId={topic.documentId}
          message={`You might find it helpful to start with a study tool like flashcards or a summary for "${shortName}" — just a suggestion!`}
          ctaLabel="Go to Study Tools"
          onAction={() => scrollToStudyTools("understand")}
          onDismiss={() => handleDismiss(topic.documentId, "banner")}
          icon={<BookOpen className="h-4 w-4 text-[hsl(var(--guidance))] flex-shrink-0" />}
        />
      );
    } else if (currentStage === 1 && topic.dismissedBannerStage < 2 && !isDismissedBanner) {
      banners.push(
        <NudgeBanner
          key={`practice-${topic.documentId}`}
          documentId={topic.documentId}
          message={`When you're ready, practice questions can help reinforce what you've studied from "${shortName}".`}
          description={STAGE_DESCRIPTIONS.practice}
          ctaLabel="Go to Practice Tools"
          onAction={() => scrollToStudyTools("practice")}
          onDismiss={() => handleDismiss(topic.documentId, "banner")}
          icon={<FileQuestion className="h-4 w-4 text-[hsl(var(--guidance))] flex-shrink-0" />}
        />
      );
    } else if (currentStage === 2 && topic.dismissedBannerStage < 3 && !isDismissedBanner) {
      banners.push(
        <NudgeBanner
          key={`quiz-${topic.documentId}`}
          documentId={topic.documentId}
          message={`Feeling confident about "${shortName}"? A quick quiz could help you see where you stand.`}
          description={STAGE_DESCRIPTIONS.test}
          ctaLabel="Start Quiz"
          onAction={() => onStartQuiz?.(topic.documentId)}
          onDismiss={() => handleDismiss(topic.documentId, "banner")}
          icon={<Timer className="h-4 w-4 text-[hsl(var(--guidance))] flex-shrink-0" />}
        />
      );
    } else if (
      currentStage === 3 &&
      !topic.postQuizNudgeDismissed &&
      !dismissedLocal.has(`${topic.documentId}-postQuiz`)
    ) {
      const cycleLabel = topic.completedCycles > 0
        ? ` (Cycle ${topic.completedCycles + 1} complete)`
        : "";
      banners.push(
        <NudgeBanner
          key={`postquiz-${topic.documentId}`}
          documentId={topic.documentId}
          message={`Well done — you've completed all three stages for "${shortName}"!${cycleLabel} Want to go through it again for more practice?`}
          ctaLabel="Study Again"
          onAction={() => {
            trackEvent("study_cycle_restarted", { documentId: topic.documentId, eventData: { cycle: topic.completedCycles + 1 } });
            restartMutation.mutate(topic.documentId);
          }}
          onDismiss={() => handleDismiss(topic.documentId, "postQuiz")}
          icon={<Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />}
        />
      );
    }
  }

  for (const topic of guidanceData.resumeTopics) {
    if (dismissedLocal.has(`${topic.documentId}-resume`)) continue;
    const docName = topic.documentName || "a previous topic";
    banners.push(
      <NudgeBanner
        key={`resume-${topic.documentId}`}
        documentId={topic.documentId}
        message={`Continue your progress on "${docName}"?`}
        ctaLabel="Resume Topic"
        onAction={() => onStartQuiz?.(topic.documentId)}
        onDismiss={() => handleDismiss(topic.documentId, "resume")}
        icon={<RotateCcw className="h-4 w-4 text-[hsl(var(--guidance))] flex-shrink-0" />}
      />
    );
  }

  if (timeNudgeShown && !timeNudgeDismissed) {
    banners.push(
      <NudgeBanner
        key="time-nudge"
        documentId="time-nudge"
        message="You've been studying this topic. Want to see how you'd perform in a real exam?"
        ctaLabel="Start Timed Quiz"
        onAction={() => {
          setTimeNudgeDismissed(true);
          if (selectedAssetIds.length > 0) onStartQuiz?.(selectedAssetIds[0]);
        }}
        onDismiss={() => setTimeNudgeDismissed(true)}
        icon={<Timer className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />}
      />
    );
  }

  const examTopics = selectedTopics.filter(t => getEffectiveIntent(t) === "exam");

  if (banners.length === 0 && intentPrompts.length === 0 && examTopics.length === 0) return null;

  const toggleGuidance = () => {
    const newVal = !guidanceOff;
    setGuidanceOff(newVal);
    localStorage.setItem("studyGuidanceOff", String(newVal));
    trackEvent(newVal ? "guidance_toggled_off" : "guidance_toggled_on");
  };

  if (guidanceOff) {
    return (
      <div className="flex items-center justify-end gap-1.5" data-testid="study-nudge-container">
        <button
          onClick={toggleGuidance}
          className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          data-testid="button-enable-guidance"
        >
          Turn on study guidance
        </button>
        <span
          className="relative group"
          data-testid="help-guidance-info"
        >
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-muted-foreground/70 cursor-help transition-colors" />
          <span className="absolute bottom-full right-0 mb-1.5 w-56 px-3 py-2 text-[11px] text-popover-foreground bg-popover border border-border rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-50">
            Study guidance tracks your progress through 3 stages — Understand, Practice, and Test — for each document you're studying.
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="study-nudge-container">
      {examTopics.length > 0 && (
        <div className={examTopics.length > 1 ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-3"}>
          {examTopics.map(topic => (
            <div key={topic.documentId} className="flex items-center gap-2">
              <StageIndicator
                guidance={topic}
                showDocName={examTopics.length > 1}
                onStartFresh={() => {
                  trackEvent("study_fresh_start", { documentId: topic.documentId });
                  restartMutation.mutate(topic.documentId);
                }}
              />
            </div>
          ))}
          <button
            onClick={toggleGuidance}
            className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors ml-auto"
            data-testid="button-disable-guidance"
          >
            Turn off guidance
          </button>
        </div>
      )}
      {intentPrompts.length > 0 && (
        <div className="space-y-1.5">
          {intentPrompts.slice(0, 2)}
        </div>
      )}
      {banners.length > 0 && (
        <div className="space-y-1.5">
          {banners.slice(0, 2)}
        </div>
      )}
    </div>
  );
}

function NudgeBanner({
  documentId,
  message,
  description,
  ctaLabel,
  onAction,
  onDismiss,
  icon,
}: {
  documentId: string;
  message: string;
  description?: string;
  ctaLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  icon: JSX.Element;
}) {
  return (
    <div
      className="flex items-start gap-2 px-3 py-2 rounded-md bg-[hsl(var(--guidance-muted))] border border-[hsl(var(--guidance-border))] text-sm animate-in fade-in slide-in-from-top-1 duration-300"
      data-testid={`nudge-banner-${documentId}`}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <span className="text-foreground/80">{message}</span>
        {description && (
          <div className="text-[11px] text-muted-foreground/60 mt-0.5">{description}</div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {ctaLabel && onAction && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7 px-2 text-[hsl(var(--guidance))] font-semibold"
            onClick={onAction}
            data-testid={`button-nudge-action-${documentId}`}
          >
            {ctaLabel}
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={onDismiss}
          data-testid={`button-nudge-dismiss-${documentId}`}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
