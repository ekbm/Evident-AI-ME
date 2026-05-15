import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Upload, FileText, Loader2, MessageSquare, Wand2, GraduationCap, Scale, FileBadge } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LoadedSample = {
  assetId: string;
  filename: string;
  suggestedQuestions: string[];
};

type OnboardingHeroProps = {
  hasAnyDocuments: boolean;
  hasAskedAnything: boolean;
  firstDocumentName?: string;
  firstDocumentId?: string;
  onAsk: (question: string, assetIds?: string[]) => void;
  onUploadClick: () => void;
};

const SAMPLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Sample Lecture — Photosynthesis.txt": GraduationCap,
  "Sample Policy — Remote Work.txt": Scale,
  "Sample CV — Jane Doe.txt": FileBadge,
};

export function OnboardingHero({
  hasAnyDocuments,
  hasAskedAnything,
  firstDocumentName,
  firstDocumentId,
  onAsk,
  onUploadClick,
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
          <h3 className="text-sm font-semibold text-foreground">Pick a question to try Evi</h3>
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

  // ── State C: has docs but hasn't asked anything yet ───────────────────────
  if (hasAnyDocuments && !hasAskedAnything && firstDocumentName && firstDocumentId) {
    const starterQuestions = [
      `What is "${firstDocumentName}" about?`,
      `Summarise the key points`,
      `What are the most important details I should know?`,
    ];
    return (
      <Card
        className="mb-4 p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
        data-testid="onboarding-hero-first-question"
      >
        <div className="flex items-start gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Ask Evi about your document</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tap a question to get started — Evi will cite the source.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {starterQuestions.map((q, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => onAsk(q, [firstDocumentId])}
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
