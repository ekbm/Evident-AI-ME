import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Activity,
  MessageSquare,
  FileUp,
  Search,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import type { Asset } from "@shared/schema";
import { usePanelState } from "@/hooks/use-panel-state";

function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface ActivityItem {
  icon: typeof FileUp;
  text: string;
  fullText: string;
  time: string;
  color: string;
}

export function WorkspaceActivityPanel() {
  const { isExpanded, toggle } = usePanelState("workspace-activity");
  const { data: allAssets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const recentActivity = useMemo((): ActivityItem[] => {
    const activities: ActivityItem[] = [];
    
    const recentUploads = [...allAssets]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);

    recentUploads.forEach(asset => {
      const statusIcon = asset.status === "READY" ? Sparkles : FileUp;
      const statusColor = asset.status === "READY" ? "text-green-500" : "text-blue-500";
      const statusText = asset.status === "READY" 
        ? `"${asset.displayName || asset.filename}" ready for Q&A`
        : `Uploaded "${asset.displayName || asset.filename}"`;
      
      activities.push({
        icon: statusIcon,
        text: (() => {
          if (statusText.length <= 35) return statusText;
          const trimmed = statusText.substring(0, 35);
          const lastSpace = trimmed.lastIndexOf(" ");
          return (lastSpace > 10 ? trimmed.substring(0, lastSpace) : trimmed).trim() + "...";
        })(),
        fullText: statusText,
        time: formatTimeAgo(asset.createdAt),
        color: statusColor,
      });
    });

    return activities.slice(0, 4);
  }, [allAssets]);

  if (recentActivity.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 border-slate-700" data-testid="workspace-activity-panel">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-800/30 transition-colors rounded-t-lg"
        onClick={toggle}
      >
        <h3 className="font-semibold text-sm flex items-center gap-2 text-white">
          <Activity className="w-4 h-4 text-emerald-400" />
          Recent Activity
        </h3>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </div>
      
      {isExpanded && (
      <div className="px-4 pb-4 space-y-1">
        {recentActivity.map((activity, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <div 
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-slate-800/30 cursor-default min-w-0"
                data-testid={`activity-${index}`}
              >
                <activity.icon className={`w-3 h-3 shrink-0 ${activity.color}`} />
                <p className="text-xs flex-1 min-w-0 text-slate-200 overflow-hidden whitespace-nowrap">{activity.text}</p>
                <span className="text-[9px] text-slate-500 shrink-0 flex items-center gap-0.5">
                  <Clock className="w-2 h-2" />
                  {activity.time}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs bg-slate-800 border-slate-600 p-2">
              <p className="text-xs text-white">{activity.fullText}</p>
              <p className="text-[10px] text-slate-400 mt-1">{activity.time}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      )}
    </Card>
  );
}
