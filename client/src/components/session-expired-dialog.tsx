import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, Loader2 } from "lucide-react";
import { clearStoredAuthToken, getStoredAuthToken } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { resetGlobalAuthFailed } from "@/lib/queryClient";

interface SessionExpiredDialogProps {
  open: boolean;
  onDismiss: () => void;
}

async function clearServerSession(): Promise<void> {
  try {
    await fetch("/api/auth/clear-session", {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("[SessionExpired] Failed to clear server session:", err);
  }
  clearStoredAuthToken();
}

export function SessionExpiredDialog({ open, onDismiss }: SessionExpiredDialogProps) {
  const hadEmailToken = !!getStoredAuthToken();
  const queryClient = useQueryClient();
  const [isClearing, setIsClearing] = useState(false);

  const fullCleanup = async () => {
    await clearServerSession();
    resetGlobalAuthFailed();
    queryClient.setQueryData(["/api/auth/user"], null);
    queryClient.removeQueries({
      predicate: (query) => {
        const key = query.queryKey[0] as string;
        return typeof key === 'string' && key.startsWith('/api/') && key !== '/api/auth/user';
      },
    });
    onDismiss();
  };

  const handleLogin = async () => {
    setIsClearing(true);
    await fullCleanup();
    if (hadEmailToken) {
      window.location.href = "/auth?tab=login";
    } else {
      window.location.href = "/api/login";
    }
  };

  const handleContinue = async () => {
    setIsClearing(true);
    await fullCleanup();
    setIsClearing(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle data-testid="text-session-expired-title">Session Expired</DialogTitle>
          <DialogDescription data-testid="text-session-expired-description">
            You've been logged out due to inactivity. Log back in to pick up where you left off.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Button onClick={handleLogin} disabled={isClearing} data-testid="button-session-login">
            {isClearing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
            Log Back In
          </Button>
          <Button variant="ghost" onClick={handleContinue} disabled={isClearing} data-testid="button-session-dismiss">
            {isClearing ? "Clearing session..." : "Continue Browsing"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
