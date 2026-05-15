import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Star, MessageSquare, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const FEATURES = [
  { value: "document_qa", label: "Document Q&A" },
  { value: "deep_research", label: "Research Mode" },
  { value: "exam_prep", label: "Exam Prep" },
  { value: "knowledge_base", label: "Knowledge Base" },
  { value: "grading", label: "Grading" },
  { value: "community", label: "Community Knowledge" },
  { value: "other", label: "Other" },
];

const STUDY_IMPACTS = [
  { value: "very_helpful", label: "Very helpful — saves me a lot of time" },
  { value: "somewhat_helpful", label: "Somewhat helpful — I use it occasionally" },
  { value: "neutral", label: "Neutral — still figuring it out" },
  { value: "not_helpful", label: "Not helpful yet — I need more features" },
];

const UPGRADE_INTERESTS = [
  { value: "very_likely", label: "Very likely" },
  { value: "likely", label: "Likely" },
  { value: "maybe", label: "Maybe, depends on features" },
  { value: "unlikely", label: "Unlikely" },
  { value: "need_more_info", label: "Need more information" },
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

export function FeedbackPrompt() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();

  const [rating, setRating] = useState(0);
  const [mostUsedFeature, setMostUsedFeature] = useState("");
  const [missingFeature, setMissingFeature] = useState("");
  const [studyImpact, setStudyImpact] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [upgradeInterest, setUpgradeInterest] = useState("");
  const [freeformComment, setFreeformComment] = useState("");
  const handledRef = useRef(false);

  const { data: checkData } = useQuery<{
    showSurvey: boolean;
    surveyType?: string;
    daysSinceSignup?: number;
    trialDaysRemaining?: number;
    isStudent?: boolean;
  }>({
    queryKey: ["/api/feedback/check"],
    refetchInterval: user ? 5 * 60 * 1000 : false,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  useEffect(() => {
    if (checkData?.showSurvey && !handledRef.current) {
      const timer = setTimeout(() => setOpen(true), 5 * 60 * 1000);
      return () => clearTimeout(timer);
    }
  }, [checkData?.showSurvey]);

  const invalidateCheck = () => {
    queryClient.setQueryData(["/api/feedback/check"], { showSurvey: false });
    handledRef.current = true;
  };

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/feedback/submit", data);
    },
    onSuccess: () => {
      toast({ title: "Thanks for your feedback!", description: "Your input helps us improve Evident for everyone." });
      invalidateCheck();
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please try again later", variant: "destructive" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/feedback/dismiss", {});
    },
  });

  const handleDismiss = () => {
    dismissMutation.mutate();
    invalidateCheck();
    setOpen(false);
  };

  const handleDialogClose = (v: boolean) => {
    if (!v) {
      setOpen(false);
    }
  };

  const handleSubmit = () => {
    submitMutation.mutate({
      rating,
      mostUsedFeature: mostUsedFeature || undefined,
      missingFeature: missingFeature || undefined,
      studyImpact: studyImpact || undefined,
      wouldRecommend,
      upgradeInterest: upgradeInterest || undefined,
      freeformComment: freeformComment || undefined,
      surveyType: checkData?.surveyType || "periodic",
      daysSinceSignup: checkData?.daysSinceSignup,
      trialDaysRemaining: checkData?.trialDaysRemaining,
      isStudent: checkData?.isStudent,
    });
  };

  if (!checkData?.showSurvey) return null;

  const isConversion = checkData.surveyType === "conversion";
  const isStudent = checkData.isStudent;
  const totalSteps = isConversion ? 3 : 2;

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md" data-testid="feedback-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-feedback-title">
            <MessageSquare className="w-5 h-5 text-primary" />
            {isConversion
              ? "How's your experience so far?"
              : "Quick feedback"}
          </DialogTitle>
          <DialogDescription data-testid="text-feedback-description">
            {isConversion && checkData.trialDaysRemaining != null
              ? `Your Scholar trial ends in ${checkData.trialDaysRemaining} days. Help us improve your experience.`
              : "Takes less than a minute — your input shapes what we build next."}
          </DialogDescription>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>How would you rate your experience?</Label>
              <StarRating value={rating} onChange={setRating} />
            </div>
            <div className="space-y-2">
              <Label>Which feature do you use most?</Label>
              <Select value={mostUsedFeature} onValueChange={setMostUsedFeature}>
                <SelectTrigger data-testid="select-most-used-feature">
                  <SelectValue placeholder="Select a feature" />
                </SelectTrigger>
                <SelectContent>
                  {FEATURES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleDismiss} data-testid="button-feedback-skip">
                Maybe later
              </Button>
              <Button onClick={() => setStep(1)} disabled={!rating} data-testid="button-feedback-next">
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 py-2">
            {isStudent && (
              <div className="space-y-2">
                <Label>How has Evident impacted your studies?</Label>
                <Select value={studyImpact} onValueChange={setStudyImpact}>
                  <SelectTrigger data-testid="select-study-impact">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDY_IMPACTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Would you recommend Evident to a friend?</Label>
              <div className="flex gap-2">
                <Button
                  variant={wouldRecommend === true ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setWouldRecommend(true)}
                  data-testid="button-recommend-yes"
                >
                  Yes
                </Button>
                <Button
                  variant={wouldRecommend === false ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setWouldRecommend(false)}
                  data-testid="button-recommend-no"
                >
                  Not yet
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>What feature would you most like to see added?</Label>
              <Textarea
                value={missingFeature}
                onChange={(e) => setMissingFeature(e.target.value)}
                placeholder="Tell us what would make Evident more useful for you..."
                className="resize-none"
                rows={2}
                data-testid="input-missing-feature"
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(0)} data-testid="button-feedback-back">
                Back
              </Button>
              <div className="flex gap-2">
                {isConversion ? (
                  <Button onClick={() => setStep(2)} data-testid="button-feedback-next-2">
                    Next
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={submitMutation.isPending} data-testid="button-feedback-submit">
                    {submitMutation.isPending ? "Sending..." : "Submit"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && isConversion && (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>How likely are you to continue using Evident?</Label>
              <Select value={upgradeInterest} onValueChange={setUpgradeInterest}>
                <SelectTrigger data-testid="select-upgrade-interest">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {UPGRADE_INTERESTS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Anything else you'd like to share?</Label>
              <Textarea
                value={freeformComment}
                onChange={(e) => setFreeformComment(e.target.value)}
                placeholder="Your thoughts, suggestions, or anything on your mind..."
                className="resize-none"
                rows={3}
                data-testid="input-freeform-comment"
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(1)} data-testid="button-feedback-back-2">
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={submitMutation.isPending} data-testid="button-feedback-submit">
                {submitMutation.isPending ? "Sending..." : "Submit"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
