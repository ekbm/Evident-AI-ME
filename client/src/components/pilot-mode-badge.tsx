import { Link } from "wouter";
import { useAppContext } from "@/contexts/app-context";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FlaskConical, Info } from "lucide-react";

export function PilotModeBadge() {
  const { appMode } = useAppContext();

  if (appMode !== "PILOT") return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href="/pilot">
          <Badge 
            variant="outline" 
            className="cursor-pointer gap-1 bg-chart-4/10 text-chart-4 border-chart-4/30"
            data-testid="badge-pilot-mode"
          >
            <FlaskConical className="w-3 h-3" />
            Pilot Mode
            <Info className="w-3 h-3 ml-1 opacity-60" />
          </Badge>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-sm">
          Pilot Mode is a controlled scope for safe testing. Data is isolated to this pilot.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
