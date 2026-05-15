import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Trash2, MessageSquare, ChevronRight, ChevronDown, Loader2, Download, MessageCircle, Bookmark, Clock, FileText, Search, X, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePanelState } from "@/hooks/use-panel-state";

interface Bookmark {
  id: string;
  question: string;
  answer: string;
  title: string | null;
  assetIds: string[] | null;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  isBookmarked: boolean;
  messageCount: number;
  documentIds: string[];
  createdAt: string;
  updatedAt: string;
  firstQuestion: string | null;
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

interface BookmarksPanelProps {
  onSelectBookmark?: (bookmark: Bookmark) => void;
  onSelectConversation?: (conversationId: string) => void;
}

export function BookmarksPanel({ onSelectBookmark, onSelectConversation }: BookmarksPanelProps) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { isExpanded, toggle } = usePanelState("bookmarks");
  const queryClient = useQueryClient();
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationDialogOpen, setConversationDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"saved" | "conversations">("saved");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const { data: bookmarks = [], isLoading: bookmarksLoading } = useQuery<Bookmark[]>({
    queryKey: ["/api/bookmarks"],
    enabled: isAuthenticated,
  });

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ["/api/conversations"],
    enabled: isAuthenticated,
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations/search", searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: isAuthenticated && searchQuery.length >= 2,
  });

  const conversations = conversationsData?.conversations || [];
  const recentConversations = conversations.slice(0, 12);
  const displayedConversations = searchQuery.length >= 2 ? searchResults : recentConversations;

  const { data: conversationDetail, isLoading: messagesLoading } = useQuery<{ messages: ConversationMessage[] }>({
    queryKey: ["/api/conversations", selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return { messages: [] };
      const res = await fetch(`/api/conversations/${selectedConversation.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: isAuthenticated && !!selectedConversation && conversationDialogOpen,
  });
  
  const conversationMessages = conversationDetail?.messages || [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/bookmarks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({
        title: "Deleted",
        description: "Bookmark removed",
      });
      setDialogOpen(false);
      setSelectedBookmark(null);
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Deleted",
        description: "Thread deleted permanently",
      });
      setConversationDialogOpen(false);
      setSelectedConversation(null);
    },
  });

  const handleBookmarkClick = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    setDialogOpen(true);
  };

  const handleConversationClick = (conv: Conversation) => {
    setSelectedConversation(conv);
    setConversationDialogOpen(true);
  };

  const handleExport = (bookmark: Bookmark) => {
    const content = `SAVED ANSWER
================

Question:
${bookmark.question}

Answer:
${bookmark.answer}

Saved: ${formatDate(bookmark.createdAt)}
`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookmark-${new Date(bookmark.createdAt).toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Exported",
      description: "Bookmark saved to file",
    });
  };

  const handleExportConversation = () => {
    if (!selectedConversation || conversationMessages.length === 0) return;
    
    let content = `EVIDENT THREAD
================
Title: ${selectedConversation.title}
Created: ${formatDate(selectedConversation.createdAt)}
Messages: ${conversationMessages.length}

================
`;
    
    conversationMessages.forEach((msg, idx) => {
      const role = msg.role === "user" ? "YOU" : "EVIDENT";
      content += `\n[${role}]\n${msg.content}\n`;
      if (msg.citations && msg.citations.length > 0) {
        content += `\nReferences:\n`;
        msg.citations.forEach((cit, i) => {
          content += `- ${cit.documentName}${cit.pageNumber ? ` (p.${cit.pageNumber})` : ""}\n`;
        });
      }
      content += `\n----------------\n`;
    });
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thread-${new Date(selectedConversation.createdAt).toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Exported",
      description: "Thread saved to file",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    
    if (diffDays === 0) return `Today ${timeStr}`;
    if (diffDays === 1) return `Yesterday ${timeStr}`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    const trimmed = text.substring(0, maxLength);
    const lastSpace = trimmed.lastIndexOf(" ");
    return (lastSpace > 10 ? trimmed.substring(0, lastSpace) : trimmed).trim() + "...";
  };

  const isLoading = bookmarksLoading || conversationsLoading;
  const totalCount = bookmarks.length + conversations.length;

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 border-slate-700">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-800/30 transition-colors rounded-lg"
          onClick={toggle}
        >
          <h3 className="text-sm font-medium flex items-center gap-2 text-white">
            <MessageCircle className="w-4 h-4 text-cyan-400" />
            Evident Threads
          </h3>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
        {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          </div>
        </CardContent>
        )}
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 border-slate-700" data-testid="bookmarks-panel">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-800/30 transition-colors rounded-t-lg"
          onClick={toggle}
        >
          <h3 className="text-sm font-medium flex items-center gap-2 text-white">
            <MessageCircle className="w-4 h-4 text-cyan-400" />
            Evident Threads
            {totalCount > 0 && (
              <span className="text-[10px] text-slate-400 ml-2">
                {totalCount}
              </span>
            )}
          </h3>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
        {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4">
          <div
            className="flex items-start gap-2 px-2.5 py-2 mb-2 rounded-md bg-cyan-500/10 border border-cyan-500/20"
            data-testid="threads-tip"
          >
            <Info className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-300 leading-snug">
              Threads keep your past chats with Evi so you can revisit answers and continue the conversation. Star a reply to keep it under <span className="font-medium text-white">Saved</span>.
            </p>
          </div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "saved" | "conversations")} className="w-full">
            <TabsList className="w-full h-7 bg-slate-800/50 p-0.5 mb-2">
              <TabsTrigger 
                value="saved" 
                className="flex-1 h-6 text-[10px] data-[state=active]:bg-slate-700 data-[state=active]:text-white gap-1"
                data-testid="tab-saved-answers"
              >
                <Star className="w-3 h-3" />
                Saved ({bookmarks.length})
              </TabsTrigger>
              <TabsTrigger 
                value="conversations" 
                className="flex-1 h-6 text-[10px] data-[state=active]:bg-slate-700 data-[state=active]:text-white gap-1"
                data-testid="tab-conversations"
              >
                <MessageSquare className="w-3 h-3" />
                Threads ({conversations.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="saved" className="mt-0">
              {bookmarks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">
                  Star answers to save them here
                </p>
              ) : (
                <ScrollArea className="h-[220px]">
                  <div className="space-y-1 pr-2">
                    {bookmarks.slice(0, 15).map((bookmark) => (
                      <Tooltip key={bookmark.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleBookmarkClick(bookmark)}
                            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-700/50 bg-slate-800/30 transition-colors group min-w-0"
                            data-testid={`bookmark-item-${bookmark.id}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Star className="w-3 h-3 text-amber-400 shrink-0" />
                              <p className="text-xs font-medium flex-1 min-w-0 text-white overflow-hidden whitespace-nowrap">
                                {truncateText(bookmark.title || bookmark.question, 30)}
                              </p>
                              <span className="text-[9px] text-slate-500 shrink-0 flex items-center gap-0.5">
                                <Clock className="w-2 h-2" />
                                {formatRelativeDate(bookmark.createdAt).split(' ')[0]}
                              </span>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="max-w-xs bg-slate-800 border-slate-600 p-3">
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-white">{bookmark.title || "Saved Answer"}</p>
                            <p className="text-[10px] text-slate-300 italic">
                              "{bookmark.question.length > 100 ? bookmark.question.slice(0, 100) + '...' : bookmark.question}"
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {bookmark.answer.length > 100 ? bookmark.answer.slice(0, 100) + '...' : bookmark.answer}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Saved {formatRelativeDate(bookmark.createdAt)}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="conversations" className="mt-0">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                <Input
                  placeholder="Search threads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-6 pl-7 pr-7 text-xs bg-slate-800/50 border-slate-600 placeholder:text-slate-500"
                  data-testid="input-search-conversations"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                    data-testid="button-clear-search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {searchLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              ) : displayedConversations.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">
                  {searchQuery.length >= 2 ? "No matching threads" : "Ask questions to start a thread"}
                </p>
              ) : (
                <ScrollArea className="h-[190px]">
                  <div className="space-y-1 pr-2">
                    {displayedConversations.map((conv) => (
                      <Tooltip key={conv.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleConversationClick(conv)}
                            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-700/50 bg-slate-800/30 transition-colors group min-w-0"
                            data-testid={`conversation-item-${conv.id}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {conv.isBookmarked ? (
                                <Bookmark className="w-3 h-3 text-cyan-400 shrink-0" />
                              ) : (
                                <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                              )}
                              <p className="text-xs font-medium flex-1 min-w-0 text-white overflow-hidden whitespace-nowrap">
                                {truncateText(conv.title, 30)}
                              </p>
                              <span className="text-[9px] text-slate-500 shrink-0 flex items-center gap-0.5">
                                <Clock className="w-2 h-2" />
                                {formatRelativeDate(conv.updatedAt).split(' ')[0]}
                              </span>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="max-w-xs bg-slate-800 border-slate-600 p-3">
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-white">{conv.title}</p>
                            {conv.firstQuestion && (
                              <p className="text-[10px] text-slate-300 italic">
                                "{conv.firstQuestion.length > 100 ? conv.firstQuestion.slice(0, 100) + '...' : conv.firstQuestion}"
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {conv.messageCount} messages
                              </span>
                              {conv.documentIds?.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {conv.documentIds.length} docs
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500">
                              Updated {formatRelativeDate(conv.updatedAt)}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              <span className="text-base font-semibold">Saved Answer</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedBookmark && (
            <div className="flex-1 overflow-y-auto max-h-[55vh] my-3">
              <div className="space-y-4 pr-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Question</p>
                  <p className="text-sm bg-muted/30 p-3 rounded-md">
                    {selectedBookmark.question}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Answer</p>
                  <div className="text-sm bg-muted/30 p-3 rounded-md whitespace-pre-wrap">
                    {selectedBookmark.answer}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Saved {formatDate(selectedBookmark.createdAt)}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t gap-2 sm:gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => selectedBookmark && deleteMutation.mutate(selectedBookmark.id)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-bookmark"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Delete bookmark</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedBookmark && handleExport(selectedBookmark)}
                  data-testid="button-export-bookmark"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Save
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Export to file</p></TooltipContent>
            </Tooltip>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conversationDialogOpen} onOpenChange={setConversationDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-500" />
              <span className="text-base font-semibold line-clamp-1">
                {selectedConversation?.title || "Thread"}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto max-h-[55vh] my-3">
            {messagesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : conversationMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No messages in this thread</p>
            ) : (
              <div className="space-y-4 pr-2">
                {conversationMessages.map((msg, idx) => (
                  <div key={msg.id || idx} className={`${msg.role === "user" ? "ml-4" : "mr-4"}`}>
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                      {msg.role === "user" ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                          You
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Evident
                        </>
                      )}
                    </p>
                    <div className={`text-sm p-3 rounded-md whitespace-pre-wrap ${
                      msg.role === "user" 
                        ? "bg-cyan-500/10 border border-cyan-500/20" 
                        : "bg-muted/30"
                    }`}>
                      {msg.content}
                    </div>
                    
                    {/* Show enrichments for assistant messages */}
                    {msg.role === "assistant" && (
                      <div className="mt-2 space-y-2">
                        {/* Simplified Answer */}
                        {msg.simplifiedContent && (
                          <div className="p-2.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                            <p className="text-xs font-medium text-blue-400 mb-1 flex items-center gap-1">
                              <span className="text-blue-400">Simplified</span>
                            </p>
                            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{msg.simplifiedContent}</p>
                          </div>
                        )}
                        
                        {/* External Insights */}
                        {msg.externalInsights && (
                          <div className="p-2.5 rounded-md bg-purple-500/10 border border-purple-500/20">
                            <p className="text-xs font-medium text-purple-400 mb-1">External Insights</p>
                            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{msg.externalInsights.content}</p>
                            {msg.externalInsights.citations?.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-purple-500/20">
                                <p className="text-xs text-purple-400 mb-1">Sources:</p>
                                {msg.externalInsights.citations.map((c, i) => (
                                  <a 
                                    key={i} 
                                    href={c.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-purple-300 hover:underline block truncate"
                                  >
                                    {c.title || c.url}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Reference Documents (Citations) */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="p-2.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">
                            <p className="text-xs font-medium text-cyan-400 mb-1">Reference Documents</p>
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

          <DialogFooter className="pt-3 border-t gap-2 sm:gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => selectedConversation && deleteConversationMutation.mutate(selectedConversation.id)}
                  disabled={deleteConversationMutation.isPending}
                  data-testid="button-delete-thread"
                >
                  {deleteConversationMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Delete thread</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportConversation}
                  disabled={conversationMessages.length === 0}
                  data-testid="button-export-thread"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Save
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Export to file</p></TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" onClick={() => setConversationDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
