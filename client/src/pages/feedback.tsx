import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Star, MessageSquare, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const TOPICS = [
  { value: "OTHER", label: "Other / Question" },
  { value: "BUG", label: "Bug Report" },
  { value: "FEATURE", label: "Feature Request" },
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-colors"
          data-testid={`button-star-${star}`}
        >
          <Star
            className={`w-7 h-7 ${
              star <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            } transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackPage() {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [topic, setTopic] = useState("OTHER");
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/feedback", {
        type: topic,
        message: comment,
        email: email || undefined,
        rating: rating || undefined,
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Thanks for your feedback!", description: "We've received your message and will read it carefully." });
    },
    onError: () => {
      toast({ title: "Couldn't send feedback", description: "Please try again in a moment.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast({ title: "Please add your message", description: "Tell us what's on your mind.", variant: "destructive" });
      return;
    }
    submitMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/faq" data-testid="link-back-to-faq">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to FAQ
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-feedback-title">
              <MessageSquare className="w-5 h-5 text-primary" />
              Send Feedback
            </CardTitle>
            <CardDescription>
              Have a question or suggestion? Tell us what's on your mind — we read every message.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3" data-testid="feedback-success">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
                <h3 className="text-lg font-semibold">Thanks for reaching out</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Your feedback has been sent to the Evident team. We'll get back to you if a response is needed.
                </p>
                <Link href="/faq">
                  <Button variant="outline" className="mt-4" data-testid="button-back-faq">
                    Back to FAQ
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label>How would you rate your experience? (optional)</Label>
                  <StarRating value={rating} onChange={setRating} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feature-select">What is this about?</Label>
                  <Select value={topic} onValueChange={setTopic}>
                    <SelectTrigger id="feature-select" data-testid="select-feedback-topic">
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOPICS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comment">Your message</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Ask a question, report a bug, or share an idea..."
                    rows={6}
                    className="resize-none"
                    data-testid="input-feedback-comment"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Your email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    data-testid="input-feedback-email"
                  />
                  <p className="text-xs text-muted-foreground">If you'd like us to follow up with you about this feedback.</p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitMutation.isPending}
                  data-testid="button-submit-feedback"
                >
                  {submitMutation.isPending ? "Sending..." : "Send Feedback"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
