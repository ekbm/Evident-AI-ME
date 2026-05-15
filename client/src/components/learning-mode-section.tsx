import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, ChevronDown, ChevronUp, Loader2, CheckCircle2, Globe, FileText, Sparkles, Plus, X, AlertCircle, Brain, GraduationCap, Link as LinkIcon, ExternalLink, Lightbulb, History } from "lucide-react";
import { HelpTip } from "./help-tip";
import eviAvatarImg from "@assets/images/evi-avatar.png";
import type { LearningSession, LearningModeStatusResponse } from "@shared/schema";

interface LearningModeSectionProps {
  selectedAssetIds: string[];
  selectedDocumentNames: string[];
  disabled?: boolean;
  isEnabled?: boolean;
  onLearningReady?: (session: LearningSession) => void;
  onSessionEnded?: () => void;
}

export function LearningModeSection({ 
  selectedAssetIds, 
  selectedDocumentNames,
  disabled = false,
  isEnabled = false,
  onLearningReady,
  onSessionEnded 
}: LearningModeSectionProps) {
  const [topic, setTopic] = useState("");
  const [searchContext, setSearchContext] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customUrls, setCustomUrls] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Expand when Learning Mode is enabled
  const [isExpanded, setIsExpanded] = useState(isEnabled);
  
  // Sync expansion with toggle state
  useEffect(() => {
    setIsExpanded(isEnabled);
  }, [isEnabled]);
  const [activeSession, setActiveSession] = useState<LearningSession | null>(null);
  const [showAddContent, setShowAddContent] = useState(false);
  const [hasNotifiedReady, setHasNotifiedReady] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  const startLearningMutation = useMutation({
    mutationFn: async (data: { topic: string; assetIds: string[]; customUrls: string[]; searchContext?: string; forceRefresh?: boolean }) => {
      const response = await apiRequest("POST", "/api/learning-mode/start", data);
      return response.json() as Promise<{ session: LearningSession }>;
    },
    onSuccess: (data) => {
      setSessionId(data.session.id);
      setActiveSession(data.session);
      setHasNotifiedReady(false);
      setUpgradeMessage(null);
    },
    onError: (error: Error) => {
      if (error.message.includes("upgrade_required") || error.message.includes("Upgrade")) {
        setUpgradeMessage("Deep Research is available on Pro and higher plans. Upgrade to unlock this feature.");
      }
    },
  });

  const addContentMutation = useMutation({
    mutationFn: async (data: { sessionId: string; assetIds?: string[]; customUrls?: string[] }) => {
      const response = await apiRequest("POST", `/api/learning-mode/${data.sessionId}/add-content`, {
        assetIds: data.assetIds,
        customUrls: data.customUrls,
      });
      return response.json() as Promise<{ session: LearningSession }>;
    },
    onSuccess: (data) => {
      setActiveSession(data.session);
      setShowAddContent(false);
      setCustomUrl("");
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async (sid: string) => {
      await apiRequest("DELETE", `/api/learning-mode/${sid}`);
    },
    onSuccess: () => {
      setSessionId(null);
      setActiveSession(null);
      setTopic("");
      setCustomUrls([]);
      onSessionEnded?.();
    },
  });

  const isTerminalStatus = activeSession?.status === "ready" || activeSession?.status === "expired";
  const { data: statusData } = useQuery<LearningModeStatusResponse>({
    queryKey: ["/api/learning-mode/status", sessionId],
    enabled: !!sessionId && !isTerminalStatus,
    refetchInterval: sessionId && !isTerminalStatus ? 2000 : false,
  });

  useEffect(() => {
    if (statusData?.session) {
      setActiveSession(statusData.session);
      if (statusData.isReady && onLearningReady && !hasNotifiedReady) {
        setHasNotifiedReady(true);
        onLearningReady(statusData.session);
      }
    }
  }, [statusData, onLearningReady, hasNotifiedReady]);

  const handleAddUrl = useCallback(() => {
    if (customUrl.trim() && customUrl.startsWith('http')) {
      setCustomUrls(prev => [...prev, customUrl.trim()]);
      setCustomUrl("");
    }
  }, [customUrl]);

  const handleRemoveUrl = useCallback((index: number) => {
    setCustomUrls(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleStart = useCallback(() => {
    if (!topic.trim()) return;
    if (selectedAssetIds.length === 0 && !searchContext.trim()) return;
    startLearningMutation.mutate({ 
      topic: topic.trim(), 
      assetIds: selectedAssetIds,
      customUrls,
      searchContext: searchContext.trim() || undefined
    });
  }, [topic, selectedAssetIds, customUrls, searchContext, startLearningMutation]);

  const handleAddMoreUrl = useCallback(() => {
    if (!sessionId) return;
    if (customUrl.trim() && customUrl.startsWith('http')) {
      addContentMutation.mutate({ 
        sessionId, 
        customUrls: [customUrl.trim()] 
      });
    }
  }, [sessionId, customUrl, addContentMutation]);

  const handleAddMoreDocuments = useCallback(() => {
    if (!sessionId || !activeSession) return;
    const newDocs = selectedAssetIds.filter(id => !activeSession.assetIds.includes(id));
    if (newDocs.length > 0) {
      addContentMutation.mutate({ 
        sessionId, 
        assetIds: newDocs 
      });
    }
  }, [sessionId, selectedAssetIds, activeSession, addContentMutation]);

  const handleReset = useCallback(() => {
    if (sessionId) {
      endSessionMutation.mutate(sessionId);
    }
  }, [sessionId, endSessionMutation]);

  const handleRelearn = useCallback(() => {
    if (!topic.trim()) return;
    if (selectedAssetIds.length === 0 && !searchContext.trim()) return;
    startLearningMutation.mutate({ 
      topic: topic.trim(), 
      assetIds: selectedAssetIds,
      customUrls,
      searchContext: searchContext.trim() || undefined,
      forceRefresh: true 
    });
  }, [topic, selectedAssetIds, customUrls, searchContext, startLearningMutation]);

  const isLearning = activeSession && activeSession.status !== "ready" && activeSession.status !== "expired";
  const isReady = activeSession?.status === "ready";
  const isExpired = activeSession?.status === "expired";
  const [researchStartTime, setResearchStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (isLearning && !researchStartTime) {
      setResearchStartTime(Date.now());
    } else if (!isLearning) {
      setResearchStartTime(null);
      setElapsedSeconds(0);
    }
  }, [isLearning, researchStartTime]);

  useEffect(() => {
    if (!researchStartTime || !isLearning) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - researchStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [researchStartTime, isLearning]);

  return (
    <Card className="border-violet-200 dark:border-slate-700 shadow-lg bg-gradient-to-br from-violet-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-white">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 pt-3 px-4 cursor-pointer hover-elevate rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-violet-600 dark:text-white" />
                <CardTitle className="text-sm font-medium text-violet-900 dark:text-white">Source-Guided Research</CardTitle>
                {isReady && (
                  <Badge variant="default" className="bg-green-600 text-xs">Ready</Badge>
                )}
                {isLearning && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {activeSession.progressPercent}%
                  </Badge>
                )}
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-violet-400 dark:text-slate-300" />
              ) : (
                <ChevronDown className="w-4 h-4 text-violet-400 dark:text-slate-300" />
              )}
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-300">
              {isReady 
                ? `Ready to answer questions about ${activeSession.topic}`
                : isLearning
                  ? `Learning about ${activeSession.topic}...`
                  : "Deep learning from documents + web research"
              }
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-2 pb-4 px-4 space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-violet-100/60 dark:bg-slate-800/40">
              <img src={eviAvatarImg} alt="Evi" className="w-12 h-12 rounded-full shrink-0 object-cover evi-float" />
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                I'll use your <span className="font-medium text-violet-700 dark:text-white">documents</span> and <span className="font-medium text-violet-700 dark:text-white">external references</span> to give you the best answer right now.
              </p>
            </div>

            {!activeSession ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Topic to learn</label>
                  <Input
                    placeholder="e.g., Qualitative Chemical Analysis"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="h-8 text-sm bg-white dark:bg-slate-800 border-violet-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400"
                    disabled={disabled}
                    data-testid="input-learning-topic"
                  />
                </div>

                <div className="rounded-md bg-violet-100/50 dark:bg-slate-800/50 p-2 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5 text-violet-400 dark:text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-300">
                      {selectedAssetIds.length > 0 
                        ? `${selectedAssetIds.length} document${selectedAssetIds.length !== 1 ? 's' : ''} selected`
                        : "Select documents from Knowledge Space"
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Globe className="h-3.5 w-3.5" />
                    <span>+ Automatic web research</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {selectedAssetIds.length > 0 
                        ? "Additional context (optional)"
                        : <>What specifically should Evi research? <span className="text-amber-500 dark:text-amber-400">*</span></>
                      }
                    </label>
                    <HelpTip text={selectedAssetIds.length > 0
                      ? "Your documents provide the reference material. Add extra context here to guide Evi's focus — e.g. which chapter, what angle, what you need it for."
                      : "Without documents, Evi needs clear context to research effectively. Be specific about what you need — vague topics can cause slow or unfocused results."
                    } />
                  </div>
                  <textarea
                    placeholder={selectedAssetIds.length > 0
                      ? "e.g., Focus on chapter 3 about market analysis, I need to understand the risk factors..."
                      : "e.g., I'm preparing for a chemistry exam and need to understand titration procedures, common indicators used, and how to calculate molarity from results..."
                    }
                    value={searchContext}
                    onChange={(e) => setSearchContext(e.target.value)}
                    className="w-full h-20 text-xs p-2 rounded-md bg-white dark:bg-slate-800 border border-violet-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-violet-300 dark:focus:ring-slate-500"
                    disabled={disabled}
                    data-testid="input-search-context"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-400">
                    {selectedAssetIds.length > 0
                      ? "Evi will use your documents as the main reference — add context to focus the research"
                      : "Be specific — e.g. \"I need to understand risk factors for my finance exam\" works better than just \"risk factors\""
                    }
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Add website URLs (optional)</label>
                    <HelpTip text="Paste links to specific websites you want Evi to use, like articles, guides, or reference pages." />
                  </div>
                  <div className="flex gap-1">
                    <Input
                      placeholder="https://example.com/resource"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="h-7 text-xs flex-1 bg-white dark:bg-slate-800 border-violet-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                      data-testid="input-custom-url"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0 border-violet-200 dark:border-slate-600 text-violet-500 dark:text-slate-300"
                      onClick={handleAddUrl}
                      disabled={!customUrl.trim() || !customUrl.startsWith('http')}
                      data-testid="button-add-url"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {customUrls.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {customUrls.map((url, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[10px] gap-1 pr-1">
                          <LinkIcon className="h-2.5 w-2.5" />
                          {new URL(url).hostname}
                          <button
                            onClick={() => handleRemoveUrl(idx)}
                            className="ml-0.5 hover:text-destructive"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {!topic.trim() && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Enter a topic to start learning</span>
                  </div>
                )}

                {topic.trim() && selectedAssetIds.length === 0 && !searchContext.trim() && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>No documents selected — add context so Evi knows what to research</span>
                  </div>
                )}

                {upgradeMessage && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20" data-testid="text-upgrade-message">
                    <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">{upgradeMessage}</p>
                      <a href="/pricing" className="text-xs font-medium text-primary hover:underline">View plans</a>
                    </div>
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={handleStart}
                  disabled={!topic.trim() || (selectedAssetIds.length === 0 && !searchContext.trim()) || startLearningMutation.isPending}
                  data-testid="button-start-learning"
                >
                  {startLearningMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Brain className="h-3.5 w-3.5 mr-1.5" />
                      Start Learning
                    </>
                  )}
                </Button>
              </>
            ) : isReady ? (
              <>
                <div className="text-center py-2">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-2 relative">
                    <img src={eviAvatarImg} alt="Evi" className="w-14 h-14 rounded-full object-cover evi-float" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-violet-900 dark:text-white">Evi is ready to help!</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Ask anything about <span className="font-medium text-violet-700 dark:text-white">{activeSession.topic}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-violet-100/50 dark:bg-slate-800/50 p-2 text-center">
                    <FileText className="h-4 w-4 mx-auto mb-0.5 text-violet-400 dark:text-slate-300" />
                    <p className="text-sm font-semibold text-violet-900 dark:text-white">{activeSession.assetIds.length}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Documents</p>
                  </div>
                  <div className="rounded-md bg-violet-100/50 dark:bg-slate-800/50 p-2 text-center">
                    <Lightbulb className="h-4 w-4 mx-auto mb-0.5 text-violet-400 dark:text-slate-300" />
                    <p className="text-sm font-semibold text-violet-900 dark:text-white">{activeSession.webSources?.length || 0}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Knowledge Areas</p>
                  </div>
                </div>

                {activeSession.topicsLearned && activeSession.topicsLearned.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Topics Learned:</p>
                    <ScrollArea className="h-20">
                      <div className="flex flex-wrap gap-1">
                        {activeSession.topicsLearned.map((t, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] border-violet-200 dark:border-slate-600 text-violet-700 dark:text-slate-200">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {activeSession.webSources && activeSession.webSources.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <ExternalLink className="h-3 w-3 text-violet-400 dark:text-slate-300" />
                      <span>Sources ({activeSession.webSources.filter(s => s.url).length} links)</span>
                    </p>
                    <ScrollArea className="h-20">
                      <div className="space-y-1.5 pr-2">
                        {activeSession.webSources.slice(0, 8).map((source, idx) => (
                          source.url ? (
                            <a
                              key={idx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-1.5 text-xs text-blue-600 dark:text-blue-300 hover:underline p-1.5 rounded bg-violet-50 dark:bg-slate-700/50 transition-colors"
                              data-testid={`link-source-${idx}`}
                            >
                              <ExternalLink className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{source.title}</span>
                            </a>
                          ) : (
                            <div
                              key={idx}
                              className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400 p-1.5 rounded bg-violet-50 dark:bg-slate-800/50"
                            >
                              <Lightbulb className="h-3 w-3 shrink-0 text-violet-400 dark:text-slate-300 mt-0.5" />
                              <span className="line-clamp-2">{source.title}</span>
                            </div>
                          )
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {showAddContent ? (
                  <div className="space-y-2 p-2 rounded-md bg-violet-100/50 dark:bg-slate-800/50">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Add more content:</p>
                    
                    {(() => {
                      const newDocsCount = selectedAssetIds.filter(id => !activeSession.assetIds.includes(id)).length;
                      return newDocsCount > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-xs gap-1"
                          onClick={handleAddMoreDocuments}
                          disabled={addContentMutation.isPending}
                          data-testid="button-add-more-docs"
                        >
                          {addContentMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <FileText className="h-3 w-3" />
                              Add {newDocsCount} new document{newDocsCount !== 1 ? 's' : ''}
                            </>
                          )}
                        </Button>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">
                          Select more documents above to add them
                        </p>
                      );
                    })()}
                    
                    <div className="flex gap-1">
                      <Input
                        placeholder="https://example.com/more-info"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        className="h-7 text-xs flex-1 bg-white dark:bg-slate-800 border-violet-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400"
                        data-testid="input-add-more-url"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-violet-200 dark:border-slate-600 text-violet-600 dark:text-slate-200"
                        onClick={handleAddMoreUrl}
                        disabled={!customUrl.trim() || !customUrl.startsWith('http') || addContentMutation.isPending}
                        data-testid="button-add-more-url"
                      >
                        {addContentMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Add"
                        )}
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full h-6 text-xs text-slate-500 dark:text-slate-300"
                      onClick={() => setShowAddContent(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs"
                    onClick={() => setShowAddContent(true)}
                    data-testid="button-show-add-content"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add More Content
                  </Button>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 h-6 text-xs"
                    onClick={handleRelearn}
                    disabled={startLearningMutation.isPending}
                    data-testid="button-relearn"
                  >
                    {startLearningMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Brain className="h-3 w-3 mr-1" />
                    )}
                    Re-learn
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-6 text-xs text-muted-foreground"
                    onClick={handleReset}
                    data-testid="button-end-learning"
                  >
                    <X className="h-3 w-3 mr-1" />
                    End Session
                  </Button>
                </div>

                <Link href="/learning">
                  <span className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors cursor-pointer" data-testid="link-my-learning">
                    <History className="h-3 w-3" />
                    View My Learning
                  </span>
                </Link>
              </>
            ) : isExpired ? (
              <>
                <div className="text-center py-2">
                  <AlertCircle className="h-8 w-8 mx-auto text-amber-400 mb-2" />
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-300">Research timed out</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {activeSession.progressMessage || "The research took too long. Try being more specific with your context."}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={handleRelearn}
                    disabled={startLearningMutation.isPending}
                    data-testid="button-retry-learning"
                  >
                    {startLearningMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Brain className="h-3 w-3 mr-1" />
                    )}
                    Try Again
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-7 text-xs text-slate-400"
                    onClick={handleReset}
                    data-testid="button-dismiss-expired"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Start Over
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center py-1">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-1" />
                  <p className="text-xs font-medium">{activeSession.progressMessage || "Processing..."}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {elapsedSeconds < 30
                      ? `${elapsedSeconds}s — usually takes 20-60 seconds`
                      : elapsedSeconds < 60
                        ? `${elapsedSeconds}s — almost there...`
                        : `${elapsedSeconds}s — taking longer than usual, please wait...`
                    }
                  </p>
                </div>

                <Progress value={activeSession.progressPercent} className="h-1.5" />

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <FileText className="h-2.5 w-2.5" />
                    {activeSession.assetIds.length} docs
                  </Badge>
                  {activeSession.customUrls && activeSession.customUrls.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <LinkIcon className="h-2.5 w-2.5" />
                      {activeSession.customUrls.length} URLs
                    </Badge>
                  )}
                  {activeSession.status === "researching" && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Globe className="h-2.5 w-2.5" />
                      Web research
                    </Badge>
                  )}
                </div>

                {elapsedSeconds >= 60 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center">
                    If this takes much longer, it will time out automatically. You can try again with more specific context.
                  </p>
                )}

                <p className="text-[10px] text-muted-foreground text-center">
                  Research runs in background — continue working!
                </p>

                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-6 text-xs text-muted-foreground"
                  onClick={handleReset}
                  data-testid="button-cancel-learning"
                >
                  Cancel
                </Button>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
