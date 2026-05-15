import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, X, Loader2, CheckCircle2, Globe, FileText, Sparkles, Play, AlertCircle } from "lucide-react";
import type { LearningSession, LearningModeStatusResponse } from "@shared/schema";

interface LearningModePanelProps {
  selectedAssetIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onReady: (session: LearningSession) => void;
}

export function LearningModePanel({ selectedAssetIds, isOpen, onClose, onReady }: LearningModePanelProps) {
  const [topic, setTopic] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const queryClient = useQueryClient();

  const startLearningMutation = useMutation({
    mutationFn: async (data: { topic: string; assetIds: string[] }) => {
      const response = await apiRequest("POST", "/api/learning-mode/start", data);
      return response.json() as Promise<{ session: LearningSession }>;
    },
    onSuccess: (data) => {
      setSessionId(data.session.id);
      setIsMinimized(true);
    },
  });

  const { data: statusData, isLoading: statusLoading } = useQuery<LearningModeStatusResponse>({
    queryKey: ["/api/learning-mode/status", sessionId],
    enabled: !!sessionId,
    refetchInterval: sessionId ? 2000 : false,
  });

  useEffect(() => {
    if (statusData?.isReady && statusData.session) {
      onReady(statusData.session);
    }
  }, [statusData?.isReady, statusData?.session, onReady]);

  const handleStart = () => {
    if (!topic.trim() || selectedAssetIds.length === 0) return;
    startLearningMutation.mutate({ topic: topic.trim(), assetIds: selectedAssetIds });
  };

  const handleCancel = () => {
    setSessionId(null);
    setTopic("");
    setIsMinimized(false);
    onClose();
  };

  if (!isOpen) return null;

  const session = statusData?.session;
  const isReady = statusData?.isReady;

  if (isMinimized && session) {
    return (
      <div 
        className="fixed bottom-20 right-4 z-50 cursor-pointer sm:bottom-4"
        onClick={() => setIsMinimized(false)}
        data-testid="learning-mode-minimized"
      >
        <Card className="w-72 shadow-lg border-2 border-primary/20 hover-elevate">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              {isReady ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">Learning Complete!</span>
                </>
              ) : (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.topic}</p>
                    <Progress value={session.progressPercent} className="h-1.5 mt-1" />
                  </div>
                </>
              )}
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-6 w-6 shrink-0"
                onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                data-testid="button-cancel-learning"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 shadow-xl" data-testid="learning-mode-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Learning Mode</CardTitle>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={handleCancel}
              data-testid="button-close-learning"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!session ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">What topic should I learn?</label>
                <Input
                  placeholder="e.g., Qualitative Chemical Analysis"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  data-testid="input-learning-topic"
                />
              </div>

              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedAssetIds.length} document{selectedAssetIds.length !== 1 ? 's' : ''} selected</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span>Will also research online for additional context</span>
                </div>
              </div>

              {selectedAssetIds.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>Please select at least one document first</span>
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleStart}
                disabled={!topic.trim() || selectedAssetIds.length === 0 || startLearningMutation.isPending}
                data-testid="button-start-learning"
              >
                {startLearningMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Start Learning
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                You can minimize this and continue working while I learn
              </p>
            </>
          ) : isReady ? (
            <>
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">I'm ready!</h3>
                  <p className="text-muted-foreground text-sm">
                    Ask me anything about <span className="font-medium text-foreground">{session.topic}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <FileText className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-semibold">{session.assetIds.length}</p>
                  <p className="text-xs text-muted-foreground">Documents</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <Globe className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-semibold">{session.webSources?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Web Sources</p>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleCancel}
                data-testid="button-start-qa"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Q&A Session
              </Button>
            </>
          ) : (
            <>
              <div className="text-center space-y-2">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                <h3 className="font-semibold">Learning in progress...</h3>
                <p className="text-sm text-muted-foreground">{session.topic}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{session.progressMessage || "Processing..."}</span>
                  <span>{session.progressPercent}%</span>
                </div>
                <Progress value={session.progressPercent} />
              </div>

              <div className="flex gap-2">
                <Badge variant="secondary" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {session.assetIds.length} docs
                </Badge>
                {session.status === "researching" && (
                  <Badge variant="secondary" className="gap-1">
                    <Globe className="h-3 w-3" />
                    Researching web
                  </Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsMinimized(true)}
                  data-testid="button-minimize-learning"
                >
                  Minimize
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  data-testid="button-cancel-learning-progress"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function LearningModeIndicator({ session, onClick }: { session: LearningSession | null; onClick: () => void }) {
  if (!session) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 border-primary/30 bg-primary/5"
      onClick={onClick}
      data-testid="button-learning-indicator"
    >
      <BookOpen className="h-4 w-4 text-primary" />
      <span className="hidden sm:inline">Learning: {session.topic}</span>
      {session.status === "ready" ? (
        <Badge variant="default" className="bg-green-600">Ready</Badge>
      ) : (
        <Badge variant="secondary">{session.progressPercent}%</Badge>
      )}
    </Button>
  );
}
