import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Shield, ShieldCheck, ShieldOff, AlertTriangle, CheckCircle, Loader2, Upload, FileText, Trash2, Play, BookOpen } from "lucide-react";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface PolicyStatus {
  allowed: boolean;
  policy_status: string;
  policy_version: number | null;
  policy: {
    citations_required: boolean;
    minimum_sources: number;
    do_not_guess_from_non_extractable: boolean;
    pii_mode: string;
    restricted_topics: string[];
    allowed_sources: string;
    log_policy_version_used: boolean;
  } | null;
  reason: string | null;
  workspace_type: string;
  is_admin: boolean;
}

interface PolicyDocument {
  id: string;
  workspaceId: string;
  assetId: string;
  name: string;
  status: 'uploaded' | 'processing' | 'processed' | 'error';
  clauseCount: number;
  processedAt: string | null;
  createdAt: string;
}

interface PolicyClause {
  id: string;
  documentId: string;
  workspaceId: string;
  clauseType: string;
  title: string;
  requirement: string;
  actors: string | null;
  sourceRef: string | null;
  enforcementFlags: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function PolicySetup() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);

  const [policyConfig, setPolicyConfig] = useState({
    citations_required: true,
    minimum_sources: 1,
    do_not_guess_from_non_extractable: true,
    pii_mode: 'redact',
    restricted_topics: [] as string[],
  });

  const { data: policyStatus, isLoading } = useQuery<PolicyStatus>({
    queryKey: ['/api/workspaces', workspaceId, 'policy'],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/policy`);
      if (!response.ok) throw new Error('Failed to fetch policy status');
      return response.json();
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (policy: typeof policyConfig) => {
      const response = await fetch(`/api/workspaces/${workspaceId}/policy/activate`, {
        method: 'POST',
        body: JSON.stringify({ policy }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to activate policy' }));
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'policy'] });
      toast({
        title: "Policy Activated",
        description: "AI answers are now enabled for this workspace.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Activation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/policy/disable`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to disable policy' }));
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'policy'] });
      toast({
        title: "Policy Disabled",
        description: "AI answers have been disabled for this workspace.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Disable Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Policy Documents queries and mutations
  const { data: policyDocsData } = useQuery<{ documents: PolicyDocument[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'policy-docs'],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/policy-docs`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch policy documents');
      return response.json();
    },
  });

  const { data: clausesData } = useQuery<{ clauses: PolicyClause[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'policy-clauses'],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/policy-clauses`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch policy clauses');
      return response.json();
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/workspaces/${workspaceId}/policy-docs/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'policy-docs'] });
      toast({
        title: "Document Uploaded",
        description: "Click 'Process' to extract policy rules.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const processDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      setProcessingDocId(docId);
      const response = await fetch(`/api/workspaces/${workspaceId}/policy-docs/${docId}/process`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Processing failed' }));
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setProcessingDocId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'policy-docs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'policy-clauses'] });
      toast({
        title: "Processing Complete",
        description: `Extracted ${data.clauseCount} policy clauses.`,
      });
    },
    onError: (error: Error) => {
      setProcessingDocId(null);
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const response = await fetch(`/api/workspaces/${workspaceId}/policy-docs/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Delete failed' }));
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'policy-docs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'policy-clauses'] });
      toast({ title: "Document Deleted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleClauseMutation = useMutation({
    mutationFn: async ({ clauseId, isActive }: { clauseId: string; isActive: boolean }) => {
      const response = await fetch(`/api/workspaces/${workspaceId}/policy-clauses/${clauseId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ isActive }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Toggle failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'policy-clauses'] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const policyDocs = policyDocsData?.documents || [];
  const clauses = clausesData?.clauses || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!policyStatus) {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Unable to load policy status</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!policyStatus.is_admin) {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <ShieldOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
            <p className="text-muted-foreground">Only workspace administrators can configure policies.</p>
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate("/")} data-testid="button-workspace">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPersonal = policyStatus.workspace_type === 'PERSONAL';
  const isActive = policyStatus.policy_status === 'policy_active';
  const isPending = policyStatus.policy_status === 'policy_required';

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} data-testid="button-workspace">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go to Workspace
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Policy Setup</h1>
          <p className="text-muted-foreground">Configure AI answering behavior for your workspace</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {isActive ? (
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
              ) : isPending ? (
                <Shield className="h-6 w-6 text-amber-500" />
              ) : (
                <ShieldOff className="h-6 w-6 text-muted-foreground" />
              )}
              <div>
                <CardTitle>Policy Status</CardTitle>
                <CardDescription>
                  {isPersonal ? "Personal workspace with safe defaults" : "Organization workspace"}
                </CardDescription>
              </div>
            </div>
            <Badge 
              variant={isActive ? "default" : isPending ? "outline" : "secondary"}
              className={isActive ? "bg-emerald-500" : ""}
              data-testid="badge-policy-status"
            >
              {isActive ? "Active" : isPending ? "Pending Setup" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isPersonal ? (
            <div className="rounded-lg bg-muted/50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
                <div>
                  <p className="font-medium">Safe Policy Applied</p>
                  <p className="text-sm text-muted-foreground">
                    Personal workspaces automatically have a safe policy enabled. AI answers are ready to use.
                  </p>
                </div>
              </div>
              <ul className="text-sm space-y-1 pl-8 text-muted-foreground">
                <li>Citations always required</li>
                <li>Minimum 1 source per answer</li>
                <li>No guessing from non-extractable content</li>
                <li>PII redaction enabled</li>
              </ul>
            </div>
          ) : isPending ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">Policy Configuration Required</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    AI answers are disabled until you configure and activate a policy. This ensures responsible use of AI within your organization.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <ShieldOff className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">AI Answers Disabled</p>
                  <p className="text-sm text-muted-foreground">
                    An administrator has disabled AI answers for this workspace.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isPersonal && (
        <Card>
          <CardHeader>
            <CardTitle>Policy Configuration</CardTitle>
            <CardDescription>
              Define guardrails for how AI responds to questions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Require Citations</Label>
                <p className="text-sm text-muted-foreground">Every answer must reference source documents</p>
              </div>
              <Switch
                checked={policyConfig.citations_required}
                onCheckedChange={(checked) => setPolicyConfig(prev => ({ ...prev, citations_required: checked }))}
                data-testid="switch-citations-required"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Minimum Sources</Label>
              <p className="text-sm text-muted-foreground mb-2">How many source documents are required per answer</p>
              <Input
                type="number"
                min={1}
                max={10}
                value={policyConfig.minimum_sources}
                onChange={(e) => setPolicyConfig(prev => ({ ...prev, minimum_sources: parseInt(e.target.value) || 1 }))}
                className="w-24"
                data-testid="input-minimum-sources"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Block Non-Extractable Guessing</Label>
                <p className="text-sm text-muted-foreground">
                  Prevent AI from guessing content it cannot reliably read (scanned PDFs, images without OCR)
                </p>
              </div>
              <Switch
                checked={policyConfig.do_not_guess_from_non_extractable}
                onCheckedChange={(checked) => setPolicyConfig(prev => ({ ...prev, do_not_guess_from_non_extractable: checked }))}
                data-testid="switch-no-guess"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>PII Handling</Label>
              <p className="text-sm text-muted-foreground mb-2">How to handle personally identifiable information in responses</p>
              <Select
                value={policyConfig.pii_mode}
                onValueChange={(value) => setPolicyConfig(prev => ({ ...prev, pii_mode: value }))}
              >
                <SelectTrigger className="w-48" data-testid="select-pii-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="redact">Redact PII</SelectItem>
                  <SelectItem value="warn">Warn Only</SelectItem>
                  <SelectItem value="allow">Allow</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between gap-4 flex-wrap border-t pt-6">
            {isActive ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => activateMutation.mutate(policyConfig)}
                  disabled={activateMutation.isPending}
                  data-testid="button-update-policy"
                >
                  {activateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Update Policy
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => disableMutation.mutate()}
                  disabled={disableMutation.isPending}
                  data-testid="button-disable-policy"
                >
                  {disableMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Disable AI Answers
                </Button>
              </>
            ) : (
              <Button
                onClick={() => activateMutation.mutate(policyConfig)}
                disabled={activateMutation.isPending}
                className="w-full sm:w-auto"
                data-testid="button-activate-policy"
              >
                {activateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Activate Policy & Enable AI Answers
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      {/* Policy Knowledge Base - Document Upload & Clause Management */}
      {!isPersonal && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Policy Knowledge Base</CardTitle>
                  <CardDescription>
                    Upload company policy documents to auto-extract enforceable rules
                  </CardDescription>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-policy-doc-upload"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadDocMutation.isPending}
                data-testid="button-upload-policy-doc"
              >
                {uploadDocMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Policy Document
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {policyDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No policy documents uploaded yet.</p>
                <p className="text-sm">Upload PDF or DOCX files containing your company policies.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Uploaded Documents</h4>
                {policyDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30"
                    data-testid={`policy-doc-${doc.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.status === 'processed' 
                            ? `${doc.clauseCount} clauses extracted`
                            : doc.status === 'processing'
                            ? 'Processing...'
                            : doc.status === 'error'
                            ? 'Error extracting'
                            : 'Ready to process'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={
                          doc.status === 'processed' ? 'default' :
                          doc.status === 'processing' ? 'secondary' :
                          doc.status === 'error' ? 'destructive' : 'outline'
                        }
                        className={doc.status === 'processed' ? 'bg-emerald-500' : ''}
                      >
                        {doc.status}
                      </Badge>
                      {doc.status === 'uploaded' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => processDocMutation.mutate(doc.id)}
                          disabled={processingDocId === doc.id}
                          data-testid={`button-process-doc-${doc.id}`}
                        >
                          {processingDocId === doc.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteDocMutation.mutate(doc.id)}
                        disabled={deleteDocMutation.isPending}
                        data-testid={`button-delete-doc-${doc.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {clauses.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Extracted Clauses ({clauses.length})
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {clauses.filter(c => c.isActive).length} active
                    </Badge>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {clauses.map((clause) => (
                      <div
                        key={clause.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          clause.isActive 
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' 
                            : 'bg-muted/30'
                        }`}
                        data-testid={`clause-${clause.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium">{clause.title}</p>
                              <Badge variant="outline" className="text-xs capitalize">
                                {clause.clauseType}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {clause.requirement}
                            </p>
                          </div>
                          <Switch
                            checked={clause.isActive}
                            onCheckedChange={(checked) => 
                              toggleClauseMutation.mutate({ clauseId: clause.id, isActive: checked })
                            }
                            data-testid={`switch-clause-${clause.id}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Active clauses will be referenced when AI answers questions, providing citations to your company policies.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {policyStatus.policy && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Policy Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Version</dt>
                <dd className="font-medium">{policyStatus.policy_version || 1}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Citations</dt>
                <dd className="font-medium">{policyStatus.policy.citations_required ? 'Required' : 'Optional'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Min Sources</dt>
                <dd className="font-medium">{policyStatus.policy.minimum_sources}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">PII Mode</dt>
                <dd className="font-medium capitalize">{policyStatus.policy.pii_mode}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
