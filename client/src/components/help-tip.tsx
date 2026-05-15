import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HelpTipProps {
  text: string;
  className?: string;
}

export function HelpTip({ text, className }: HelpTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors ${className || ""}`}
          data-testid="help-tip"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[250px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
