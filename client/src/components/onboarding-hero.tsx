import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  Upload,
  MessageSquare,
  FileBadge,
  X,
  Brain,
  ListChecks,
} from "lucide-react";

type DocType = "cv" | "study" | "policy" | "generic";

// Platform-info starter questions. These intentionally have NO assetIds so the
// chat backend routes them through the platform/account handler in server/rag.ts
// — answers come from Evident's own knowledge, not from any uploaded documents.
const PLATFORM_STARTER_QUESTIONS: string[] = [
  "What can Evi do for me?",
  "What kinds of files can I upload?",
  "How do citations work?",
  "Is my data private and secure?",
  "How do I get started?",
];

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

  // ── State A: brand new account, zero documents ────────────────────────────
  // Show platform-info questions (NOT sample documents). Each question is sent
  // with assetIds=[] so the chat backend routes through the platform handler
  // and answers from Evident's own knowledge — no document search.
  if (!hasAnyDocuments) {
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
              Welcome to Evident — ask Evi anything
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Curious how it works? Tap a question below. When you're ready, upload a document and Evi will answer with citations.
            </p>
          </div>
          <DismissButton onDismiss={onDismiss} />
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PLATFORM_STARTER_QUESTIONS.map((q, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => onAsk(q, [])}
              className="text-xs rounded-full font-normal"
              data-testid={`button-platform-q-${i}`}
            >
              <MessageSquare className="w-3 h-3 mr-1.5 text-primary/70" />
              {q}
            </Button>
          ))}
        </div>
        <Button onClick={onUploadClick} className="w-full" data-testid="button-upload-instead">
          <Upload className="w-4 h-4 mr-2" />
          Upload your first document
        </Button>
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
          `Give me a one-paragraph summary with the main takeaways`,
          `What are the key facts, numbers or dates I should remember?`,
          `What questions could someone ask to test my understanding of this?`,
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
