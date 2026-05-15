import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

interface DiscoveryTipCardProps {
  onActionClick: (prompt: string) => void;
  onDismiss: () => void;
}

export function DiscoveryTipCard({ onActionClick, onDismiss }: DiscoveryTipCardProps) {
  const [isDismissing, setIsDismissing] = useState(false);

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      await apiRequest("POST", "/api/discovery/flags", {
        flag: "seenTipAfterAnswer",
        value: true,
      });
    } catch (error) {
      console.error("Failed to update discovery flag:", error);
    }
    onDismiss();
  };

  const handleAction = (prompt: string) => {
    handleDismiss();
    onActionClick(prompt);
  };

  return (
    <Card 
      className="mt-4 p-4 border border-border/50 bg-muted/30"
      data-testid="card-discovery-tip"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-3">
            Did you know you could...
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("Summarise this for me")}
              data-testid="button-tip-summarise"
            >
              Summarise this
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("Explain this simply, as if I'm new to the topic")}
              data-testid="button-tip-simplify"
            >
              Explain simply
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("Give me just the key points")}
              data-testid="button-tip-keypoints"
            >
              Key points only
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleDismiss}
          disabled={isDismissing}
          data-testid="button-tip-dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
