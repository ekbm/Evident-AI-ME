import { useState, useEffect, useCallback } from "react";
import { X, Star, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const BANNER_DISMISSED_KEY = "evident_pwa_banner_dismissed";
const BANNER_NEVER_SHOW_KEY = "evident_pwa_banner_never_show";

let deferredPrompt: any = null;

function isAndroidDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function isPWAInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
}

function isIOSDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function shouldShowBanner(): boolean {
  if (typeof window === "undefined") return false;
  if (isPWAInstalled()) return false;
  if (isIOSDevice()) return false;
  if (!isAndroidDevice()) return false;

  try {
    if (localStorage.getItem(BANNER_NEVER_SHOW_KEY) === "true") return false;
  } catch (e) { /* ignore */ }

  try {
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissed) {
      const daysSince = (Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < 3) return false;
    }
  } catch (e) { /* ignore */ }

  return true;
}

export function usePWAInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      setCanInstall(false);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanInstall(false);
    return outcome === "accepted";
  }, []);

  return { canInstall, promptInstall };
}

export function PWAInstallBanner() {
  const [isVisible, setIsVisible] = useState(() => shouldShowBanner());
  const { canInstall, promptInstall } = usePWAInstallPrompt();

  useEffect(() => {
    setIsVisible(shouldShowBanner());
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, Date.now().toString());
    } catch (e) { /* ignore */ }
  };

  const handleNeverShow = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(BANNER_NEVER_SHOW_KEY, "true");
    } catch (e) { /* ignore */ }
  };

  const handleInstall = async () => {
    if (canInstall) {
      const accepted = await promptInstall();
      if (accepted) {
        setIsVisible(false);
      }
    }
  };

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-primary/5 to-accent/5 border-b border-primary/10 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground"
          onClick={handleDismiss}
          data-testid="button-dismiss-pwa-banner"
        >
          <X className="h-4 w-4" />
        </Button>

        <img
          src="/icon-192.png"
          alt="Evident"
          className="w-11 h-11 rounded-xl shadow-md shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">Evident AI</div>
          <div className="text-[11px] text-muted-foreground">Add to Home Screen</div>
          <div className="flex items-center gap-0.5 mt-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
            ))}
            <span className="text-[10px] text-muted-foreground ml-1">FREE</span>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleInstall}
          className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5 font-semibold text-xs gap-1.5"
          data-testid="button-pwa-install"
        >
          <Download className="w-3.5 h-3.5" />
          INSTALL
        </Button>
      </div>

      <button
        onClick={handleNeverShow}
        className="w-full text-center text-[10px] text-muted-foreground/60 hover:text-muted-foreground pt-1"
        data-testid="button-pwa-never-show"
      >
        Don't show again
      </button>
    </div>
  );
}
