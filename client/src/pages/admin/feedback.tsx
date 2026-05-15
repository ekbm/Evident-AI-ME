import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Bug, Lightbulb, HelpCircle, Mail, Clock, Globe, User, Reply, Send } from "lucide-react";
import { format } from "date-fns";

interface Feedback {
  id: string;
  type: "BUG" | "FEATURE" | "OTHER";
  message: string;
  email: string | null;
  userId: string | null;
  userAgent: string | null;
  pageUrl: string | null;
  status: "NEW" | "REVIEWED" | "RESOLVED";
  createdAt: string;
}

const typeConfig = {
  BUG: { icon: Bug, label: "Bug Report", variant: "destructive" as const },
  FEATURE: { icon: Lightbulb, label: "Feature Request", variant: "default" as const },
  OTHER: { icon: HelpCircle, label: "Other", variant: "secondary" as const },
};

const statusConfig = {
  NEW: { label: "New", variant: "default" as const },
  REVIEWED: { label: "Reviewed", variant: "secondary" as const },
  RESOLVED: { label: "Resolved", variant: "outline" as const },
};

export default function AdminFeedbackPage() {
  const { toast } = useToast();
  const [replyTarget, setReplyTarget] = useState<Feedback | null>(null);
  const [replyMessage, setReplyMessage] = useState("");

  const { data: feedbackList = [], isLoading, error } = useQuery<Feedback[]>({
    queryKey: ["/api/feedback"],
  });

  const sendReply = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      return apiRequest("POST", `/api/feedback/${id}/reply`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      toast({ title: "Reply sent", description: `Email delivered to ${replyTarget?.email}` });
      setReplyTarget(null);
      setReplyMessage("");
    },
    onError: (err: any) => {
      toast({ title: "Reply failed", description: err?.message || "Could not send the email", variant: "destructive" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/feedback/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      toast({ title: "Status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">
              You don't have permission to access this page.
            </p>
            <Link href="/">
              <Button data-testid="button-go-home">Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = {
    total: feedbackList.length,
    new: feedbackList.filter((f) => f.status === "NEW").length,
    bugs: feedbackList.filter((f) => f.type === "BUG").length,
    features: feedbackList.filter((f) => f.type === "FEATURE").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="self-start" data-testid="button-workspace">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Workspace
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">Feedback Management</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Review user bug reports and feature requests
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold" data-testid="text-total-feedback">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Feedback</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600" data-testid="text-new-feedback">{stats.new}</div>
              <div className="text-sm text-muted-foreground">New / Unreviewed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600" data-testid="text-bugs">{stats.bugs}</div>
              <div className="text-sm text-muted-foreground">Bug Reports</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600" data-testid="text-features">{stats.features}</div>
              <div className="text-sm text-muted-foreground">Feature Requests</div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading feedback...</div>
        ) : feedbackList.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No feedback submitted yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {feedbackList.map((feedback) => {
              const TypeIcon = typeConfig[feedback.type].icon;
              return (
                <Card key={feedback.id} data-testid={`card-feedback-${feedback.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={typeConfig[feedback.type].variant}>
                          <TypeIcon className="h-3 w-3 mr-1" />
                          {typeConfig[feedback.type].label}
                        </Badge>
                        <Badge variant={statusConfig[feedback.status].variant}>
                          {statusConfig[feedback.status].label}
                        </Badge>
                      </div>
                      <Select
                        value={feedback.status}
                        onValueChange={(status) =>
                          updateStatus.mutate({ id: feedback.id, status })
                        }
                      >
                        <SelectTrigger className="w-32" data-testid={`select-status-${feedback.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEW">New</SelectItem>
                          <SelectItem value="REVIEWED">Reviewed</SelectItem>
                          <SelectItem value="RESOLVED">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="whitespace-pre-wrap" data-testid={`text-message-${feedback.id}`}>
                      {feedback.message}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(feedback.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                      {feedback.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span data-testid={`text-email-${feedback.id}`}>{feedback.email}</span>
                        </div>
                      )}
                      {feedback.userId && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {feedback.userId.slice(0, 8)}...
                        </div>
                      )}
                      {feedback.pageUrl && (
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {feedback.pageUrl}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end pt-2 border-t">
                      <Button
                        size="sm"
                        variant={feedback.email ? "default" : "outline"}
                        disabled={!feedback.email}
                        onClick={() => {
                          setReplyTarget(feedback);
                          setReplyMessage("");
                        }}
                        data-testid={`button-reply-${feedback.id}`}
                      >
                        <Reply className="h-3.5 w-3.5 mr-1.5" />
                        {feedback.email ? "Reply by email" : "No email to reply to"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={!!replyTarget} onOpenChange={(open) => { if (!open) { setReplyTarget(null); setReplyMessage(""); } }}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-feedback-reply">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Reply className="h-4 w-4" />
              Reply to {replyTarget?.email}
            </DialogTitle>
            <DialogDescription>
              Your reply will be emailed to the user from feedback@evident-ai.net. They can reply directly to that address.
            </DialogDescription>
          </DialogHeader>

          {replyTarget && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm max-h-32 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground mb-1">Original message:</p>
              <p className="whitespace-pre-wrap">{replyTarget.message}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Your reply</label>
            <Textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Hi, thanks for reaching out..."
              rows={8}
              className="resize-none"
              data-testid="input-reply-message"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setReplyTarget(null); setReplyMessage(""); }}
              data-testid="button-cancel-reply"
            >
              Cancel
            </Button>
            <Button
              onClick={() => replyTarget && sendReply.mutate({ id: replyTarget.id, message: replyMessage })}
              disabled={sendReply.isPending || !replyMessage.trim()}
              data-testid="button-send-reply"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {sendReply.isPending ? "Sending..." : "Send reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
