import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SatisfactionSurveyProps {
  open: boolean;
  onClose: () => void;
}

export function SatisfactionSurvey({ open, onClose }: SatisfactionSurveyProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      return apiRequest("POST", "/api/feedback", {
        type: "SURVEY",
        message: data.comment || (data.rating === 1 ? "Thumbs up" : "Thumbs down"),
        rating: data.rating,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setRating(null);
        setComment("");
        setSubmitted(false);
      }, 2000);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRating = (value: number) => {
    setRating(value);
  };

  const handleSubmit = () => {
    if (rating === null) return;
    submitMutation.mutate({ rating, comment });
  };

  const handleSkip = () => {
    onClose();
    setRating(null);
    setComment("");
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <ThumbsUp className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-center">Thank you!</DialogTitle>
            <DialogDescription className="text-center">
              Your feedback helps us improve.
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was your experience?</DialogTitle>
          <DialogDescription>
            Quick feedback helps us improve Evident for you.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          <div className="flex justify-center gap-8">
            <Button
              variant={rating === 0 ? "default" : "outline"}
              size="lg"
              className={`h-20 w-20 rounded-full ${rating === 0 ? "bg-red-500 hover:bg-red-600 border-red-500" : ""}`}
              onClick={() => handleRating(0)}
              data-testid="button-thumbs-down"
            >
              <ThumbsDown className="h-8 w-8" />
            </Button>
            <Button
              variant={rating === 1 ? "default" : "outline"}
              size="lg"
              className={`h-20 w-20 rounded-full ${rating === 1 ? "bg-green-500 hover:bg-green-600 border-green-500" : ""}`}
              onClick={() => handleRating(1)}
              data-testid="button-thumbs-up"
            >
              <ThumbsUp className="h-8 w-8" />
            </Button>
          </div>

          {rating !== null && (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                {rating === 1 ? "What did you like? (optional)" : "How can we improve? (optional)"}
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={rating === 1 ? "Tell us what worked well..." : "Tell us what could be better..."}
                className="resize-none"
                rows={3}
                data-testid="input-survey-comment"
              />
            </div>
          )}

          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={handleSkip} data-testid="button-skip-survey">
              Skip
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={rating === null || submitMutation.isPending}
              data-testid="button-submit-survey"
            >
              {submitMutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
