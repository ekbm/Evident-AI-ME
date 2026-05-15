import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MessageSquarePlus, Bug, Lightbulb, HelpCircle } from "lucide-react";

type FeedbackType = "BUG" | "FEATURE" | "OTHER";

interface FeedbackModalProps {
  trigger?: React.ReactNode;
}

export function FeedbackModal({ trigger }: FeedbackModalProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("FEATURE");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const submitFeedback = useMutation({
    mutationFn: async (data: { type: FeedbackType; message: string; email?: string; pageUrl: string }) => {
      return apiRequest("POST", "/api/feedback", data);
    },
    onSuccess: () => {
      toast({
        title: "Thank you for your feedback!",
        description: "We appreciate you taking the time to help us improve.",
      });
      setOpen(false);
      setMessage("");
      setEmail("");
      setType("FEATURE");
    },
    onError: () => {
      toast({
        title: "Failed to submit feedback",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    submitFeedback.mutate({
      type,
      message: message.trim(),
      email: email.trim() || undefined,
      pageUrl: window.location.pathname,
    });
  };

  const typeIcons = {
    BUG: Bug,
    FEATURE: Lightbulb,
    OTHER: HelpCircle,
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" data-testid="button-feedback">
            <MessageSquarePlus className="h-4 w-4 mr-2" />
            Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Help us improve Evident by reporting bugs or suggesting features.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>What type of feedback?</Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => setType(value as FeedbackType)}
              className="flex gap-4"
            >
              {(["BUG", "FEATURE", "OTHER"] as const).map((feedbackType) => {
                const Icon = typeIcons[feedbackType];
                const labels = {
                  BUG: "Bug Report",
                  FEATURE: "Feature Request",
                  OTHER: "Other",
                };
                return (
                  <div key={feedbackType} className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={feedbackType}
                      id={`type-${feedbackType}`}
                      data-testid={`radio-feedback-${feedbackType.toLowerCase()}`}
                    />
                    <Label
                      htmlFor={`type-${feedbackType}`}
                      className="flex items-center gap-1 cursor-pointer"
                    >
                      <Icon className="h-4 w-4" />
                      {labels[feedbackType]}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">
              {type === "BUG" ? "Describe the issue" : type === "FEATURE" ? "Describe your idea" : "Your feedback"}
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === "BUG"
                  ? "What happened? What did you expect to happen?"
                  : type === "FEATURE"
                  ? "What would you like to see in Evident?"
                  : "Share your thoughts..."
              }
              rows={4}
              required
              data-testid="textarea-feedback-message"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              data-testid="input-feedback-email"
            />
            <p className="text-xs text-muted-foreground">
              If you'd like us to follow up with you about this feedback.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid="button-feedback-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!message.trim() || submitFeedback.isPending}
              data-testid="button-feedback-submit"
            >
              {submitFeedback.isPending ? "Sending..." : "Send Feedback"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
