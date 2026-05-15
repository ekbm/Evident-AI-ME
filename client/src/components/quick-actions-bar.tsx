import { useState } from "react";
import { useMode } from "@/contexts/mode-context";
import type { SectorPromptGroup } from "@/contexts/mode-context";
import { Button } from "@/components/ui/button";
import { Lightbulb, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";

interface QuickActionsBarProps {
  onQuickAction: (prompt: string) => void;
  disabled?: boolean;
  compact?: boolean;
  onExploreTools?: () => void;
}

function SectorGroup({ group, onQuickAction, disabled }: { group: SectorPromptGroup; onQuickAction: (prompt: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-lg bg-card/50" data-testid={`sector-group-${group.sector.toLowerCase().replace(/\s+/g, '-')}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        data-testid={`button-toggle-sector-${group.sector.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <group.icon className={`w-3.5 h-3.5 ${group.color}`} />
        <span>{group.sector}</span>
        <span className="text-[10px] text-muted-foreground/60 ml-auto mr-1">{group.prompts.length} prompts</span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="px-3 pb-2.5 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {group.prompts.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onQuickAction(action.prompt);
                setOpen(false);
              }}
              className="gap-1 text-xs h-7 px-2"
              data-testid={`sector-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <action.icon className={`w-3 h-3 ${group.color}`} />
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuickActionsBar({ onQuickAction, disabled, compact, onExploreTools }: QuickActionsBarProps) {
  const { config, mode } = useMode();
  const [expanded, setExpanded] = useState(false);

  if (config.quickActions.length === 0) return null;

  if (compact) {
    return (
      <div className="mb-2" data-testid="quick-actions-bar-compact">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
          data-testid="button-toggle-quick-actions"
        >
          <config.icon className={`w-3.5 h-3.5 ${config.color}`} />
          <span>{config.label} Prompts</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {expanded && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-[100px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {config.quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => {
                    onQuickAction(action.prompt);
                    setExpanded(false);
                  }}
                  className="gap-1 text-xs h-7 px-2"
                  data-testid={`quick-action-compact-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <action.icon className={`w-3 h-3 ${config.color}`} />
                  {action.label}
                </Button>
              ))}
            </div>
            {config.sectorPrompts && config.sectorPrompts.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {config.sectorPrompts.map((group) => (
                  <SectorGroup key={group.sector} group={group} onQuickAction={(prompt) => { onQuickAction(prompt); setExpanded(false); }} disabled={disabled} />
                ))}
              </div>
            )}
            {onExploreTools && (
              <button
                type="button"
                onClick={() => { setExpanded(false); onExploreTools(); }}
                className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium mt-2 transition-colors"
                data-testid="button-explore-tools-compact"
              >
                More tools in Knowledge Space
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3" data-testid="quick-actions-bar">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-2 text-left hover:opacity-80 transition-opacity w-full"
        data-testid="button-toggle-quick-actions-full"
      >
        <config.icon className={`w-3.5 h-3.5 ${config.color}`} />
        <span className="text-xs font-medium text-muted-foreground flex-1">{config.label} Quick Actions</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {expanded && (
      <>
      <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {config.quickActions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onQuickAction(action.prompt)}
            className="gap-1.5 text-xs"
            data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <action.icon className={`w-3 h-3 ${config.color}`} />
            {action.label}
          </Button>
        ))}
      </div>
      {config.sectorPrompts && config.sectorPrompts.length > 0 && (
        <div className="mt-3 space-y-1.5" data-testid="sector-prompts-container">
          {config.sectorPrompts.map((group) => (
            <SectorGroup key={group.sector} group={group} onQuickAction={onQuickAction} disabled={disabled} />
          ))}
        </div>
      )}
      {onExploreTools && (
        <button
          type="button"
          onClick={onExploreTools}
          className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium mt-2.5 px-1 transition-colors"
          data-testid="button-explore-tools-full"
        >
          More tools in Knowledge Space
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
      <div className="flex items-start gap-1.5 mt-2.5 px-1" data-testid="text-more-prompts-coming">
        <Lightbulb className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-snug">
          More industry-specific prompts will be made available soon. Please use the feedback button if you need anything specific.
        </p>
      </div>
      </>
      )}
    </div>
  );
}
