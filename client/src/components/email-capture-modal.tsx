import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
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
import { Loader2, FileText, CheckCircle2 } from "lucide-react";

interface ScanData {
  averageScore: number;
  totalFiles: number;
  readyCount: number;
  needsPrepCount: number;
  manualCount: number;
  topIssues: string[];
}

interface EmailCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanData: ScanData | null;
  scanResults?: any[];
}

export function EmailCaptureModal({ 
  open, 
  onOpenChange, 
  scanData,
  scanResults 
}: EmailCaptureModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    company: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
      toast({
        title: "Email required",
        description: "Please enter your email address to access the report.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/scan-leads", {
        email: formData.email,
        name: formData.name || null,
        company: formData.company || null,
        scanData: scanData,
      });

      const data = await response.json();

      if (data.ok && data.reportToken) {
        if (scanResults) {
          sessionStorage.setItem(`scan-results-${data.reportToken}`, JSON.stringify(scanResults));
        }
        
        toast({
          title: "Report ready!",
          description: "Redirecting to your detailed report...",
        });

        onOpenChange(false);
        setLocation(`/scan/report/${data.reportToken}`);
      } else {
        throw new Error("Failed to generate report");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-400" />
            Get Your Detailed Report
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Enter your email to access your full AI readiness analysis with personalized recommendations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">
              Email <span className="text-red-400">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-white">Name (optional)</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              data-testid="input-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company" className="text-white">Company (optional)</Label>
            <Input
              id="company"
              type="text"
              placeholder="Your company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              data-testid="input-company"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isSubmitting || !formData.email}
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
              data-testid="button-submit-email"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Get My Report
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-slate-500 text-center">
            We'll send you AI readiness tips. Unsubscribe anytime.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
