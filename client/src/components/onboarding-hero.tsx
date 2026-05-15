import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  Upload,
  FileText,
  Loader2,
  MessageSquare,
  Wand2,
  GraduationCap,
  Scale,
  FileBadge,
  X,
  Brain,
  ListChecks,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LoadedSample = {
  assetId: string;
  filename: string;
  suggestedQuestions: string[];
};

type DocType = "cv" | "study" | "policy" | "generic";

function detectDocType(filename: string | undefined): DocType {
  if (!filename) return "generic";
  // Strip extension, normalize separators (_, -, ., digits) to spaces so
  // word-boundary tests work on real filenames like "resume_v2.pdf",
  // "cv2026.docx", "study-notes-ch3.pdf", "Policy.Handbook.2024.pdf".
  const f = " " + filename
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/(\d+)/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim() + " ";
  if (/ (cv|resume|resumes|r[ée]sum[ée]s?|curriculum vitae|curriculumvitae) /.test(f)) return "cv";
  if (/ (lecture|lectures|notes?|chapter|chapters|syllabus|study|textbook|reading|readings|module|modules|course|courses|exam|exams|revision|revisions|quiz|test|tests) /.test(f)) return "study";
  if (/ (policy|policies|contract|contracts|agreement|agreements|terms|handbook|handbooks|sop|sops|nda|tos|guideline|guidelines|charter|charters|compliance|regulation|regulations|coc) /.test(f)) return "policy";
  return "generic";
}

type OnboardingHeroProps = {
  hasAnyDocuments: boolean;
  hasAskedAnything: boolean;
  firstDocumentName?: string;
  firstDocumentId?: string;
  onAsk: (question: string, assetIds?: string[]) => void;
  onUploadClick: () => void;
  onDismiss?: () => void;
  onOpenCVBuilder?: () => void;
  onOpenStudyQuiz?: () => void;
};

const SAMPLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Sample Lecture — Photosynthesis.txt": GraduationCap,
  "Sample Policy — Remote Work.txt": Scale,
  "Sample CV — Jane Doe.txt": FileBadge,
};

function DismissButton({ onDismiss }: { onDismiss?: () => void }) {
  if (!onDismiss) return null;
  return (
    <button
      onClick={onDismiss}
      className="shrink-0 -mr-1 -mt-1 p-1 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
      aria-label="Dismiss tips"
      data-testid="button-dismiss-onboarding-hero"
    >
      <X className="w-4 h-4" />
    </button>
  );
}

export function OnboardingHero({
  hasAnyDocuments,
  hasAskedAnything,
  firstDocumentName,
  firstDocumentId,
  onAsk,
  onUploadClick,
  onDismiss,
  onOpenCVBuilder,
  onOpenStudyQuiz,
}: OnboardingHeroProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadedSamples, setLoadedSamples] = useState<LoadedSample[] | null>(null);

  const loadSamplesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/load-samples", {});
      return (await res.json()) as { samples: LoadedSample[] };
    },
    onSuccess: (data) => {
      setLoadedSamples(data.samples);
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "Samples ready",
        description: `Added ${data.samples.length} sample documents. Pick a question below to try Evi.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not load samples",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // ── State A: brand new account, zero documents ────────────────────────────
  if (!hasAnyDocuments && !loadedSamples) {
    return (
      <Card
        className="mb-4 p-5 sm:p-6 border-primary/20 bg-gradient-to-br from-cyan-50 via-white to-blue-50 dark:from-cyan-950/30 dark:via-slate-950 dark:to-blue-950/20"
        data-testid="onboarding-hero-empty"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-foreground" data-testid="text-hero-title">
              Try Evi in 5 seconds — no upload needed
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              We'll add 3 sample documents (a lecture, a policy and a CV) to your workspace so you can see exactly what Evi does.
            </p>
          </div>
          <DismissButton onDismiss={onDismiss} />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => loadSamplesMutation.mutate()}
            disabled={loadSamplesMutation.isPending}
            className="flex-1"
            data-testid="button-load-samples"
          >
            {loadSamplesMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setting up samples…
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Try Evi on samples
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onUploadClick} className="flex-1" data-testid="button-upload-instead">
            <Upload className="w-4 h-4 mr-2" />
            Or upload your own
          </Button>
        </div>
      </Card>
    );
  }

  // ── State B: samples just loaded — show "ask one of these" cards ──────────
  if (loadedSamples && loadedSamples.length > 0) {
    return (
      <Card
        className="mb-4 p-4 sm:p-5 border-primary/30 bg-gradient-to-br from-cyan-50/70 to-blue-50/40 dark:from-cyan-950/30 dark:to-blue-950/20"
        data-testid="onboarding-hero-samples"
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground flex-1">Pick a question to try Evi</h3>
          <DismissButton onDismiss={onDismiss} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {loadedSamples.map((s) => {
            const Icon = SAMPLE_ICONS[s.filename] || FileText;
            return (
              <div
                key={s.assetId}
                className="rounded-lg border border-border bg-card p-3 flex flex-col"
                data-testid={`sample-card-${s.assetId}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-medium text-foreground truncate">
                    {s.filename.replace(/^Sample\s+/i, "").replace(/\.txt$/i, "")}
                  </span>
                </div>
                <div className="space-y-1.5 mt-auto">
                  {s.suggestedQuestions.map((q, i) => (
                    <Button
                      key={i}
                      variant="ghost"
                      size="sm"
                      onClick={() => onAsk(q, [s.assetId])}
                      className="w-full justify-start h-auto py-1.5 px-2 text-[11px] leading-snug text-left whitespace-normal hover:bg-primary/10"
                      data-testid={`button-sample-q-${s.assetId}-${i}`}
                    >
                      <MessageSquare className="w-3 h-3 mr-1.5 shrink-0 text-primary/70" />
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Ready when you are — upload your own anytime.</span>
          <Button variant="ghost" size="sm" onClick={onUploadClick} className="text-xs h-7" data-testid="button-upload-from-samples">
            <Upload className="w-3 h-3 mr-1.5" />
            Upload your own
          </Button>
        </div>
      </Card>
    );
  }

  // ── State C: has docs but hasn't asked anything yet — type-aware nudge ────
  // Render even if first-doc metadata is partially missing — fall back to a
  // generic nudge rather than swallowing the hero silently.
  if (hasAnyDocuments && !hasAskedAnything) {
    const safeName = firstDocumentName || "your document";
    const docType = firstDocumentName ? detectDocType(firstDocumentName) : "generic";
    const cleanName = safeName.replace(/\.[^.]+$/, "");
    const targetIds = firstDocumentId ? [firstDocumentId] : undefined;

    // Type-specific nudge configurations
    type NudgeConfig = {
      icon: React.ComponentType<{ className?: string }>;
      iconBg: string;
      iconColor: string;
      title: string;
      subtitle: string;
      primary?: { label: string; onClick: () => void; testid: string };
      questions: string[];
    };

    let cfg: NudgeConfig;
    if (docType === "cv" && onOpenCVBuilder) {
      cfg = {
        icon: FileBadge,
        iconBg: "bg-purple-500/15",
        iconColor: "text-purple-600 dark:text-purple-400",
        title: `Build a polished CV from "${cleanName}"`,
        subtitle: "Open the CV Builder — Evi tailors a professional CV in seconds.",
        primary: { label: "Open CV Builder", onClick: onOpenCVBuilder, testid: "button-nudge-open-cv-builder" },
        questions: [
          `Pull out the strongest achievements from "${cleanName}"`,
          `What skills should I highlight?`,
        ],
      };
    } else if (docType === "study" && onOpenStudyQuiz) {
      cfg = {
        icon: Brain,
        iconBg: "bg-amber-500/15",
        iconColor: "text-amber-600 dark:text-amber-400",
        title: `Quiz yourself on "${cleanName}"`,
        subtitle: "Open Exam Prep — Evi turns this into practice questions.",
        primary: { label: "Start a quiz", onClick: onOpenStudyQuiz, testid: "button-nudge-open-quiz" },
        questions: [
          `Summarise the key concepts in "${cleanName}"`,
          `What should I focus on first?`,
        ],
      };
    } else if (docType === "policy") {
      cfg = {
        icon: ListChecks,
        iconBg: "bg-emerald-500/15",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        title: `Extract an obligations checklist from "${cleanName}"`,
        subtitle: "Evi will list every requirement, deadline and responsibility.",
        primary: {
          label: "Extract checklist",
          onClick: () => onAsk(
            `List every obligation, requirement, deadline and responsibility in "${cleanName}" as a checklist with citations.`,
            targetIds,
          ),
          testid: "button-nudge-extract-obligations",
        },
        questions: [
          `What are the most important rules in "${cleanName}"?`,
          `Are there any risks or penalties I should know about?`,
        ],
      };
    } else {
      cfg = {
        icon: MessageSquare,
        iconBg: "bg-primary/15",
        iconColor: "text-primary",
        title: "Ask Evi about your document",
        subtitle: "Tap a question to get started — Evi will cite the source.",
        questions: [
          `What is "${cleanName}" about?`,
          `Summarise the key points`,
          `What are the most important details I should know?`,
        ],
      };
    }

    const Icon = cfg.icon;
    return (
      <Card
        className="mb-4 p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
        data-testid="onboarding-hero-first-question"
      >
        <div className="flex items-start gap-2.5 mb-3">
          <div className={`w-8 h-8 rounded-full ${cfg.iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground" data-testid="text-nudge-title">{cfg.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{cfg.subtitle}</p>
          </div>
          <DismissButton onDismiss={onDismiss} />
        </div>
        {cfg.primary && (
          <Button
            size="sm"
            onClick={cfg.primary.onClick}
            className="mb-2 w-full sm:w-auto"
            data-testid={cfg.primary.testid}
          >
            <Icon className="w-3.5 h-3.5 mr-1.5" />
            {cfg.primary.label}
          </Button>
        )}
        <div className="flex flex-wrap gap-1.5">
          {cfg.questions.map((q, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => onAsk(q, targetIds)}
              className="text-xs rounded-full font-normal"
              data-testid={`button-starter-q-${i}`}
            >
              {q}
            </Button>
          ))}
        </div>
      </Card>
    );
  }

  return null;
}
