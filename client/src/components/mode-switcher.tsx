import { useState, useRef, useEffect } from "react";
import { useMode, MODE_CONFIGS, type VerticalMode } from "@/contexts/mode-context";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

export function ModeSwitcher() {
  const { mode, setMode, config } = useMode();
  const IconComponent = config.icon;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const modes = Object.entries(MODE_CONFIGS) as [VerticalMode, typeof config][];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 touch-manipulation"
        data-testid="button-mode-switcher"
        onClick={() => setOpen(!open)}
        onTouchEnd={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
      >
        <IconComponent className={`w-3.5 h-3.5 ${config.color}`} />
        <span className="hidden sm:inline">{config.label}</span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 w-52 rounded-md border bg-popover p-1 shadow-md z-[9999] animate-in fade-in slide-in-from-top-1 duration-150"
          data-testid="menu-mode-list"
        >
          {modes.map(([key, cfg]) => {
            const ModeIcon = cfg.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  setOpen(false);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setMode(key);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 w-full px-2 py-2 rounded-sm text-sm touch-manipulation transition-colors ${
                  mode === key
                    ? "bg-primary/15 text-accent-foreground font-semibold ring-1 ring-primary/20"
                    : "hover:bg-accent/30 text-popover-foreground"
                }`}
                data-testid={`menu-mode-${key}`}
              >
                <ModeIcon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
                <div className="flex flex-col text-left">
                  <span className="font-medium">{cfg.label}</span>
                  <span className="text-xs text-muted-foreground">{cfg.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
