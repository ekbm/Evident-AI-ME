import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSearch, FileCheck, BookOpen, Zap } from "lucide-react";

interface AssessmentInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INCLUDED_ITEMS = [
  {
    icon: Zap,
    title: "Instant Analysis",
    description: "Upload your documents and get results immediately - no waiting for a team to review",
  },
  {
    icon: FileSearch,
    title: "Document Scanning",
    description: "Comprehensive scan of document formats, structures, and metadata quality",
  },
  {
    icon: FileCheck,
    title: "Readiness Scoring",
    description: "Detailed breakdown of extractability, structure, quality, and metadata scores",
  },
  {
    icon: BookOpen,
    title: "Issue Report",
    description: "Prioritized list of issues with severity ratings and improvement suggestions",
  },
];

export function AssessmentInfoDialog({ open, onOpenChange }: AssessmentInfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How Self-Check Works</DialogTitle>
          <DialogDescription>
            Run your own AI readiness assessment in minutes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {INCLUDED_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-md bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            For enterprise needs like agent-based scanning, network drive integration, and ongoing compliance monitoring, contact us to discuss your requirements.
          </p>
        </div>

        <DialogClose asChild>
          <Button className="w-full mt-2" data-testid="button-close-info">
            Got It
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
