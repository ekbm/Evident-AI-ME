import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, FileText, HelpCircle, Layers, ListChecks, GraduationCap } from "lucide-react";

interface ExamFocusContent {
  exam_critical_topics?: Array<{ topic: string; why_it_matters: string; evidence: string }>;
  key_definitions?: Array<{ term: string; definition: string }>;
  important_examples?: Array<{ example: string; supports_concept: string }>;
  revision_priorities?: { must_know: string[]; good_to_know: string[]; optional: string[] };
}

interface StudySummaryContent {
  key_concepts?: string[];
  examples?: string[];
  formulas_or_rules?: string[];
  memorize?: string[];
  understand?: string[];
}

interface PracticeQuestionsContent {
  short_answer?: Array<{ question: string; suggested_answer: string; difficulty: string }>;
  long_answer?: Array<{ question: string; key_points: string[]; difficulty: string }>;
  self_explain?: Array<{ concept: string; prompt: string; hints: string[] }>;
}

interface FlashcardsContent {
  cards?: Array<{ front: string; back: string; tag: string }>;
}

interface CheatSheetContent {
  one_page_bullets?: string[];
  top_10_to_remember?: string[];
  common_mistakes?: string[];
  quick_formulas?: string[];
  memory_tricks?: string[];
}

type StudyContent = ExamFocusContent | StudySummaryContent | PracticeQuestionsContent | FlashcardsContent | CheatSheetContent;

interface StudyMaterialRendererProps {
  type: string;
  content: StudyContent;
  title?: string;
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    easy: "bg-green-500/10 text-green-600 dark:text-green-400",
    medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    hard: "bg-red-500/10 text-red-600 dark:text-red-400",
    mid: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    "exam-critical": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };
  return (
    <Badge className={colors[difficulty?.toLowerCase()] || colors.medium} variant="secondary">
      {difficulty}
    </Badge>
  );
}

function ExamFocusRenderer({ content }: { content: ExamFocusContent }) {
  return (
    <div className="space-y-4">
      {content.exam_critical_topics && content.exam_critical_topics.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            Exam-Critical Topics
          </h4>
          <div className="space-y-2">
            {content.exam_critical_topics.map((item, i) => (
              <div key={i} className="p-3 bg-muted/50 rounded-lg">
                <div className="font-medium text-sm">{item.topic}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.why_it_matters}</div>
                {item.evidence && (
                  <div className="text-xs text-muted-foreground/70 mt-1 italic">"{item.evidence}"</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {content.key_definitions && content.key_definitions.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Key Definitions
          </h4>
          <div className="space-y-1">
            {content.key_definitions.map((item, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{item.term}:</span>{" "}
                <span className="text-muted-foreground">{item.definition}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.revision_priorities && (
        <div>
          <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Revision Priorities
          </h4>
          <div className="space-y-2">
            {content.revision_priorities.must_know?.length > 0 && (
              <div>
                <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 mb-1">Must Know</Badge>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {content.revision_priorities.must_know.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {content.revision_priorities.good_to_know?.length > 0 && (
              <div>
                <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 mb-1">Good to Know</Badge>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {content.revision_priorities.good_to_know.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StudySummaryRenderer({ content }: { content: StudySummaryContent }) {
  return (
    <div className="space-y-4">
      {content.key_concepts && content.key_concepts.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Key Concepts</h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {content.key_concepts.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {content.memorize && content.memorize.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">To Memorize</h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {content.memorize.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {content.understand && content.understand.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">To Understand</h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {content.understand.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {content.formulas_or_rules && content.formulas_or_rules.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Formulas & Rules</h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {content.formulas_or_rules.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PracticeQuestionsRenderer({ content }: { content: PracticeQuestionsContent }) {
  return (
    <div className="space-y-4">
      {content.short_answer && content.short_answer.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Short Answer Questions</h4>
          <div className="space-y-3">
            {content.short_answer.map((item, i) => (
              <div key={i} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{i + 1}. {item.question}</div>
                  <DifficultyBadge difficulty={item.difficulty} />
                </div>
                <details className="mt-2">
                  <summary className="text-xs text-primary cursor-pointer">Show Answer</summary>
                  <div className="text-sm text-muted-foreground mt-1">{item.suggested_answer}</div>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.long_answer && content.long_answer.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Essay Questions</h4>
          <div className="space-y-3">
            {content.long_answer.map((item, i) => (
              <div key={i} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{item.question}</div>
                  <DifficultyBadge difficulty={item.difficulty} />
                </div>
                <details className="mt-2">
                  <summary className="text-xs text-primary cursor-pointer">Key Points</summary>
                  <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                    {item.key_points?.map((point, j) => (
                      <li key={j}>{point}</li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.self_explain && content.self_explain.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Self-Explanation Prompts</h4>
          <div className="space-y-2">
            {content.self_explain.map((item, i) => (
              <div key={i} className="p-3 bg-muted/50 rounded-lg">
                <div className="font-medium text-sm">{item.concept}</div>
                <div className="text-sm text-muted-foreground mt-1">{item.prompt}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FlashcardsRenderer({ content }: { content: FlashcardsContent }) {
  return (
    <div className="space-y-2">
      {content.cards && content.cards.length > 0 ? (
        <div className="grid gap-2">
          {content.cards.map((card, i) => (
            <div key={i} className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="font-medium text-sm">{card.front}</div>
                  <details className="mt-1">
                    <summary className="text-xs text-primary cursor-pointer">Flip Card</summary>
                    <div className="text-sm text-muted-foreground mt-1 pl-2 border-l-2 border-primary/30">
                      {card.back}
                    </div>
                  </details>
                </div>
                <DifficultyBadge difficulty={card.tag} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No flashcards generated.</div>
      )}
    </div>
  );
}

function CheatSheetRenderer({ content }: { content: CheatSheetContent }) {
  return (
    <div className="space-y-4">
      {content.top_10_to_remember && content.top_10_to_remember.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Top 10 to Remember</h4>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
            {content.top_10_to_remember.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        </div>
      )}

      {content.one_page_bullets && content.one_page_bullets.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Quick Review</h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {content.one_page_bullets.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {content.common_mistakes && content.common_mistakes.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Common Mistakes to Avoid</h4>
          <ul className="list-disc list-inside text-sm text-red-500/80 space-y-1">
            {content.common_mistakes.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {content.quick_formulas && content.quick_formulas.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Quick Formulas</h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {content.quick_formulas.map((item, i) => (
              <li key={i} className="font-mono">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {content.memory_tricks && content.memory_tricks.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Memory Tricks</h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {content.memory_tricks.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const typeIcons: Record<string, typeof BookOpen> = {
  exam_focus: GraduationCap,
  study_summary: FileText,
  practice_questions: HelpCircle,
  flashcards: Layers,
  cheat_sheet: ListChecks,
};

const typeLabels: Record<string, string> = {
  exam_focus: "Exam Focus",
  study_summary: "Study Summary",
  practice_questions: "Practice Questions",
  flashcards: "Flashcards",
  cheat_sheet: "Cheat Sheet",
};

export function StudyMaterialRenderer({ type, content, title }: StudyMaterialRendererProps) {
  const Icon = typeIcons[type] || BookOpen;
  const label = typeLabels[type] || "Study Material";

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title || label}
          <Badge variant="secondary" className="ml-auto text-xs">Saved</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] px-6 pb-4">
          {type === "exam_focus" && <ExamFocusRenderer content={content as ExamFocusContent} />}
          {type === "study_summary" && <StudySummaryRenderer content={content as StudySummaryContent} />}
          {type === "practice_questions" && <PracticeQuestionsRenderer content={content as PracticeQuestionsContent} />}
          {type === "flashcards" && <FlashcardsRenderer content={content as FlashcardsContent} />}
          {type === "cheat_sheet" && <CheatSheetRenderer content={content as CheatSheetContent} />}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default StudyMaterialRenderer;
