import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { OrgLayout, useOrgContext } from "./OrgLayout";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  FileText,
  Save,
  History,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface PolicyData {
  heartbeat_interval_seconds: number;
  command_poll_seconds: number;
  pii_mode: string;
  upload_mode: string;
  minimum_sources: number;
  max_file_size_mb: number;
  allowed_file_types: string[];
  citations_required: boolean;
  blocked_path_patterns: string[];
  freshness_max_age_days: number | null;
  external_sources_allowed: boolean;
  do_not_guess_from_non_extractable: boolean;
}

interface PolicyHistory {
  id: string;
  version: number;
  policyJson: PolicyData;
  createdBy: string;
  createdAt: string;
}

interface PoliciesResponse {
  currentPolicy: PolicyData;
  currentVersion: number;
  history: PolicyHistory[];
}

const defaultPolicy: PolicyData = {
  heartbeat_interval_seconds: 60,
  command_poll_seconds: 15,
  pii_mode: "redact",
  upload_mode: "text_only",
  minimum_sources: 1,
  max_file_size_mb: 25,
  allowed_file_types: [".pdf", ".docx", ".txt", ".xlsx", ".csv", ".json", ".md"],
  citations_required: true,
  blocked_path_patterns: ["**/node_modules/**", "**/.git/**", "**/.*"],
  freshness_max_age_days: null,
  external_sources_allowed: false,
  do_not_guess_from_non_extractable: true,
};

export default function PoliciesPage() {
  const { toast } = useToast();
  const { data: orgContext } = useOrgContext();
  const canEdit = orgContext?.capabilities?.can_edit_policy;

  const { data, isLoading } = useQuery<PoliciesResponse>({
    queryKey: ["/api/org/policies"],
  });

  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [extensionsInput, setExtensionsInput] = useState("");

  const currentPolicy = policy || data?.currentPolicy || defaultPolicy;

  const saveMutation = useMutation({
    mutationFn: async (policyData: PolicyData) => {
      return apiRequest("POST", "/api/org/policies", policyData);
    },
    onSuccess: () => {
      toast({ title: "Policy saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/policies"] });
      setPolicy(null);
    },
    onError: () => {
      toast({ title: "Failed to save policy", variant: "destructive" });
    },
  });

  const handleFieldChange = (field: keyof PolicyData, value: any) => {
    setPolicy(prev => ({
      ...(prev || currentPolicy),
      [field]: value,
    }));
  };

  const handleExtensionsChange = () => {
    const newExts = extensionsInput
      .split(",")
      .map(e => {
        const trimmed = e.trim().toLowerCase();
        return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
      })
      .filter(e => e.length > 1);
    const combined = [...(currentPolicy.allowed_file_types || []), ...newExts];
    handleFieldChange("allowed_file_types", combined);
    setExtensionsInput("");
  };

  const hasChanges = policy !== null;

  return (
    <OrgLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Agent Policies</h1>
            <p className="text-muted-foreground">
              Configure how enrolled agents behave
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              Version {data?.currentVersion || 0}
            </Badge>
            {canEdit && hasChanges && (
              <Button
                onClick={() => saveMutation.mutate(currentPolicy)}
                disabled={saveMutation.isPending}
                data-testid="button-save-policy"
              >
                <Save className="w-4 h-4 mr-2" />
                Publish New Version
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Communication</CardTitle>
                  <CardDescription>
                    Configure how agents communicate with the server
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="heartbeat">Heartbeat Interval (seconds)</Label>
                    <Input
                      id="heartbeat"
                      type="number"
                      min={10}
                      max={3600}
                      value={currentPolicy.heartbeat_interval_seconds}
                      onChange={(e) => handleFieldChange("heartbeat_interval_seconds", parseInt(e.target.value) || 60)}
                      disabled={!canEdit}
                      data-testid="input-heartbeat"
                    />
                    <p className="text-xs text-muted-foreground">
                      How often agents check in with the server (10-3600 seconds)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commandPoll">Command Poll Interval (seconds)</Label>
                    <Input
                      id="commandPoll"
                      type="number"
                      min={5}
                      max={300}
                      value={currentPolicy.command_poll_seconds}
                      onChange={(e) => handleFieldChange("command_poll_seconds", parseInt(e.target.value) || 15)}
                      disabled={!canEdit}
                      data-testid="input-command-poll"
                    />
                    <p className="text-xs text-muted-foreground">
                      How often agents poll for new commands (5-300 seconds)
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>File Uploads</CardTitle>
                  <CardDescription>
                    Control which files agents can upload
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Allowed File Types</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(currentPolicy.allowed_file_types || []).map((ext, i) => (
                        <Badge 
                          key={i} 
                          variant="secondary" 
                          className="cursor-pointer"
                          onClick={() => {
                            if (!canEdit) return;
                            const newExts = currentPolicy.allowed_file_types.filter((_, j) => j !== i);
                            handleFieldChange("allowed_file_types", newExts);
                          }}
                          data-testid={`badge-ext-${ext}`}
                        >
                          {ext}
                          {canEdit && " ×"}
                        </Badge>
                      ))}
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add extension (e.g., .pdf, .docx)"
                          value={extensionsInput}
                          onChange={(e) => setExtensionsInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleExtensionsChange()}
                          data-testid="input-extension"
                        />
                        <Button 
                          variant="outline" 
                          onClick={handleExtensionsChange}
                          data-testid="button-add-extension"
                        >
                          Add
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxSize">Max File Size (MB)</Label>
                    <Input
                      id="maxSize"
                      type="number"
                      min={1}
                      max={500}
                      value={currentPolicy.max_file_size_mb}
                      onChange={(e) => handleFieldChange("max_file_size_mb", parseInt(e.target.value) || 25)}
                      disabled={!canEdit}
                      data-testid="input-max-size"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI & Privacy Settings</CardTitle>
                  <CardDescription>
                    Configure privacy and citation policies
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Citations Required</Label>
                      <p className="text-xs text-muted-foreground">
                        Require citations in AI responses
                      </p>
                    </div>
                    <Switch
                      checked={currentPolicy.citations_required}
                      onCheckedChange={(checked) => handleFieldChange("citations_required", checked)}
                      disabled={!canEdit}
                      data-testid="switch-citations"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>External Sources Allowed</Label>
                      <p className="text-xs text-muted-foreground">
                        Allow AI to use external web sources
                      </p>
                    </div>
                    <Switch
                      checked={currentPolicy.external_sources_allowed}
                      onCheckedChange={(checked) => handleFieldChange("external_sources_allowed", checked)}
                      disabled={!canEdit}
                      data-testid="switch-external-sources"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minSources">Minimum Sources</Label>
                    <Input
                      id="minSources"
                      type="number"
                      min={0}
                      max={10}
                      value={currentPolicy.minimum_sources}
                      onChange={(e) => handleFieldChange("minimum_sources", parseInt(e.target.value) || 1)}
                      disabled={!canEdit}
                      data-testid="input-min-sources"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum number of sources required for AI answers
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Version History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.history.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No history yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {data?.history.slice(0, 5).map((h) => (
                        <div 
                          key={h.id} 
                          className="flex items-center justify-between p-2 rounded border"
                          data-testid={`history-${h.version}`}
                        >
                          <div>
                            <Badge variant={h.version === data.currentVersion ? "default" : "outline"}>
                              v{h.version}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(h.createdAt), "MMM d, yyyy")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {!canEdit && (
                <Card className="border-amber-500/50 bg-amber-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Read-Only</p>
                        <p className="text-xs text-muted-foreground">
                          You don't have permission to edit policies. Contact an admin to request changes.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </OrgLayout>
  );
}
