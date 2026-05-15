import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, X, Sparkles, Upload } from "lucide-react";

const TOUR_DONE_KEY = "evident_onboarding_tour_done";

interface TourStep {
  selector: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  position: "bottom" | "top";
}

const STEPS: TourStep[] = [
  {
    selector: '[data-testid="button-mode-switcher"]',
    title: "Switch Modes",
    description: "Tap here to switch between Students, Finance, Legal, HR and more. Each mode gives you specialized tools.",
    icon: Sparkles,
    position: "bottom",
  },
  {
    selector: '[data-testid="dropzone-small-files"]',
    title: "Upload & Ask Questions",
    description: "Drop your files here — PDFs, Word, Excel, images, audio and video. Then ask questions and get answers with citations linked back to the source.",
    icon: Upload,
    position: "bottom",
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findNextAvailableStep(from: number): number | null {
  for (let i = from; i < STEPS.length; i++) {
    if (document.querySelector(STEPS[i].selector)) return i;
  }
  return null;
}

function scrollToTarget(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const rect = el.getBoundingClientRect();
    const viewH = window.innerHeight;
    const isVisible = rect.top >= 0 && rect.bottom <= viewH;

    if (isVisible) {
      resolve();
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(resolve, 800);
  });
}

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [fading, setFading] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const rafRef = useRef(0);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(TOUR_DONE_KEY)) return;
    } catch {
      return;
    }
    const timer = setTimeout(() => {
      const first = findNextAvailableStep(0);
      if (first !== null) {
        setStep(first);
        setActive(true);
      } else {
        try { localStorage.setItem(TOUR_DONE_KEY, "true"); } catch {}
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const measureStep = useCallback((stepIndex: number) => {
    const s = STEPS[stepIndex];
    if (!s) return;
    const el = document.querySelector(s.selector) as HTMLElement | null;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const pad = 8;
    const spot: SpotlightRect = {
      top: rect.top - pad + window.scrollY,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    };
    setSpotlight(spot);

    const tooltipW = Math.min(320, window.innerWidth - 32);
    let tooltipLeft = spot.left + spot.width / 2 - tooltipW / 2;
    tooltipLeft = Math.max(16, Math.min(tooltipLeft, window.innerWidth - tooltipW - 16));

    const viewH = window.innerHeight;
    const scrollY = window.scrollY;
    const tooltipH = tooltipRef.current?.offsetHeight || 160;

    if (s.position === "bottom") {
      let top = spot.top + spot.height + 16;
      if (top + tooltipH > scrollY + viewH - 16) {
        top = spot.top - tooltipH - 16;
      }
      top = Math.max(scrollY + 16, Math.min(top, scrollY + viewH - tooltipH - 16));
      setTooltipStyle({ position: "absolute", top, left: tooltipLeft, width: tooltipW });
    } else {
      let top = spot.top - tooltipH - 16;
      if (top < scrollY + 16) {
        top = spot.top + spot.height + 16;
      }
      top = Math.max(scrollY + 16, Math.min(top, scrollY + viewH - tooltipH - 16));
      setTooltipStyle({ position: "absolute", top, left: tooltipLeft, width: tooltipW });
    }
  }, []);

  const scrollAndMeasure = useCallback((stepIndex: number) => {
    const s = STEPS[stepIndex];
    if (!s) return;
    const el = document.querySelector(s.selector) as HTMLElement | null;
    if (!el) return;

    setScrolling(true);
    scrollToTarget(el).then(() => {
      setScrolling(false);
      measureStep(stepIndex);
    });
  }, [measureStep]);

  useEffect(() => {
    if (!active) return;
    scrollAndMeasure(step);

    const throttledMeasure = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => measureStep(step));
    };

    window.addEventListener("resize", throttledMeasure);
    window.addEventListener("scroll", throttledMeasure, true);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", throttledMeasure);
      window.removeEventListener("scroll", throttledMeasure, true);
    };
  }, [active, step, scrollAndMeasure, measureStep]);

  const finish = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      setActive(false);
      try { localStorage.setItem(TOUR_DONE_KEY, "true"); } catch {}
      window.dispatchEvent(new CustomEvent("onboarding-tour-done"));
    }, 300);
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      const nextStep = findNextAvailableStep(step + 1);
      if (nextStep !== null) {
        setStep(nextStep);
      } else {
        finish();
      }
    } else {
      finish();
    }
  }, [step, finish]);

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" || e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, finish, next]);

  useEffect(() => {
    if (!active || scrolling) return;
    tooltipRef.current?.focus();
  }, [active, step, scrolling]);

  if (!active || !spotlight) return null;

  const currentStep = STEPS[step];
  const Icon = currentStep.icon;
  const availableStepCount = STEPS.filter((s) => document.querySelector(s.selector)).length;
  const currentAvailableIndex = STEPS.slice(0, step + 1).filter((s) => document.querySelector(s.selector)).length;

  return (
    <div
      className={`fixed inset-0 z-[9999] transition-opacity duration-300 ${fading ? "opacity-0" : scrolling ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding tour"
      style={{ pointerEvents: "none" }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ minHeight: document.documentElement.scrollHeight, pointerEvents: "auto" }}
        aria-hidden="true"
        onClick={finish}
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={spotlight.left}
              y={spotlight.top}
              width={spotlight.width}
              height={spotlight.height}
              rx="12"
              fill="black"
              className="transition-all duration-500 ease-out"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tour-mask)"
        />
      </svg>

      <div
        className="absolute rounded-xl transition-all duration-500 ease-out pointer-events-none"
        aria-hidden="true"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
          boxShadow: "0 0 0 3px hsl(var(--primary) / 0.7), 0 0 20px 4px hsl(var(--primary) / 0.3)",
          animation: "tour-pulse 2s ease-in-out infinite",
        }}
      />

      <div
        ref={tooltipRef}
        tabIndex={-1}
        className="bg-card border border-border rounded-xl shadow-2xl p-5 transition-all duration-500 ease-out outline-none"
        style={{ ...tooltipStyle, pointerEvents: "auto" }}
        data-testid="onboarding-tour-tooltip"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-foreground leading-tight">
              {currentStep.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {currentStep.description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-1.5" aria-label={`Step ${currentAvailableIndex} of ${availableStepCount}`}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-6 bg-primary"
                    : i < step
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={finish}
              className="text-muted-foreground text-xs h-8 px-3"
              data-testid="button-skip-tour"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Skip
            </Button>
            <Button
              size="sm"
              onClick={next}
              className="h-8 px-4 text-xs"
              data-testid="button-next-tour"
            >
              {step < STEPS.length - 1 && findNextAvailableStep(step + 1) !== null ? (
                <>
                  Next
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </>
              ) : (
                "Got it!"
              )}
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 3px hsl(var(--primary) / 0.7), 0 0 20px 4px hsl(var(--primary) / 0.3); }
          50% { box-shadow: 0 0 0 5px hsl(var(--primary) / 0.5), 0 0 30px 8px hsl(var(--primary) / 0.2); }
        }
      `}</style>
    </div>
  );
}
