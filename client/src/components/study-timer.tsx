import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Pause, Play, BarChart3, Award } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface StudySession {
  id: string;
  userId: string;
  documentId: string | null;
  folderId: string | null;
  folderName: string | null;
  sessionType: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  isActive: boolean;
}

interface StudyStats {
  todaySeconds: number;
  weekSeconds: number;
  totalSeconds: number;
  streak: number;
  byFolder: { folderId: string; folderName: string; seconds: number }[];
  activeSession: StudySession | null;
}

interface StudyTimerProps {
  selectedAssetIds: string[];
  currentFolderId?: string | null;
  currentFolderName?: string | null;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} min`;
}

type AchievementTier = "none" | "bronze" | "silver" | "gold";

function getAchievementTier(seconds: number): AchievementTier {
  const hours = seconds / 3600;
  if (hours >= 4) return "gold";
  if (hours >= 3) return "silver";
  if (hours >= 2) return "bronze";
  return "none";
}

const tierStyles: Record<AchievementTier, { bg: string; text: string; border: string; label: string }> = {
  none: { bg: "", text: "", border: "", label: "" },
  bronze: { 
    bg: "from-amber-600/20 to-orange-700/20", 
    text: "text-amber-700 dark:text-amber-400", 
    border: "border-amber-500",
    label: "Bronze"
  },
  silver: { 
    bg: "from-slate-300/30 to-gray-400/20", 
    text: "text-slate-600 dark:text-slate-300", 
    border: "border-slate-400",
    label: "Silver"
  },
  gold: { 
    bg: "from-yellow-400/30 to-amber-500/20", 
    text: "text-yellow-600 dark:text-yellow-400", 
    border: "border-yellow-500",
    label: "Gold"
  },
};

export function StudyTimer({ selectedAssetIds, currentFolderId, currentFolderName }: StudyTimerProps) {
  const { isAuthenticated } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const { data: stats, refetch: refetchStats } = useQuery<StudyStats>({
    queryKey: ["/api/study-sessions/stats"],
    refetchInterval: isAuthenticated ? 60000 : false,
    enabled: isAuthenticated,
  });

  const startSessionMutation = useMutation({
    mutationFn: async (params: { documentId?: string; folderId?: string; folderName?: string }) => {
      const res = await apiRequest("POST", "/api/study-sessions/start", params);
      return res.json();
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setElapsedSeconds(0);
      setIsPaused(false);
      setAuthFailed(false);
    },
    onError: (error: Error) => {
      if (error.message.includes("401")) {
        setAuthFailed(true);
      }
    },
  });

  const heartbeatMutation = useMutation({
    mutationFn: async (sid: string) => {
      const res = await apiRequest("POST", "/api/study-sessions/heartbeat", { sessionId: sid });
      return res.json();
    },
    onError: (error: Error) => {
      if (error.message.includes("401")) {
        setSessionId(null);
        setAuthFailed(true);
      }
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async (sid: string) => {
      const res = await apiRequest("POST", "/api/study-sessions/end", { sessionId: sid });
      return res.json();
    },
    onSuccess: () => {
      setSessionId(null);
      setElapsedSeconds(0);
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ["/api/study-sessions/stats"] });
    },
    onError: (error: Error) => {
      if (error.message.includes("401")) {
        setSessionId(null);
        setAuthFailed(true);
      }
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      setAuthFailed(false);
    }
  }, [isAuthenticated]);

  const startSession = useCallback(() => {
    if (selectedAssetIds.length === 0 || !isAuthenticated || authFailed) return;
    if (startSessionMutation.isPending) return;
    
    startSessionMutation.mutate({
      documentId: selectedAssetIds[0],
      folderId: currentFolderId || undefined,
      folderName: currentFolderName || undefined,
    });
  }, [selectedAssetIds, currentFolderId, currentFolderName, startSessionMutation, isAuthenticated, authFailed]);

  const endSession = useCallback(() => {
    if (sessionId) {
      endSessionMutation.mutate(sessionId);
    }
  }, [sessionId, endSessionMutation]);

  useEffect(() => {
    if (!isAuthenticated || authFailed) return;
    if (selectedAssetIds.length > 0 && !sessionId && !isPaused) {
      startSession();
    } else if (selectedAssetIds.length === 0 && sessionId) {
      endSession();
    }
  }, [selectedAssetIds.length, sessionId, isPaused, startSession, endSession, isAuthenticated, authFailed]);

  useEffect(() => {
    if (sessionId && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      heartbeatRef.current = setInterval(() => {
        heartbeatMutation.mutate(sessionId);
      }, 30000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [sessionId, isPaused]);

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
    } else {
      setIsPaused(true);
      if (sessionId) {
        heartbeatMutation.mutate(sessionId);
      }
    }
  };

  const isStudying = sessionId !== null && !isPaused;
  const todayMinutes = Math.floor((stats?.todaySeconds || 0) / 60);
  const todayTier = getAchievementTier(stats?.todaySeconds || 0);
  const tierStyle = tierStyles[todayTier];

  return (
    <div className="flex items-center gap-2">
      {sessionId && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 border border-emerald-300 dark:border-emerald-700">
          <div className={`w-2 h-2 rounded-full ${isStudying ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
            {formatTime(elapsedSeconds)}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                onClick={togglePause}
              >
                {isPaused ? (
                  <Play className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Pause className="w-3 h-3 text-emerald-600" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isPaused ? "Resume studying" : "Pause timer"}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {todayTier !== "none" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r ${tierStyle.bg} border ${tierStyle.border}`}>
              <Award className={`w-3.5 h-3.5 ${tierStyle.text}`} />
              <span className={`text-xs font-bold ${tierStyle.text}`}>{tierStyle.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {todayTier === "gold" ? "Amazing! 4+ hours today!" : 
             todayTier === "silver" ? "Great work! 3+ hours today!" : 
             "Nice! 2+ hours today!"}
          </TooltipContent>
        </Tooltip>
      )}

      <Dialog>
        <DialogTrigger asChild>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Today: {todayMinutes}m</span>
                <span className="sm:hidden">{todayMinutes}m</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>View study stats</TooltipContent>
          </Tooltip>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              Study Stats
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950/40 dark:to-cyan-950/40 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs text-muted-foreground mb-1">Today</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {formatDuration(stats?.todaySeconds || 0)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-muted-foreground mb-1">This Week</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatDuration(stats?.weekSeconds || 0)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/40 border border-purple-200 dark:border-purple-800">
                <p className="text-xs text-muted-foreground mb-1">Total</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {formatDuration(stats?.totalSeconds || 0)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-muted-foreground mb-1">Streak</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {stats?.streak || 0} days
                </p>
              </div>
            </div>

            {stats?.byFolder && stats.byFolder.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Time by Subject</p>
                <div className="space-y-2">
                  {stats.byFolder.slice(0, 5).map((folder) => (
                    <div key={folder.folderId} className="flex items-center justify-between text-sm">
                      <span className="truncate">{folder.folderName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {formatDuration(folder.seconds)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
