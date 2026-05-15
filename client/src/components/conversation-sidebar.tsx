import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquarePlus, 
  Bookmark, 
  BookmarkCheck, 
  Pencil, 
  Trash2, 
  Check, 
  X, 
  FileText,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Clock,
  Loader2,
  Search,
  MessageCircle,
  MessageSquare,
  Calendar,
  Download,
  Eye,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  isBookmarked: boolean;
  messageCount: number;
  documentIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  citations?: Array<{ documentName: string; excerpt: string; pageNumber?: number }>;
  simplifiedContent?: string;
  externalInsights?: { content: string; citations: Array<{ title: string; url: string; snippet?: string }> };
}

interface SavedAnswer {
  id: string;
  question: string;
  answer: string;
  title: string | null;
  assetIds: string[] | null;
  createdAt: string;
}

interface ConversationSidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  onNewConversation: () => void;
  isAuthenticated: boolean;
}

export function ConversationSidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  isAuthenticated,
}: ConversationSidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [viewingConversation, setViewingConversation] = useState<Conversation | null>(null);
  const [threadDialogOpen, setThreadDialogOpen] = useState(false);
  const [viewingSavedAnswer, setViewingSavedAnswer] = useState<SavedAnswer | null>(null);
  const [savedAnswerDialogOpen, setSavedAnswerDialogOpen] = useState(false);

  const { data: conversationsData, isLoading } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ["/api/conversations"],
    enabled: isAuthenticated,
  });

  const { data: savedAnswers = [], isLoading: savedAnswersLoading } = useQuery<SavedAnswer[]>({
    queryKey: ["/api/bookmarks"],
    enabled: isAuthenticated,
  });

  const conversations = conversationsData?.conversations || [];

  const filteredConversations = useMemo(() => {
    let result = conversations;
    if (savedOnly) {
      result = result.filter(c => c.isBookmarked);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.title.toLowerCase().includes(q));
    }
    return result;
  }, [conversations, searchQuery, savedOnly]);

  const bookmarkedConversations = filteredConversations.filter(c => c.isBookmarked);
  const recentConversations = filteredConversations.filter(c => !c.isBookmarked);

  const { data: threadDetail, isLoading: threadMessagesLoading } = useQuery<{
    messages: ConversationMessage[];
    existingDocuments: { id: string; filename: string }[];
    missingDocuments: string[];
  }>({
    queryKey: ["/api/conversations", viewingConversation?.id],
    queryFn: async () => {
      if (!viewingConversation) return { messages: [], existingDocuments: [], missingDocuments: [] };
      const res = await fetch(`/api/conversations/${viewingConversation.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: isAuthenticated && !!viewingConversation && threadDialogOpen,
  });

  const threadMessages = threadDetail?.messages || [];
  const threadDocuments: { id: string; filename: string }[] = (threadDetail?.existingDocuments || []).map((doc: any) =>
    typeof doc === 'string' ? { id: doc, filename: doc } : doc
  );
  const threadMissingDocs = threadDetail?.missingDocuments || [];

  const handleViewThread = (conv: Conversation) => {
    setViewingConversation(conv);
    setThreadDialogOpen(true);
  };

  const deleteThreadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/conversations/${id}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Deleted", description: "Thread deleted permanently" });
      setThreadDialogOpen(false);
      setViewingConversation(null);
      if (currentConversationId === deletedId) {
        onSelectConversation(null);
      }
    },
  });

  const deleteSavedAnswerMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/bookmarks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({ title: "Deleted", description: "Saved answer removed" });
      setSavedAnswerDialogOpen(false);
      setViewingSavedAnswer(null);
    },
  });

  const handleExportSavedAnswer = (answer: SavedAnswer) => {
    const content = `SAVED ANSWER\n================\n\nQuestion:\n${answer.question}\n\nAnswer:\n${answer.answer}\n\nSaved: ${formatFullDate(answer.createdAt)}\n`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saved-answer-${new Date(answer.createdAt).toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Saved answer exported to file" });
  };

  const handleExportThread = () => {
    if (!viewingConversation || threadMessages.length === 0) return;
    let content = `EVIDENT THREAD\n================\nTitle: ${viewingConversation.title}\nCreated: ${formatFullDate(viewingConversation.createdAt)}\nMessages: ${threadMessages.length}\n\n================\n`;
    threadMessages.forEach((msg) => {
      const role = msg.role === "user" ? "YOU" : "EVIDENT";
      content += `\n[${role}]\n${msg.content}\n`;
      if (msg.citations && msg.citations.length > 0) {
        content += `\nReferences:\n`;
        msg.citations.forEach((cit) => {
          content += `- ${cit.documentName}${cit.pageNumber ? ` (p.${cit.pageNumber})` : ""}\n`;
        });
      }
      content += `\n----------------\n`;
    });
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thread-${new Date(viewingConversation.createdAt).toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Thread saved to file" });
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, isBookmarked }: { id: string; title?: string; isBookmarked?: boolean }) => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, isBookmarked }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update conversation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/conversations/${id}`, { 
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete conversation");
      return res.json();
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (currentConversationId === deletedId) {
        onSelectConversation(null);
      }
    },
  });

  const handleStartEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      updateMutation.mutate({ id, title: editTitle.trim() });
    }
    setEditingId(null);
  };

  const handleToggleBookmark = (conv: Conversation) => {
    updateMutation.mutate({ id: conv.id, isBookmarked: !conv.isBookmarked });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  };

  if (!isAuthenticated) {
    return null;
  }

  const ConversationItem = ({ conv }: { conv: Conversation }) => {
    const isEditing = editingId === conv.id;
    const isSelected = currentConversationId === conv.id;

    return (
      <div
        className={cn(
          "group flex flex-col gap-1 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
          isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/60"
        )}
        onClick={() => !isEditing && handleViewThread(conv)}
        data-testid={`conversation-item-${conv.id}`}
      >
        {isEditing ? (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <Input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter") handleSaveEdit(conv.id);
                if (e.key === "Escape") setEditingId(null);
              }}
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSaveEdit(conv.id)}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">{conv.title}</p>
              <Eye className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(conv.updatedAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <div>Created: {formatFullDate(conv.createdAt)}</div>
                    <div>Updated: {formatFullDate(conv.updatedAt)}</div>
                  </TooltipContent>
                </Tooltip>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {conv.messageCount || 0}
                </span>
                {conv.documentIds?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {conv.documentIds.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={e => { e.stopPropagation(); handleToggleBookmark(conv); }}
                      data-testid={`bookmark-conversation-${conv.id}`}
                    >
                      {conv.isBookmarked ? (
                        <BookmarkCheck className="h-3 w-3 text-primary" />
                      ) : (
                        <Bookmark className="h-3 w-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{conv.isBookmarked ? "Remove bookmark" : "Bookmark"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={e => { e.stopPropagation(); handleStartEdit(conv); }}
                      data-testid={`rename-conversation-${conv.id}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Rename</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); deleteMutation.mutate(conv.id); }}
                      data-testid={`delete-conversation-${conv.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
    <div className="flex flex-col h-full bg-card/50">
      <div className="p-3 space-y-2 border-b">
        <Button
          onClick={onNewConversation}
          className="w-full gap-2"
          variant="outline"
          data-testid="button-new-conversation"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Conversation
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search threads..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
            data-testid="input-search-threads"
          />
          {searchQuery && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <span>
            {savedOnly
              ? `${savedAnswers.length} saved answer${savedAnswers.length !== 1 ? 's' : ''}${bookmarkedConversations.length > 0 ? `, ${bookmarkedConversations.length} pinned` : ''}`
              : conversations.length > 0
                ? `${filteredConversations.length} thread${filteredConversations.length !== 1 ? 's' : ''}${searchQuery ? ' matching' : ''}`
                : 'No threads yet'}
          </span>
          <button
            onClick={() => setSavedOnly(!savedOnly)}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors",
              savedOnly
                ? "bg-primary/15 text-primary"
                : "hover:bg-muted text-muted-foreground"
            )}
            data-testid="toggle-saved-only"
          >
            {savedOnly ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
            {savedOnly ? "Saved Only" : "All"}
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {savedOnly ? (
            <>
              {savedAnswersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {savedAnswers.length > 0 && (
                    <Collapsible defaultOpen>
                      <div className="rounded-lg border border-primary/15 bg-primary/5 overflow-hidden mb-2">
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-2 w-full px-2.5 py-2 text-left group hover:bg-primary/10 transition-colors">
                            <BookmarkCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                            <h3 className="text-[11px] font-semibold text-primary uppercase tracking-wider flex-1">
                              Saved Answers ({savedAnswers.length})
                            </h3>
                            <ChevronDown className="h-3.5 w-3.5 text-primary/60 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-0.5 px-1 pb-1.5">
                            {(searchQuery ? savedAnswers.filter(a => a.question.toLowerCase().includes(searchQuery.toLowerCase()) || a.answer.toLowerCase().includes(searchQuery.toLowerCase())) : savedAnswers).map(answer => (
                              <div
                                key={answer.id}
                                className="group flex flex-col gap-1 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-muted/60"
                                onClick={() => { setViewingSavedAnswer(answer); setSavedAnswerDialogOpen(true); }}
                                data-testid={`saved-answer-${answer.id}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">{answer.question}</p>
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDate(answer.createdAt)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <BookmarkCheck className="h-3 w-3 text-primary" />
                                    Saved
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )}

                  {bookmarkedConversations.length > 0 && (
                    <Collapsible defaultOpen>
                      <div className="rounded-lg border border-primary/15 bg-primary/5 overflow-hidden mb-2">
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-2 w-full px-2.5 py-2 text-left group hover:bg-primary/10 transition-colors">
                            <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                            <h3 className="text-[11px] font-semibold text-primary uppercase tracking-wider flex-1">
                              Pinned Threads ({bookmarkedConversations.length})
                            </h3>
                            <ChevronDown className="h-3.5 w-3.5 text-primary/60 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-0.5 px-1 pb-1.5">
                            {bookmarkedConversations.map(conv => (
                              <ConversationItem key={conv.id} conv={conv} />
                            ))}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )}

                  {savedAnswers.length === 0 && bookmarkedConversations.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No saved items yet</p>
                      <p className="text-xs mt-1">Save answers or bookmark threads to see them here</p>
                    </div>
                  )}
                </>
              )}
            </>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? (
                <>
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No threads matching "{searchQuery}"</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </>
              ) : (
                <>
                  <MessageSquarePlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No conversations yet</p>
                  <p className="text-xs mt-1">Start asking questions to create one</p>
                </>
              )}
            </div>
          ) : (
            <>
              {bookmarkedConversations.length > 0 && (
                <Collapsible defaultOpen>
                  <div className="rounded-lg border border-primary/15 bg-primary/5 overflow-hidden mb-2">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 w-full px-2.5 py-2 text-left group hover:bg-primary/10 transition-colors">
                        <BookmarkCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                        <h3 className="text-[11px] font-semibold text-primary uppercase tracking-wider flex-1">
                          Saved ({bookmarkedConversations.length})
                        </h3>
                        <ChevronDown className="h-3.5 w-3.5 text-primary/60 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-0.5 px-1 pb-1.5">
                        {bookmarkedConversations.map(conv => (
                          <ConversationItem key={conv.id} conv={conv} />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

              {recentConversations.length > 0 && (
                <Collapsible defaultOpen>
                  <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 w-full px-2.5 py-2 text-left group hover:bg-muted/60 transition-colors">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">
                          Recent ({recentConversations.length})
                        </h3>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-0.5 px-1 pb-1.5">
                        {recentConversations.map(conv => (
                          <ConversationItem key={conv.id} conv={conv} />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>

    <Dialog open={threadDialogOpen} onOpenChange={setThreadDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <span className="text-base font-semibold line-clamp-1">
              {viewingConversation?.title || "Thread"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {(threadDocuments.length > 0 || threadMissingDocs.length > 0) && (
          <div className="px-1 pb-2 border-b">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Documents used
            </p>
            <div className="flex flex-wrap gap-1.5">
              {threadDocuments.map(doc => (
                <span
                  key={doc.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-[11px] text-primary font-medium"
                  data-testid={`thread-doc-${doc.id}`}
                >
                  <FileText className="w-2.5 h-2.5" />
                  {(doc.filename || 'Unknown').length > 25 ? (doc.filename || 'Unknown').slice(0, 25) + '...' : (doc.filename || 'Unknown')}
                </span>
              ))}
              {threadMissingDocs.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {threadMissingDocs.length} deleted
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto max-h-[55vh] my-3">
          {threadMessagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : threadMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No messages in this thread</p>
          ) : (
            <div className="space-y-4 pr-2">
              {threadMessages.map((msg, idx) => (
                <div key={msg.id || idx} className={`${msg.role === "user" ? "ml-4" : "mr-4"}`}>
                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                    {msg.role === "user" ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        You
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        Evident
                      </>
                    )}
                  </p>
                  <div className={`text-sm p-3 rounded-md whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-muted/30"
                  }`}>
                    {msg.content}
                  </div>

                  {msg.role === "assistant" && (
                    <div className="mt-2 space-y-2">
                      {msg.simplifiedContent && (
                        <div className="p-2.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                          <p className="text-xs font-medium text-blue-500 dark:text-blue-400 mb-1">Simplified</p>
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{msg.simplifiedContent}</p>
                        </div>
                      )}

                      {msg.externalInsights && (
                        <div className="p-2.5 rounded-md bg-purple-500/10 border border-purple-500/20">
                          <p className="text-xs font-medium text-purple-500 dark:text-purple-400 mb-1">External Insights</p>
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{msg.externalInsights.content}</p>
                          {msg.externalInsights.citations?.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-purple-500/20">
                              <p className="text-xs text-purple-500 dark:text-purple-400 mb-1">Sources:</p>
                              {msg.externalInsights.citations.map((c, i) => (
                                <a
                                  key={i}
                                  href={c.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-purple-400 hover:underline block truncate"
                                >
                                  {c.title || c.url}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {msg.citations && msg.citations.length > 0 && (
                        <div className="p-2.5 rounded-md bg-primary/10 border border-primary/20">
                          <p className="text-xs font-medium text-primary mb-1">Reference Documents</p>
                          {msg.citations.slice(0, 3).map((cit, i) => (
                            <div key={i} className="text-xs text-foreground/80 mb-1">
                              <span className="font-medium">{cit.documentName}</span>
                              {cit.pageNumber && <span className="text-muted-foreground"> (p.{cit.pageNumber})</span>}
                            </div>
                          ))}
                          {msg.citations.length > 3 && (
                            <p className="text-xs text-muted-foreground">+{msg.citations.length - 3} more</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewingConversation?.isBookmarked ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (viewingConversation) {
                    updateMutation.mutate({ id: viewingConversation.id, isBookmarked: !viewingConversation.isBookmarked });
                    setViewingConversation({ ...viewingConversation, isBookmarked: !viewingConversation.isBookmarked });
                  }
                }}
                data-testid="button-bookmark-thread-dialog"
              >
                {viewingConversation?.isBookmarked ? (
                  <BookmarkCheck className="w-4 h-4 mr-1.5" />
                ) : (
                  <Bookmark className="w-4 h-4 mr-1.5" />
                )}
                {viewingConversation?.isBookmarked ? "Saved" : "Save"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>{viewingConversation?.isBookmarked ? "Remove bookmark" : "Bookmark this thread"}</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportThread}
                disabled={threadMessages.length === 0}
                data-testid="button-export-thread-dialog"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Download
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Export to file</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  if (viewingConversation) {
                    onSelectConversation(viewingConversation.id);
                    setThreadDialogOpen(false);
                  }
                }}
                data-testid="button-continue-chat-thread"
              >
                <MessageSquare className="w-4 h-4 mr-1.5" />
                Continue Chat
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Load this thread into chat and continue the conversation</p></TooltipContent>
          </Tooltip>
          <Button variant="outline" size="sm" onClick={() => setThreadDialogOpen(false)}>
            Close
          </Button>
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => viewingConversation && deleteThreadMutation.mutate(viewingConversation.id)}
                disabled={deleteThreadMutation.isPending}
                data-testid="button-delete-thread-dialog"
              >
                {deleteThreadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Delete thread</p></TooltipContent>
          </Tooltip>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={savedAnswerDialogOpen} onOpenChange={setSavedAnswerDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <BookmarkCheck className="w-5 h-5 text-primary" />
            <span className="text-base font-semibold">Saved Answer</span>
          </DialogTitle>
        </DialogHeader>

        {viewingSavedAnswer && (
          <div className="flex-1 overflow-y-auto max-h-[55vh] my-3">
            <div className="space-y-4 pr-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Question</p>
                <p className="text-sm bg-primary/10 border border-primary/20 p-3 rounded-md">
                  {viewingSavedAnswer.question}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Answer</p>
                <div className="text-sm bg-muted/30 p-3 rounded-md whitespace-pre-wrap">
                  {viewingSavedAnswer.answer}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Saved {formatFullDate(viewingSavedAnswer.createdAt)}
              </p>
            </div>
          </div>
        )}

        <div className="pt-3 border-t flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => viewingSavedAnswer && handleExportSavedAnswer(viewingSavedAnswer)}
                data-testid="button-export-saved-answer"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Download
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Export to file</p></TooltipContent>
          </Tooltip>
          <Button variant="outline" size="sm" onClick={() => setSavedAnswerDialogOpen(false)}>
            Close
          </Button>
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => viewingSavedAnswer && deleteSavedAnswerMutation.mutate(viewingSavedAnswer.id)}
                disabled={deleteSavedAnswerMutation.isPending}
                data-testid="button-delete-saved-answer"
              >
                {deleteSavedAnswerMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Delete saved answer</p></TooltipContent>
          </Tooltip>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
