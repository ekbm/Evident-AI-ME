import { useState, useEffect } from "react";
import { X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

const APP_STORE_URL = "https://apps.apple.com/au/app/evidentai/id6758041735";
const BANNER_DISMISSED_KEY = "evident_app_banner_dismissed";
const BANNER_NEVER_SHOW_KEY = "evident_app_banner_never_show";

function shouldShowBanner(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    if (sessionStorage.getItem('isIOSApp') === 'true') return false;
  } catch (e) { /* ignore */ }
  
  try {
    if (localStorage.getItem(BANNER_NEVER_SHOW_KEY) === 'true') return false;
  } catch (e) { /* ignore */ }
  
  const userAgent = navigator.userAgent || navigator.vendor;
  const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
  const isStandalone = (window.navigator as any).standalone === true;
  const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(userAgent);
  
  if (!isIOSDevice || isStandalone || !isSafari) return false;
  
  try {
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return false;
    }
  } catch (e) { /* ignore */ }
  
  return true;
}

export function IOSAppBanner() {
  const [isVisible, setIsVisible] = useState(() => shouldShowBanner());

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
      localStorage.setItem(BANNER_NEVER_SHOW_KEY, 'true');
    } catch (e) { /* ignore */ }
  };

  const handleOpen = () => {
    window.location.href = APP_STORE_URL;
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-primary/5 to-accent/5 border-b border-primary/10 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground"
          onClick={handleDismiss}
          data-testid="button-dismiss-app-banner"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <img
          src="/apple-touch-icon.png?v=3"
          alt="Evident"
          className="w-11 h-11 rounded-xl shadow-md shrink-0"
        />
        
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">Evident AI</div>
          <div className="text-[11px] text-muted-foreground">Your AI Document Assistant</div>
          <div className="flex items-center gap-0.5 mt-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
            ))}
            <span className="text-[10px] text-muted-foreground ml-1">FREE</span>
          </div>
        </div>
        
        <Button
          size="sm"
          onClick={handleOpen}
          className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5 font-semibold text-xs"
          data-testid="button-open-app-store"
        >
          OPEN
        </Button>
      </div>
      
      <button
        onClick={handleNeverShow}
        className="w-full text-center text-[10px] text-muted-foreground/60 hover:text-muted-foreground pt-1"
        data-testid="button-never-show-banner"
      >
        Don't show again
      </button>
    </div>
  );
}
