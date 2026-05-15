import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, ArrowRight, Clock, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePanelState } from "@/hooks/use-panel-state";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface LearningHistoryEntry {
  id: string;
  topic: string;
  summary: string | null;
  topicsLearned: string[];
  sharedToCommunity?: boolean;
  createdAt: string;
}

interface LearningHistoryResponse {
  history: LearningHistoryEntry[];
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RecentLearningWidget() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isExpanded, toggle } = usePanelState("recent-learning");

  const shareMutation = useMutation({
    mutationFn: async ({ id, share }: { id: string; share: boolean }) => {
      const endpoint = share ? "/api/community-knowledge/share" : "/api/community-knowledge/unshare";
      await apiRequest("POST", endpoint, { learningHistoryId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-history"] });
    },
  });

  const { data, isLoading } = useQuery<LearningHistoryResponse>({
    queryKey: ["/api/learning-history"],
    enabled: !authLoading && isAuthenticated,
    retry: 2,
    retryDelay: 1000,
  });

  if (!isAuthenticated) return null;
  
  const recentItems = data?.history?.slice(0, 3) || [];
  
  if (isLoading) {
    return (
      <Card className="border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-800/30 transition-colors rounded-lg"
          onClick={toggle}
        >
          <h3 className="text-sm font-medium flex items-center gap-2 text-white">
            <GraduationCap className="h-4 w-4 text-slate-300" />
            My Learning
          </h3>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
        {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4 space-y-2">
          <Skeleton className="h-12 w-full bg-slate-700" />
          <Skeleton className="h-12 w-full bg-slate-700" />
        </CardContent>
        )}
      </Card>
    );
  }

  if (recentItems.length === 0) {
    return (
      <Card className="border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-800/30 transition-colors rounded-lg"
          onClick={toggle}
        >
          <h3 className="text-sm font-medium flex items-center gap-2 text-white">
            <GraduationCap className="h-4 w-4 text-slate-300" />
            My Learning
          </h3>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
        {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4 space-y-2">
          <p className="text-xs text-slate-400 text-center py-2">
            No learning sessions yet. Use Research Mode to start building knowledge.
          </p>
        </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card className="border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-800/30 transition-colors rounded-t-lg"
        onClick={toggle}
      >
        <h3 className="text-sm font-medium flex items-center gap-2 text-white">
          <GraduationCap className="h-4 w-4 text-slate-300 flex-shrink-0" />
          My Learning
        </h3>
        <div className="flex items-center gap-2">
          <Link href="/learning" className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-blue-300 flex items-center gap-1 hover:underline cursor-pointer whitespace-nowrap" data-testid="link-view-all-learning">
              View all
              <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </div>
      {isExpanded && (
      <CardContent className="pt-0 px-4 pb-4 space-y-2 overflow-hidden">
        {recentItems.map((item) => (
          <div
            key={item.id}
            className="p-2 rounded-md bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium line-clamp-1 flex-1 min-w-0 text-white break-words">{item.topic}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => shareMutation.mutate({ id: item.id, share: !item.sharedToCommunity })}
                  disabled={shareMutation.isPending}
                  className={`flex items-center gap-0.5 text-[10px] transition-colors ${
                    item.sharedToCommunity
                      ? "text-blue-400 hover:text-blue-300"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                  title={item.sharedToCommunity ? "Helping Evi (click to undo)" : "Help Evi learn this knowledge"}
                  data-testid={`widget-share-${item.id}`}
                >
                  {item.sharedToCommunity ? (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 border-blue-600 text-blue-400">
                      Helping Evi
                    </Badge>
                  ) : (
                    <span className="text-[10px] flex items-center gap-0.5 text-slate-500 hover:text-slate-300">Help Evi Learn</span>
                  )}
                </button>
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5 whitespace-nowrap">
                  <Clock className="h-2.5 w-2.5" />
                  {formatTimeAgo(item.createdAt)}
                </span>
              </div>
            </div>
            {item.topicsLearned && item.topicsLearned.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {item.topicsLearned.slice(0, 3).map((topic, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] h-4 px-1 border-slate-600 text-slate-200 truncate max-w-[100px]">
                    {topic}
                  </Badge>
                ))}
                {item.topicsLearned.length > 3 && (
                  <span className="text-[9px] text-slate-400">
                    +{item.topicsLearned.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
      )}
    </Card>
  );
}
