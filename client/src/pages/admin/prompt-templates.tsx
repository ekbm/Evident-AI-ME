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
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  BookOpen,
  CircuitBoard,
  FolderSearch,
  Wrench,
  Layers,
  FileHeart,
  Loader2,
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";

interface PromptTemplate {
  id: string;
  mode: string;
  label: string;
  promptText: string;
  icon: string;
  colorClass: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const MODES = [
  { value: "general", label: "Professionals", icon: Layers },
  { value: "personal", label: "Personal", icon: FileHeart },
  { value: "study", label: "Study", icon: BookOpen },
  { value: "research", label: "Research", icon: FolderSearch },
  { value: "engineering", label: "Engineering", icon: Wrench },
  { value: "service", label: "Service", icon: FileHeart },
  { value: "comparison", label: "Comparison", icon: Layers },
  { value: "finance", label: "Finance", icon: CircuitBoard },
];

const ICONS = [
  "Sparkles", "BookOpen", "CircuitBoard", "FolderSearch", "Wrench",
  "Layers", "FileHeart", "Bug", "TestTube", "FileWarning", "Cog",
  "ClipboardList", "FileCheck", "AlertTriangle", "Lightbulb", "Scale",
  "Beaker", "Microscope", "TrendingUp", "BarChart3", "DollarSign",
  "GitBranch", "UserSearch", "FileText", "Network", "Share2",
];

const COLOR_CLASSES = [
  { value: "from-blue-50 to-indigo-50", label: "Blue" },
  { value: "from-emerald-50 to-cyan-50", label: "Emerald" },
  { value: "from-orange-50 to-amber-50", label: "Orange" },
  { value: "from-red-50 to-rose-50", label: "Red" },
  { value: "from-purple-50 to-violet-50", label: "Purple" },
  { value: "from-slate-50 to-gray-50", label: "Gray" },
  { value: "from-amber-50 to-orange-50", label: "Amber" },
  { value: "from-indigo-50 to-violet-50", label: "Indigo" },
  { value: "from-rose-50 to-pink-50", label: "Rose" },
  { value: "from-cyan-50 to-blue-50", label: "Cyan" },
];

export default function AdminPromptTemplatesPage() {
  useDocumentTitle("Prompt Templates - Admin");
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [filterMode, setFilterMode] = useState<string>("all");

  const [formData, setFormData] = useState({
    mode: "engineering",
    label: "",
    promptText: "",
    icon: "Sparkles",
    colorClass: "from-blue-50 to-indigo-50",
    sortOrder: 0,
    isActive: true,
  });

  const { data: templates = [], isLoading, error } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/admin/prompt-templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/admin/prompt-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({ title: "Prompt template created" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create template", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest("PATCH", `/api/admin/prompt-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({ title: "Prompt template updated" });
      setDialogOpen(false);
      setEditingTemplate(null);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update template", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/prompt-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({ title: "Prompt template deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete template", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/admin/prompt-templates/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({ title: "Prompt template updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update template", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      mode: "engineering",
      label: "",
      promptText: "",
      icon: "Sparkles",
      colorClass: "from-blue-50 to-indigo-50",
      sortOrder: 0,
      isActive: true,
    });
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setFormData({
      mode: template.mode,
      label: template.label,
      promptText: template.promptText,
      icon: template.icon,
      colorClass: template.colorClass || "from-blue-50 to-indigo-50",
      sortOrder: template.sortOrder,
      isActive: template.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.label || !formData.promptText) {
      toast({ title: "Label and prompt text are required", variant: "destructive" });
      return;
    }

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredTemplates = filterMode === "all"
    ? templates
    : templates.filter(t => t.mode === filterMode);

  const groupedTemplates = MODES.reduce((acc, mode) => {
    acc[mode.value] = filteredTemplates.filter(t => t.mode === mode.value);
    return acc;
  }, {} as Record<string, PromptTemplate[]>);

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
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 mb-8">
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="self-start" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Prompt Templates</h1>
                <p className="text-muted-foreground text-sm">
                  Customize quick prompts for each mode
                </p>
              </div>
            </div>
            <Button onClick={openCreateDialog} data-testid="button-create-template">
              <Plus className="w-4 h-4 mr-2" />
              Add Prompt
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <Select value={filterMode} onValueChange={setFilterMode}>
            <SelectTrigger className="w-48" data-testid="select-filter-mode">
              <SelectValue placeholder="Filter by mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              {MODES.map(mode => (
                <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No prompt templates yet</h3>
              <p className="text-muted-foreground mb-4">
                Create custom prompts that appear as quick action buttons in the chat.
              </p>
              <Button onClick={openCreateDialog} data-testid="button-create-first">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Prompt
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {MODES.filter(mode => filterMode === "all" || filterMode === mode.value).map(mode => {
              const modeTemplates = groupedTemplates[mode.value] || [];
              if (modeTemplates.length === 0 && filterMode !== "all") return null;
              
              const ModeIcon = mode.icon;
              
              return (
                <div key={mode.value}>
                  <div className="flex items-center gap-2 mb-4">
                    <ModeIcon className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">{mode.label} Mode</h2>
                    <Badge variant="secondary">{modeTemplates.length}</Badge>
                  </div>
                  
                  {modeTemplates.length === 0 ? (
                    <p className="text-sm text-muted-foreground ml-7">No custom prompts for this mode</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {modeTemplates.map(template => (
                        <Card key={template.id} className={!template.isActive ? "opacity-60" : ""}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-base">{template.label}</CardTitle>
                                {!template.isActive && (
                                  <Badge variant="outline">Inactive</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(template)}
                                  data-testid={`button-edit-${template.id}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteMutation.mutate(template.id)}
                                  data-testid={`button-delete-${template.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                              {template.promptText}
                            </p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  Icon: {template.icon}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  Order: {template.sortOrder}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Active</span>
                                <Switch
                                  checked={template.isActive}
                                  onCheckedChange={(checked) =>
                                    toggleActiveMutation.mutate({ id: template.id, isActive: checked })
                                  }
                                  data-testid={`switch-active-${template.id}`}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Edit Prompt Template" : "Create Prompt Template"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select
                  value={formData.mode}
                  onValueChange={(value) => setFormData({ ...formData, mode: value })}
                >
                  <SelectTrigger data-testid="select-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map(mode => (
                      <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Button Label</Label>
                <Input
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="e.g., Root Cause Analysis"
                  data-testid="input-label"
                />
              </div>

              <div className="space-y-2">
                <Label>Prompt Text</Label>
                <Textarea
                  value={formData.promptText}
                  onChange={(e) => setFormData({ ...formData, promptText: e.target.value })}
                  placeholder="The full prompt that will be sent when the user clicks the button..."
                  rows={4}
                  data-testid="input-prompt"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Select
                    value={formData.icon}
                    onValueChange={(value) => setFormData({ ...formData, icon: value })}
                  >
                    <SelectTrigger data-testid="select-icon">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICONS.map(icon => (
                        <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Color</Label>
                  <Select
                    value={formData.colorClass}
                    onValueChange={(value) => setFormData({ ...formData, colorClass: value })}
                  >
                    <SelectTrigger data-testid="select-color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_CLASSES.map(color => (
                        <SelectItem key={color.value} value={color.value}>{color.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  data-testid="input-sort-order"
                />
                <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
              </div>

              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-active-form"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-template"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingTemplate ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
