import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMode } from "@/contexts/mode-context";
import { 
  GraduationCap, 
  FileText, 
  HelpCircle, 
  Layers, 
  ListChecks,
  Loader2,
  Sparkles,
  BookOpen,
  ExternalLink,
} from "lucide-react";

interface StudyChip {
  id: string;
  label: string;
  type: string;
  icon: typeof GraduationCap;
}

const STUDY_CHIPS: StudyChip[] = [
  { id: "exam_focus", label: "Exam Focus", type: "exam_focus", icon: GraduationCap },
  { id: "practice", label: "Practice Qs", type: "practice_questions", icon: HelpCircle },
  { id: "flashcards", label: "Flashcards", type: "flashcards", icon: Layers },
  { id: "cheat_sheet", label: "Cheat Sheet", type: "cheat_sheet", icon: ListChecks },
  { id: "summary", label: "Summary", type: "study_summary", icon: FileText },
];

interface StudyChipsBarProps {
  assetIds: string[];
  questionText?: string;
  onStudyMaterialGenerated?: (type: string, id: string) => void;
}

export function StudyChipsBar({ assetIds, questionText, onStudyMaterialGenerated }: StudyChipsBarProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { mode: verticalMode } = useMode();
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [showEducatorLink, setShowEducatorLink] = useState(false);

  const isEducator = verticalMode === "educators";

  const generateMutation = useMutation({
    mutationFn: async ({ type, assetId }: { type: string; assetId: string }) => {
      const res = await apiRequest("POST", "/api/study/generate", {
        documentId: assetId,
        type,
        context: questionText,
      });
      return res.json();
    },
    onSuccess: (data, variables) => {
      const typeName = variables.type.replace(/_/g, " ");
      if (isEducator) {
        toast({
          title: "Material created",
          description: `Your ${typeName} is ready! View in My Notes (Educator Dashboard).`,
          duration: 6000,
        });
        setShowEducatorLink(true);
      } else {
        toast({
          title: "Study material created",
          description: `Your ${typeName} is ready! Saved to Study Fitness (Knowledge Space → More).`,
          duration: 6000,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/study"] });
      if (onStudyMaterialGenerated) {
        onStudyMaterialGenerated(variables.type, data.id);
      }
      setGeneratingType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message || "Could not generate study material",
        variant: "destructive",
      });
      setGeneratingType(null);
    },
  });

  const handleGenerate = (type: string) => {
    if (!assetIds.length) {
      toast({
        title: "No document selected",
        description: "Select a document to generate study materials",
        variant: "destructive",
      });
      return;
    }
    setGeneratingType(type);
    generateMutation.mutate({ type, assetId: assetIds[0] });
  };

  if (!assetIds.length) return null;

  return (
    <div className="flex flex-col gap-1.5 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1 bg-primary/5 border-primary/20">
          {isEducator ? (
            <BookOpen className="w-3 h-3" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          {isEducator ? "Teaching Tools" : "Study Tools"}
        </Badge>
        {STUDY_CHIPS.map((chip) => {
          const Icon = chip.icon;
          const isGenerating = generatingType === chip.type;
          
          return (
            <Tooltip key={chip.id}>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs gap-1.5 border-primary/20 hover:bg-primary/10 hover:border-primary/40"
                  onClick={() => handleGenerate(chip.type)}
                  disabled={isGenerating || generateMutation.isPending}
                  data-testid={`button-study-${chip.id}`}
                >
                  {isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  {chip.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Generate {chip.label.toLowerCase()} from this document</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      {isEducator && showEducatorLink && (
        <Button
          variant="link"
          size="sm"
          className="h-auto px-1 py-0 text-xs gap-1.5"
          onClick={() => setLocation("/educator-dashboard")}
          data-testid="link-educator-my-notes"
        >
          <ExternalLink className="w-3 h-3" />
          Open My Notes in Educator Dashboard
        </Button>
      )}
    </div>
  );
}

export default StudyChipsBar;
