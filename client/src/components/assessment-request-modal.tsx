import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, HardDrive, Cloud, Upload, HelpCircle, CheckCircle2 } from "lucide-react";

interface AssessmentRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextData?: {
    currentScore?: number;
    issuesSummary?: string;
    documentCount?: number;
  };
}

const ASSESSMENT_TARGETS = [
  { value: "NAS_SMB", label: "Network Drive / NAS / SMB Share", icon: HardDrive },
  { value: "DRIVE", label: "Cloud Storage (Google Drive, OneDrive, etc.)", icon: Cloud },
  { value: "UPLOADS", label: "Manual File Uploads", icon: Upload },
  { value: "NOT_SURE", label: "Not sure yet", icon: HelpCircle },
] as const;

export function AssessmentRequestModal({
  open,
  onOpenChange,
  contextData,
}: AssessmentRequestModalProps) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [assessmentTarget, setAssessmentTarget] = useState<string>("");
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: recentCheck } = useQuery<{ hasRecent: boolean; lastAt?: string }>({
    queryKey: ["/api/assessment-requests/recent"],
    enabled: open,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/assessment-requests", {
        fullName,
        email,
        organisation,
        assessmentTarget,
        message: message || undefined,
        contextJson: contextData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to submit request");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowSuccess(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim() || !email.trim() || !organisation.trim() || !assessmentTarget) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate();
  };

  useEffect(() => {
    if (!open) {
      setFullName("");
      setEmail("");
      setOrganisation("");
      setAssessmentTarget("");
      setMessage("");
      setShowSuccess(false);
    }
  }, [open]);

  if (showSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-6 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogHeader className="text-center">
              <DialogTitle>Expression of Interest Received</DialogTitle>
              <DialogDescription className="text-center">
                Thank you for your interest in enterprise assessment! We'll review your needs and reach out if this becomes available. In the meantime, try our free self-check scanner.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => onOpenChange(false)} className="mt-4" data-testid="button-close-success">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const hasRecentRequest = recentCheck?.hasRecent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enterprise AI-Readiness Assessment</DialogTitle>
          <DialogDescription>
            Interested in a deeper assessment with ongoing monitoring? Tell us about your needs and we'll reach out to discuss enterprise solutions including agent-based scanning and continuous compliance tracking.
          </DialogDescription>
        </DialogHeader>

        {hasRecentRequest ? (
          <div className="py-4">
            <div className="rounded-md bg-muted p-4 text-sm">
              <p className="font-medium">Request Already Submitted</p>
              <p className="text-muted-foreground mt-1">
                You've already submitted a request recently. Our team will be in touch soon.
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)} className="mt-4 w-full" data-testid="button-close-existing">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  required
                  data-testid="input-full-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@company.com"
                  required
                  data-testid="input-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organisation">Organisation *</Label>
              <Input
                id="organisation"
                value={organisation}
                onChange={(e) => setOrganisation(e.target.value)}
                placeholder="Acme Corp"
                required
                data-testid="input-organisation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessmentTarget">Where are your documents stored? *</Label>
              <Select value={assessmentTarget} onValueChange={setAssessmentTarget}>
                <SelectTrigger data-testid="select-target">
                  <SelectValue placeholder="Select your primary document source" />
                </SelectTrigger>
                <SelectContent>
                  {ASSESSMENT_TARGETS.map((target) => {
                    const Icon = target.icon;
                    return (
                      <SelectItem key={target.value} value={target.value} data-testid={`select-item-${target.value}`}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{target.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Additional Notes (optional)</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us about your document management challenges or specific concerns..."
                className="resize-none"
                rows={3}
                data-testid="textarea-message"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={submitMutation.isPending} data-testid="button-submit">
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
