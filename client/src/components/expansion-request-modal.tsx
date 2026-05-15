import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";

interface ExpansionRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pilotId?: string;
  currentLimits: {
    documents: number;
    sizeMB: number;
  };
}

export function ExpansionRequestModal({ 
  open, 
  onOpenChange, 
  pilotId,
  currentLimits 
}: ExpansionRequestModalProps) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    organisation: "",
    requestedDocsLimit: "",
    requestedSizeMB: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/pilot/request-expansion", {
        pilotId,
        fullName: formData.fullName,
        email: formData.email,
        organisation: formData.organisation,
        requestedDocsLimit: formData.requestedDocsLimit ? parseInt(formData.requestedDocsLimit) : undefined,
        requestedSizeMB: formData.requestedSizeMB ? parseInt(formData.requestedSizeMB) : undefined,
        message: formData.message || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        fullName: "",
        email: "",
        organisation: "",
        requestedDocsLimit: "",
        requestedSizeMB: "",
        message: "",
      });
    }, 200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.organisation) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate();
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Request Received</h3>
            <p className="text-muted-foreground mb-6">
              The Evident team will contact you about expanding your pilot limits.
            </p>
            <Button onClick={handleClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Pilot Expansion</DialogTitle>
          <DialogDescription>
            Current limits: {currentLimits.documents} documents, {currentLimits.sizeMB} MB storage
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              placeholder="Your name"
              data-testid="input-full-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="your@email.com"
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organisation">Organisation *</Label>
            <Input
              id="organisation"
              value={formData.organisation}
              onChange={(e) => setFormData(prev => ({ ...prev, organisation: e.target.value }))}
              placeholder="Your organisation"
              data-testid="input-organisation"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="requestedDocsLimit">Documents needed</Label>
              <Input
                id="requestedDocsLimit"
                type="number"
                value={formData.requestedDocsLimit}
                onChange={(e) => setFormData(prev => ({ ...prev, requestedDocsLimit: e.target.value }))}
                placeholder={`${currentLimits.documents}+`}
                data-testid="input-docs-limit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requestedSizeMB">Storage (MB)</Label>
              <Input
                id="requestedSizeMB"
                type="number"
                value={formData.requestedSizeMB}
                onChange={(e) => setFormData(prev => ({ ...prev, requestedSizeMB: e.target.value }))}
                placeholder={`${currentLimits.sizeMB}+`}
                data-testid="input-size-limit"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Additional notes</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Any additional context about your needs..."
              rows={3}
              data-testid="input-message"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-submit">
              {mutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
