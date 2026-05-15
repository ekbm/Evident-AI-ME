import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ThumbsUp, Loader2, Sparkles, Database, FileText, Receipt, FileCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Feature {
  id: string;
  title: string;
  description: string;
  category: string | null;
  status: string | null;
  voteCount: number | null;
  hasVoted: boolean;
}

interface FeatureVotingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryIcons: Record<string, typeof Sparkles> = {
  collaboration: Sparkles,
  storage: Database,
  analysis: FileText,
};

const categoryColors: Record<string, string> = {
  collaboration: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  storage: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  analysis: "bg-green-500/10 text-green-600 dark:text-green-400",
};

export function FeatureVotingModal({ open, onOpenChange }: FeatureVotingModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [votingId, setVotingId] = useState<string | null>(null);

  const { data: features = [], isLoading } = useQuery<Feature[]>({
    queryKey: ["/api/features"],
    enabled: open,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ featureId, action }: { featureId: string; action: "vote" | "unvote" }) => {
      if (action === "vote") {
        return apiRequest("POST", `/api/features/${featureId}/vote`);
      } else {
        return apiRequest("DELETE", `/api/features/${featureId}/vote`);
      }
    },
    onMutate: ({ featureId }) => {
      setVotingId(featureId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
      toast({
        title: "Vote recorded",
        description: "Thank you for your feedback!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record vote",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setVotingId(null);
    },
  });

  const handleVote = (feature: Feature) => {
    voteMutation.mutate({
      featureId: feature.id,
      action: feature.hasVoted ? "unvote" : "vote",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Feature Roadmap
          </DialogTitle>
          <DialogDescription>
            Vote for the features you'd like to see next. Your feedback helps us prioritize our development.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : features.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No features to vote on yet. Check back soon!
            </div>
          ) : (
            features.map((feature) => {
              const IconComponent = categoryIcons[feature.category || ""] || FileText;
              const colorClass = categoryColors[feature.category || ""] || "bg-muted text-muted-foreground";
              const isVoting = votingId === feature.id;

              return (
                <Card key={feature.id} className="hover-elevate transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{feature.title}</h3>
                          {feature.category && (
                            <Badge variant="secondary" className="text-xs capitalize">
                              {feature.category}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {feature.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          variant={feature.hasVoted ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleVote(feature)}
                          disabled={isVoting}
                          className="min-w-[80px]"
                          data-testid={`button-vote-${feature.id}`}
                        >
                          {isVoting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <ThumbsUp className={`h-4 w-4 mr-1 ${feature.hasVoted ? "fill-current" : ""}`} />
                              {feature.hasVoted ? "Voted" : "Vote"}
                            </>
                          )}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {feature.voteCount || 0} {(feature.voteCount || 0) === 1 ? "vote" : "votes"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
          Have a feature idea? Contact us at support@evident-ai.net
        </div>
      </DialogContent>
    </Dialog>
  );
}
