import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Gift, Send, Loader2, CheckCircle2, AlertCircle, Lightbulb, HeartCrack } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorType?: string;
  errorMessage?: string;
  defaultType?: 'issue' | 'improvement' | 'satisfaction';
}

export function ReportIssueDialog({ open, onOpenChange, errorType, errorMessage, defaultType = 'issue' }: ReportIssueDialogProps) {
  const [type, setType] = useState<'issue' | 'improvement' | 'satisfaction'>(defaultType);
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (description.trim().length < 10) {
      toast({
        title: "Description too short",
        description: "Please provide more details (at least 10 characters)",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/reward-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          errorType: type === 'issue' ? (errorType || 'user_reported') : type === 'improvement' ? 'improvement_suggestion' : 'satisfaction_claim',
          errorMessage: type === 'issue' ? errorMessage : null,
          description: description.trim(),
          email: email.trim() || null,
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.ok) {
        setSubmitted(true);
      } else {
        toast({
          title: "Could not submit",
          description: data.message || "Please try again later",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Connection error",
        description: "Please check your internet and try again",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setDescription("");
      setEmail("");
      setSubmitted(false);
      setType('issue');
    }, 300);
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-report-submitted">
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Thank you!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your {type === 'issue' ? 'report' : type === 'improvement' ? 'suggestion' : 'claim'} has been submitted. Our team will review it and you may receive a reward if approved.
              </p>
            </div>
            <Button onClick={handleClose} data-testid="button-close-submitted">
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-report-issue">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Report & Earn a Reward
          </DialogTitle>
          <DialogDescription>
            Help us improve! Report an issue or suggest an improvement and you may earn bonus uploads or a discount.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <RadioGroup value={type} onValueChange={(v) => setType(v as 'issue' | 'improvement' | 'satisfaction')} className="grid gap-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="issue" id="type-issue" data-testid="radio-issue" />
              <Label htmlFor="type-issue" className="flex items-center gap-1.5 cursor-pointer">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Report an issue
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="improvement" id="type-improvement" data-testid="radio-improvement" />
              <Label htmlFor="type-improvement" className="flex items-center gap-1.5 cursor-pointer">
                <Lightbulb className="w-4 h-4 text-blue-500" />
                Suggest an improvement
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="satisfaction" id="type-satisfaction" data-testid="radio-satisfaction" />
              <Label htmlFor="type-satisfaction" className="flex items-center gap-1.5 cursor-pointer">
                <HeartCrack className="w-4 h-4 text-rose-500" />
                Service not satisfactory
              </Label>
            </div>
          </RadioGroup>

          {type === 'issue' && errorMessage && (
            <div className="bg-muted/50 rounded-lg p-3 border">
              <p className="text-xs text-muted-foreground mb-1">Error detected:</p>
              <p className="text-sm font-mono text-foreground break-all">{errorMessage}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">
              {type === 'issue' ? 'What happened?' : type === 'improvement' ? 'What would you improve?' : 'What went wrong?'}
            </Label>
            <Textarea
              id="description"
              placeholder={type === 'issue' 
                ? "Please describe what you were trying to do and what went wrong..."
                : type === 'improvement'
                ? "Share your idea for how we can make Evident better..."
                : "Please describe how the service did not meet your expectations..."
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px]"
              data-testid="textarea-description"
            />
            <p className="text-xs text-muted-foreground">
              {description.length < 10 ? `${10 - description.length} more characters needed` : 'Looks good!'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-email"
            />
            <p className="text-xs text-muted-foreground">
              We'll notify you if your report is approved for a reward
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || description.trim().length < 10}
              data-testid="button-submit-report"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
