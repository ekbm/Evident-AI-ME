import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, FileSearch, Shield, BookOpen } from "lucide-react";

interface ExplainWhyModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingItems?: string[];
}

export function ExplainWhyModal({ isOpen, onClose, missingItems = [] }: ExplainWhyModalProps) {
  const [showMissingDetails, setShowMissingDetails] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            Why you're seeing this
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3">
            <FileSearch className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-foreground/80">
              Evident answers only from your documents and cited sources — never from general knowledge or guessing.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-foreground/80">
              Some questions (especially engineering, finance, or technical topics) need extra assumptions like:
            </p>
          </div>

          <ul className="text-sm text-muted-foreground pl-10 space-y-1">
            <li className="list-disc">Boundary conditions or constraints</li>
            <li className="list-disc">Material properties or safety factors</li>
            <li className="list-disc">Standard formulas or methods</li>
            <li className="list-disc">Industry-specific defaults</li>
          </ul>

          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-foreground/70">
              <strong className="text-foreground">General AI tools</strong> may guess missing details. <strong className="text-primary">Evident</strong> will instead ask, cite, or clearly label any assumptions used.
            </p>
          </div>

          {missingItems.length > 0 && (
            <div className="border-t pt-3">
              <button
                onClick={() => setShowMissingDetails(!showMissingDetails)}
                className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                data-testid="button-toggle-missing-details"
              >
                {showMissingDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showMissingDetails ? "Hide" : "Show"} what's missing for this question
              </button>

              {showMissingDetails && (
                <ul className="mt-2 text-sm text-muted-foreground pl-4 space-y-1 bg-muted/30 rounded p-2">
                  {missingItems.map((item, idx) => (
                    <li key={idx} className="list-disc">{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} data-testid="button-got-it">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
