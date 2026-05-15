import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, X } from "lucide-react";

const STORAGE_KEY = "evident_first_upload_notice_shown";

const listeners = new Set<() => void>();

export function FirstUploadNotice() {
  const [visible, setVisible] = useState(false);

  const checkVisibility = useCallback(() => {
    const alreadyShown = localStorage.getItem(STORAGE_KEY);
    setVisible(!alreadyShown);
  }, []);

  useEffect(() => {
    checkVisibility();
    listeners.add(checkVisibility);
    return () => {
      listeners.delete(checkVisibility);
    };
  }, [checkVisibility]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Card className="mb-4 border-primary/20 bg-primary/5">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm">About AI answers</h3>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 -mt-1 -mr-1"
                onClick={handleDismiss}
                data-testid="button-dismiss-notice"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Evident answers using only the files you upload. If information is missing, Evident may say "Not found". Always review important decisions.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <Link href="/ai-disclaimer">
                <Button variant="outline" size="sm" data-testid="button-read-disclaimer">
                  Read the AI Disclaimer
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleDismiss} data-testid="button-got-it">
                Got it
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function markFirstUploadNoticeShown() {
  localStorage.setItem(STORAGE_KEY, "true");
  listeners.forEach((listener) => listener());
}
