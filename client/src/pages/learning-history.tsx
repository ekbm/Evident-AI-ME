import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  BookOpen, 
  Calendar, 
  FileText,
  ExternalLink,
  Trash2,
  Sparkles,
  GraduationCap,
  Share2,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AuthRequiredMessage } from "@/components/auth-required-message";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useToast } from "@/hooks/use-toast";
import { HelpTip } from "@/components/help-tip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LearningHistoryEntry {
  id: string;
  topic: string;
  summary: string | null;
  sources: Array<{ title: string; url: string; snippet?: string }>;
  topicsLearned: string[];
  documentIds: string[];
  documentNames: string[];
  customUrls: string[];
  sharedToCommunity?: boolean;
  createdAt: string;
}

interface LearningHistoryResponse {
  history: LearningHistoryEntry[];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function LearningHistoryPage() {
  useDocumentTitle("My Learning");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [shareConfirmId, setShareConfirmId] = useState<string | null>(null);
  const [shareConfirmAction, setShareConfirmAction] = useState<boolean>(false);
  const { data, isLoading, error } = useQuery<LearningHistoryResponse>({
    queryKey: ["/api/learning-history"],
    enabled: !authLoading && isAuthenticated,
    retry: 2,
    retryDelay: 1000,
  });

  const shareMutation = useMutation({
    mutationFn: async ({ id, share }: { id: string; share: boolean }) => {
      const endpoint = share ? "/api/community-knowledge/share" : "/api/community-knowledge/unshare";
      await apiRequest("POST", endpoint, { learningHistoryId: id });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-history"] });
      toast({
        title: variables.share ? "Helping Evi get smarter" : "Contribution removed",
        description: variables.share
          ? "Your knowledge will help Evi give better answers to other students (shared anonymously)."
          : "Your learning has been removed and will no longer help other students.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update sharing. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/learning-history/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-history"] });
      toast({
        title: "Entry deleted",
        description: "Learning history entry has been removed.",
      });
      setDeleteId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/full")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
              <GraduationCap className="h-6 w-6 text-white" />
              <h1 className="text-2xl font-bold text-white">My Learning</h1>
            </div>
          </div>
          
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Sign in to view your learning history</p>
              <p className="text-muted-foreground mb-6">Your learning sessions will be saved here after you sign in.</p>
              <AuthRequiredMessage />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const history = data?.history || [];

  return (
    <div className="min-h-screen bg-background relative">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24 sm:pb-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/full")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
            <GraduationCap className="h-6 w-6 text-white" />
            <h1 className="text-2xl font-bold text-white">My Learning</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <p>Your learning history from Research Mode sessions.</p>
          <HelpTip text="Help Evi get smarter by contributing your learning. Use the share button on each entry to anonymously help Evi give better answers to difficult questions." />
        </div>

        {!isLoading && !error && (() => {
          const totalTopics = history.length;
          const totalSources = history.reduce((acc, e) => acc + (e.sources?.length || 0), 0);
          const totalSubTopics = history.reduce((acc, e) => acc + (e.topicsLearned?.length || 0), 0);
          const sharedCount = history.filter(e => e.sharedToCommunity).length;
          const fromDocuments = history.filter(e => e.documentIds?.length > 0).length;
          const fromWeb = history.filter(e => !e.documentIds?.length || e.documentIds.length === 0).length;

          return totalTopics > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{totalTopics}</p>
                  <p className="text-xs text-muted-foreground mt-1">Topics Learned</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{totalSubTopics}</p>
                  <p className="text-xs text-muted-foreground mt-1">Sub-topics Covered</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{totalSources}</p>
                  <p className="text-xs text-muted-foreground mt-1">Web Sources</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-2xl font-bold">{sharedCount}</p>
                    <span className="text-sm text-muted-foreground">/ {totalTopics}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    Helping Evi
                    <HelpTip text="Tap 'Make Evi Smarter' on any learning entry below to increase this. Your knowledge is shared anonymously to help Evi give better answers." />
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null;
        })()}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Failed to load learning history.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/learning-history"] })}
                data-testid="button-retry"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No learning sessions yet</h3>
              <p className="text-muted-foreground mb-4">
                Start exploring topics with Learning Mode to build your knowledge library.
              </p>
              <Button
                onClick={() => navigate("/")}
                data-testid="button-start-learning"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Start Learning
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <Card key={entry.id} className="relative group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg leading-tight">
                        {entry.topic}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(entry.createdAt)}
                        {entry.sharedToCommunity && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Helping Evi
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant={entry.sharedToCommunity ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setShareConfirmId(entry.id);
                          setShareConfirmAction(!entry.sharedToCommunity);
                        }}
                        disabled={shareMutation.isPending}
                        data-testid={`button-share-${entry.id}`}
                      >
                        {entry.sharedToCommunity ? (
                          <>
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                            Helping Evi
                          </>
                        ) : (
                          <>
                            <Share2 className="h-3.5 w-3.5 mr-1" />
                            Help Evi Learn
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(entry.id)}
                        data-testid={`button-delete-${entry.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {entry.summary && (
                    <div className="text-sm text-foreground/90 line-clamp-4">
                      {entry.summary.substring(0, 300)}
                      {entry.summary.length > 300 && "..."}
                    </div>
                  )}

                  {entry.topicsLearned && entry.topicsLearned.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {entry.topicsLearned.slice(0, 5).map((topic, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {topic}
                        </Badge>
                      ))}
                      {entry.topicsLearned.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{entry.topicsLearned.length - 5} more
                        </Badge>
                      )}
                    </div>
                  )}

                  {entry.documentNames && entry.documentNames.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      <span>
                        Based on: {entry.documentNames.slice(0, 2).join(", ")}
                        {entry.documentNames.length > 2 && ` +${entry.documentNames.length - 2} more`}
                      </span>
                    </div>
                  )}

                  {entry.sources && entry.sources.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Web sources ({entry.sources.length})
                      </p>
                      <ScrollArea className="max-h-24">
                        <div className="space-y-1">
                          {entry.sources.slice(0, 3).map((source, i) => (
                            <a
                              key={i}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                              data-testid={`link-source-${entry.id}-${i}`}
                            >
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{source.title}</span>
                            </a>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!shareConfirmId} onOpenChange={() => setShareConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {shareConfirmAction ? <Sparkles className="h-5 w-5" /> : <Users className="h-5 w-5" />}
              {shareConfirmAction ? "Make Evi smarter?" : "Stop helping Evi?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {shareConfirmAction
                ? "This will help Evi handle difficult questions better by learning from your research. Your contribution is anonymous — your name won't be shown. Other students benefit when Evi gives smarter answers."
                : "Evi will no longer use this knowledge to help other students. Your learning stays in your personal knowledge base."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-share">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (shareConfirmId) {
                  shareMutation.mutate({ id: shareConfirmId, share: shareConfirmAction });
                }
                setShareConfirmId(null);
              }}
              data-testid="button-confirm-share"
            >
              {shareConfirmAction ? "Yes, Help Evi" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete learning entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this learning session from your history. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t sm:hidden z-10" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-sm font-medium"
          onClick={() => navigate("/full")}
          data-testid="button-back-mobile-learning"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    </div>
  );
}
