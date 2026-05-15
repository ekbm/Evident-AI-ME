import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, ThumbsUp, Sparkles, Database, FileText, MessageSquare, Loader2 } from "lucide-react";

interface RoadmapFeature {
  id: string;
  title: string;
  description: string;
  category: string | null;
  status: string | null;
  priority: number | null;
  voteCount: number | null;
  createdAt: string;
}

const categoryConfig: Record<string, { icon: typeof Sparkles; label: string; color: string }> = {
  collaboration: { icon: Sparkles, label: "Collaboration", color: "text-purple-500" },
  storage: { icon: Database, label: "Storage", color: "text-blue-500" },
  analysis: { icon: FileText, label: "Analysis", color: "text-green-500" },
  mobile: { icon: MessageSquare, label: "Mobile", color: "text-orange-500" },
  "file-types": { icon: FileText, label: "File Types", color: "text-cyan-500" },
};

export default function AdminRoadmapFeaturesPage() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newFeature, setNewFeature] = useState({
    title: "",
    description: "",
    category: "analysis",
    priority: 10,
  });

  const { data: features = [], isLoading, error } = useQuery<RoadmapFeature[]>({
    queryKey: ["/api/features"],
  });

  const createFeature = useMutation({
    mutationFn: async (feature: typeof newFeature) => {
      return apiRequest("POST", "/api/features", feature);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
      toast({ title: "Feature added to roadmap" });
      setShowAddDialog(false);
      setNewFeature({ title: "", description: "", category: "analysis", priority: 10 });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add feature", description: error.message, variant: "destructive" });
    },
  });

  const deleteFeature = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/features/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
      toast({ title: "Feature removed from roadmap" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete feature", description: error.message, variant: "destructive" });
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="button-workspace">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Workspace
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-semibold">Roadmap Features</h1>
                <p className="text-xs text-muted-foreground">
                  Manage features shown to users for voting
                </p>
              </div>
            </div>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-feature">
              <Plus className="h-4 w-4 mr-2" />
              Add Feature
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : features.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No roadmap features yet</p>
              <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-first">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Feature
              </Button>
            </CardContent>
          </Card>
        ) : (
          features.map((feature) => {
            const config = categoryConfig[feature.category || "analysis"] || categoryConfig.analysis;
            const Icon = config.icon;
            
            return (
              <Card key={feature.id} data-testid={`card-feature-${feature.id}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <span className="font-medium">{feature.title}</span>
                        <Badge variant="secondary" className="text-xs">
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {feature.voteCount || 0} votes
                        </span>
                        <span>Priority: {feature.priority}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteFeature.mutate(feature.id)}
                      disabled={deleteFeature.isPending}
                      data-testid={`button-delete-${feature.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Roadmap Feature</DialogTitle>
            <DialogDescription>
              Add a new feature to the roadmap that users can vote on
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Document Translation"
                value={newFeature.title}
                onChange={(e) => setNewFeature({ ...newFeature, title: e.target.value })}
                data-testid="input-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the feature..."
                value={newFeature.description}
                onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                data-testid="input-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newFeature.category}
                  onValueChange={(value) => setNewFeature({ ...newFeature, category: value })}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="collaboration">Collaboration</SelectItem>
                    <SelectItem value="storage">Storage</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="file-types">File Types</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority (1-10)</Label>
                <Input
                  id="priority"
                  type="number"
                  min={1}
                  max={10}
                  value={newFeature.priority}
                  onChange={(e) => setNewFeature({ ...newFeature, priority: parseInt(e.target.value) || 10 })}
                  data-testid="input-priority"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createFeature.mutate(newFeature)}
              disabled={!newFeature.title || !newFeature.description || createFeature.isPending}
              data-testid="button-save-feature"
            >
              {createFeature.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Feature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
