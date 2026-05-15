import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMode } from "@/contexts/mode-context";

interface WelcomeModalProps {
  isAuthenticated: boolean;
  hasSeenWelcomeServer?: boolean;
}

const WELCOME_SHOWN_KEY = "evident_welcome_shown";
const TOUR_DONE_KEY = "evident_onboarding_tour_done";

const MODE_LABELS: Record<string, string> = {
  general: "Professionals",
  students: "Student",
  educators: "Educator",
  finance: "Finance & Accounting",
  legal: "Legal",
  hr: "HR",
};

function highlightModeSwitcher() {
  const btn = document.querySelector('[data-testid="button-mode-switcher"]') as HTMLElement | null;
  if (!btn) return;

  btn.style.transition = "box-shadow 0.4s, transform 0.4s";
  btn.style.boxShadow = "0 0 0 3px hsl(var(--primary) / 0.5)";
  btn.style.transform = "scale(1.08)";

  const pulse = () => {
    btn.style.boxShadow = "0 0 0 5px hsl(var(--primary) / 0.3)";
    setTimeout(() => {
      btn.style.boxShadow = "0 0 0 3px hsl(var(--primary) / 0.5)";
    }, 600);
  };

  const interval = setInterval(pulse, 1200);

  setTimeout(() => {
    clearInterval(interval);
    btn.style.boxShadow = "";
    btn.style.transform = "";
  }, 6000);
}

export function WelcomeModal({ isAuthenticated, hasSeenWelcomeServer }: WelcomeModalProps) {
  const { toast } = useToast();
  const { verticalMode } = useMode();

  useEffect(() => {
    if (!isAuthenticated) return;

    let hasSeenWelcomeLocal = false;
    try {
      hasSeenWelcomeLocal = !!localStorage.getItem(WELCOME_SHOWN_KEY);
    } catch {}
    const hasSeenWelcome = hasSeenWelcomeServer || hasSeenWelcomeLocal;

    if (!hasSeenWelcome) {
      let tourPending = false;
      try {
        tourPending = !localStorage.getItem(TOUR_DONE_KEY);
      } catch {}

      if (tourPending) {
        const onTourDone = () => {
          try { localStorage.setItem(WELCOME_SHOWN_KEY, "true"); } catch {}
          apiRequest("POST", "/api/me/welcome-seen").catch(() => {});
          window.dispatchEvent(new CustomEvent("welcome-modal-closed"));
        };
        window.addEventListener("onboarding-tour-done", onTourDone, { once: true });
        return () => window.removeEventListener("onboarding-tour-done", onTourDone);
      }

      const timer = setTimeout(() => {
        const currentLabel = MODE_LABELS[verticalMode] || "Student";
        const otherModes = Object.entries(MODE_LABELS)
          .filter(([key]) => key !== verticalMode)
          .map(([, label]) => label);
        const otherModesText = otherModes.slice(0, 3).join(", ");

        toast({
          title: "Welcome to Evident!",
          description: `You're in ${currentLabel} mode. Tap the mode button in the header to switch to ${otherModesText}, or other modes anytime.`,
          duration: 10000,
        });

        setTimeout(highlightModeSwitcher, 300);

        try {
          localStorage.setItem(WELCOME_SHOWN_KEY, "true");
        } catch {}
        window.dispatchEvent(new CustomEvent("welcome-modal-closed"));
        apiRequest("POST", "/api/me/welcome-seen").catch(() => {});
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasSeenWelcomeServer, toast, verticalMode]);

  return null;
}
