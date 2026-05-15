import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GraduationCap, X, Sparkles, ArrowRight } from "lucide-react";

interface LearningModePromptProps {
  variant: "upload" | "answer";
  suggestedTopic?: string;
  onEnable: (topic: string) => void;
  onDismiss: () => void;
}

export function LearningModePrompt({ 
  variant, 
  suggestedTopic = "",
  onEnable, 
  onDismiss 
}: LearningModePromptProps) {
  const [topic, setTopic] = useState(suggestedTopic);
  const [showInput, setShowInput] = useState(variant === "answer");

  if (variant === "upload") {
    return (
      <Card className="p-3 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-full bg-primary/20">
            <GraduationCap className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Want deeper explanations?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enable Learning Mode to get educational answers that explain complex topics in simple terms.
            </p>
            {showInput ? (
              <div className="flex gap-2 mt-2 items-center">
                <Input
                  placeholder="What topic are you studying?"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="text-xs"
                  data-testid="input-learning-topic-prompt"
                />
                <Button 
                  size="sm" 
                  className="text-xs gap-1"
                  onClick={() => topic.trim() && onEnable(topic.trim())}
                  disabled={!topic.trim()}
                  data-testid="button-enable-learning-prompt"
                >
                  <Sparkles className="w-3 h-3" />
                  Enable
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 mt-2 flex-wrap">
                <Button 
                  size="sm" 
                  variant="default"
                  className="text-xs gap-1"
                  onClick={() => setShowInput(true)}
                  data-testid="button-try-learning-mode"
                >
                  <GraduationCap className="w-3 h-3" />
                  Try Learning Mode
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="text-xs"
                  onClick={onDismiss}
                  data-testid="button-dismiss-learning-prompt"
                >
                  Maybe later
                </Button>
              </div>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0"
            onClick={onDismiss}
            data-testid="button-close-learning-prompt"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Want a deeper explanation?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            I can learn more about this topic to give you better, educational answers.
          </p>
          <div className="flex gap-2 mt-2 items-center flex-wrap">
            <Input
              placeholder="e.g., Chemistry experiments, Legal contracts..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="text-xs flex-1 min-w-[200px]"
              data-testid="input-learning-topic-answer"
            />
            <Button 
              size="sm" 
              className="text-xs gap-1"
              onClick={() => topic.trim() && onEnable(topic.trim())}
              disabled={!topic.trim()}
              data-testid="button-enable-learning-answer"
            >
              Enable Learning Mode
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground mt-1"
            onClick={onDismiss}
            data-testid="button-dismiss-answer-prompt"
          >
            No thanks, ask another question
          </Button>
        </div>
      </div>
    </div>
  );
}

export function detectGenericAnswer(answer: string): boolean {
  const genericPhrases = [
    "the document is",
    "this document appears to be",
    "this is a",
    "the file contains",
    "appears to show",
    "seems to be about",
    "the provided document",
    "based on the document",
    "the requested information was not found",
    "i cannot find",
    "no relevant information",
  ];
  
  const lowerAnswer = answer.toLowerCase();
  const hasGenericPhrase = genericPhrases.some(phrase => lowerAnswer.includes(phrase));
  
  const isShort = answer.length < 300;
  
  const hasNoTechnicalDepth = !lowerAnswer.includes("specifically") && 
                              !lowerAnswer.includes("for example") &&
                              !lowerAnswer.includes("this means") &&
                              !lowerAnswer.includes("in other words");
  
  return hasGenericPhrase && (isShort || hasNoTechnicalDepth);
}

export function extractTopicFromQuestion(question: string, answer: string): string {
  const topicPatterns = [
    /about\s+(.+?)(?:\?|$)/i,
    /what\s+is\s+(.+?)(?:\?|$)/i,
    /explain\s+(.+?)(?:\?|$)/i,
    /related\s+to\s+(.+?)(?:\?|$)/i,
  ];
  
  for (const pattern of topicPatterns) {
    const match = question.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/^(the|a|an)\s+/i, '');
    }
  }
  
  const answerTopics = answer.match(/(?:about|regarding|related to)\s+([^.,]+)/i);
  if (answerTopics && answerTopics[1]) {
    return answerTopics[1].trim();
  }
  
  return "";
}
