import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FolderSync, Plus, Key, RefreshCw, CheckCircle, AlertCircle, 
  Clock, Copy, Eye, EyeOff, ArrowLeft, Server, FileText, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { ConnectorType, ConnectorStatus } from "@shared/schema";

interface Workspace {
  id: string;
  name: string;
  plan: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Pending" },
    connected: { variant: "default", label: "Connected" },
    disconnected: { variant: "outline", label: "Disconnected" },
    error: { variant: "destructive", label: "Error" },
  };
  const { variant, label } = variants[status] || { variant: "outline", label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

function TokenDisplay({ token }: { token: string }) {
  const [visible, setVisible] = useState(false);
  const { toast } = useToast();

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    toast({ title: "Token copied", description: "The agent token has been copied to your clipboard." });
  };

  return (
    <div className="space-y-3 p-4 bg-muted/30 rounded-md">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Key className="w-4 h-4" />
        <span className="font-medium">Agent Token</span>
        <Badge variant="destructive" className="text-xs">Store securely - shown once</Badge>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 p-2 bg-background rounded border text-xs font-mono break-all">
          {visible ? token : "•".repeat(32)}
        </code>
        <Button size="icon" variant="ghost" onClick={() => setVisible(!visible)} data-testid="button-toggle-token">
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={copyToken} data-testid="button-copy-token">
          <Copy className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function AgentSetupInstructions({ connectorId, serverUrl }: { connectorId: string; serverUrl: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agent Setup Instructions</CardTitle>
        <CardDescription>Follow these steps to configure the Evident Sync Agent</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal list-inside space-y-3 text-sm">
          <li className="text-muted-foreground">
            <span className="font-medium text-foreground">Install the Evident Sync Agent</span> on a machine that can access the SMB share.
          </li>
          <li className="text-muted-foreground">
            <span className="font-medium text-foreground">Configure the agent</span> with the following settings:
            <div className="mt-2 ml-4 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-24">SMB paths:</span>
                <code className="px-2 py-1 bg-muted rounded">\\SERVER\Share\Folder</code>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-24">Connector ID:</span>
                <code className="px-2 py-1 bg-muted rounded">{connectorId}</code>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-24">Server URL:</span>
                <code className="px-2 py-1 bg-muted rounded">{serverUrl}</code>
              </div>
            </div>
          </li>
          <li className="text-muted-foreground">
            <span className="font-medium text-foreground">Run daily snapshot sync</span> to upload files to Evident.
          </li>
        </ol>
        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md text-xs text-muted-foreground">
          <Server className="w-4 h-4" />
          <span>Read-only ingestion. Only outbound HTTPS required.</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectorRunsTable({ runs }: { runs: ConnectorStatus["recentRuns"] }) {
  if (!runs || runs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        No sync runs yet
      </div>
    );
  }

  return (
    <ScrollArea className="h-[200px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Files Seen</TableHead>
            <TableHead className="text-right">Ingested</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell className="text-xs">
                {new Date(run.startedAt).toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge 
                  variant={run.status === "completed" ? "default" : run.status === "error" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {run.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-sm">{run.filesSeen}</TableCell>
              <TableCell className="text-right text-sm">{run.filesIngested}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function CreateConnectorDialog({ workspaceId, onCreated }: { workspaceId: string; onCreated: (connector: any, token?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scheduleTime, setScheduleTime] = useState("02:00");
  const [generateToken, setGenerateToken] = useState(true);
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const connectorRes = await apiRequest("POST", "/api/connectors", {
        workspaceId,
        type: "onprem_agent",
        name,
        schedule: { mode: "daily", time: scheduleTime },
        rules: {
          includeExt: ["pdf", "docx", "txt", "csv", "xlsx", "png", "jpg"],
          excludeExt: ["exe", "zip"],
          maxSizeMB: 25
        }
      });
      const connector = await connectorRes.json();
      
      let token: string | undefined;
      if (generateToken) {
        const tokenRes = await apiRequest("POST", `/api/connectors/${connector.id}/token`);
        const tokenData = await tokenRes.json();
        token = tokenData.agentToken;
      }
      
      return { connector, token };
    },
    onSuccess: ({ connector, token }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({ title: "Connector created", description: `${connector.name} has been set up successfully.` });
      setOpen(false);
      setName("");
      onCreated(connector, token);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create connector", 
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-connector">
          <Plus className="w-4 h-4 mr-2" />
          Add Connector
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create On-Prem Folder Sync</DialogTitle>
          <DialogDescription>
            Set up automated ingestion from your NAS/SMB file shares.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="connector-name">Connector Name</Label>
            <Input
              id="connector-name"
              placeholder="e.g., Company NAS Sync"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-connector-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Schedule Time (daily)</Label>
            <Select value={scheduleTime} onValueChange={setScheduleTime}>
              <SelectTrigger data-testid="select-schedule-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="00:00">12:00 AM</SelectItem>
                <SelectItem value="02:00">2:00 AM</SelectItem>
                <SelectItem value="04:00">4:00 AM</SelectItem>
                <SelectItem value="06:00">6:00 AM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="p-3 bg-muted/30 rounded-md">
            <p className="text-xs text-muted-foreground">
              Supported file types: PDF, DOCX, TXT, CSV, XLSX, PNG, JPG
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
            data-testid="button-confirm-create"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Connector
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectorCard({ connector, workspaceId }: { connector: ConnectorType; workspaceId: string }) {
  const [showToken, setShowToken] = useState<string | null>(null);
  const { toast } = useToast();

  const statusQuery = useQuery<ConnectorStatus>({
    queryKey: ["/api/connectors", connector.id, "status"],
    queryFn: async () => {
      const res = await fetch(`/api/connectors/${connector.id}/status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/connectors/${connector.id}/token`);
      const data = await res.json();
      return data.agentToken;
    },
    onSuccess: (token) => {
      setShowToken(token);
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({ title: "Token generated", description: "Store this token securely." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to generate token", description: error.message, variant: "destructive" });
    },
  });

  const requestSyncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/connectors/${connector.id}/run`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors", connector.id, "status"] });
      toast({ title: "Sync requested", description: "The agent will pick up this request on its next poll." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to request sync", description: error.message, variant: "destructive" });
    },
  });

  const status = statusQuery.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FolderSync className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">{connector.name}</CardTitle>
          </div>
          <CardDescription>On-Prem Folder Sync (NAS/SMB)</CardDescription>
        </div>
        <StatusBadge status={connector.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {showToken && <TokenDisplay token={showToken} />}
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Last Sync:</span>
            <p className="font-medium">
              {connector.lastRun ? new Date(connector.lastRun).toLocaleString() : "Never"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Files Ingested:</span>
            <p className="font-medium">{status?.totalFilesIngested ?? 0}</p>
          </div>
        </div>

        {connector.lastError && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md text-xs">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <span className="text-destructive">{connector.lastError}</span>
          </div>
        )}

        {status && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Recent Sync Runs</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => statusQuery.refetch()}
                disabled={statusQuery.isFetching}
              >
                <RefreshCw className={`w-3 h-3 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <ConnectorRunsTable runs={status.recentRuns} />
          </div>
        )}

        <AgentSetupInstructions 
          connectorId={connector.id} 
          serverUrl={window.location.origin}
        />
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {!connector.hasToken && (
          <Button 
            onClick={() => generateTokenMutation.mutate()}
            disabled={generateTokenMutation.isPending}
            data-testid={`button-generate-token-${connector.id}`}
          >
            {generateTokenMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Key className="w-4 h-4 mr-2" />
            )}
            Generate Token
          </Button>
        )}
        {connector.hasToken && (
          <>
            <Button 
              variant="outline"
              onClick={() => generateTokenMutation.mutate()}
              disabled={generateTokenMutation.isPending}
              data-testid={`button-regenerate-token-${connector.id}`}
            >
              <Key className="w-4 h-4 mr-2" />
              Regenerate Token
            </Button>
            <Button
              onClick={() => requestSyncMutation.mutate()}
              disabled={requestSyncMutation.isPending || !!connector.requestedAt}
              data-testid={`button-request-sync-${connector.id}`}
            >
              {requestSyncMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {connector.requestedAt ? "Sync Pending..." : "Request Sync"}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

export default function ConnectorsPage() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [newConnectorToken, setNewConnectorToken] = useState<{ connector: any; token: string } | null>(null);
  const { toast } = useToast();

  const workspacesQuery = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const connectorsQuery = useQuery<ConnectorType[]>({
    queryKey: ["/api/connectors", selectedWorkspace],
    queryFn: async () => {
      if (!selectedWorkspace) return [];
      const res = await fetch(`/api/connectors?workspaceId=${selectedWorkspace}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch connectors");
      return res.json();
    },
    enabled: !!selectedWorkspace,
  });

  const workspaces = workspacesQuery.data || [];
  const premiumWorkspaces = workspaces.filter(w => w.plan === "PREMIUM_ORG");
  const connectors = connectorsQuery.data || [];

  const handleConnectorCreated = (connector: any, token?: string) => {
    if (token) {
      setNewConnectorToken({ connector, token });
    }
    connectorsQuery.refetch();
  };

  if (workspacesQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (premiumWorkspaces.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="self-start">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-lg sm:text-xl font-semibold">Data Connectors</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <FolderSync className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <CardTitle>Premium Org Required</CardTitle>
              <CardDescription>
                Data connectors are available on the Premium Org plan ($79/month).
                Upgrade to access automated NAS/SMB ingestion.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Link href="/">
                <Button>Return to Home</Button>
              </Link>
            </CardFooter>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="self-start" data-testid="button-workspace">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go to Workspace
              </Button>
            </Link>
            <h1 className="text-lg sm:text-xl font-semibold">Data Connectors</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
              <SelectTrigger className="w-[160px] sm:w-[200px]" data-testid="select-workspace">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {premiumWorkspaces.map(ws => (
                  <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWorkspace && (
              <CreateConnectorDialog 
                workspaceId={selectedWorkspace} 
                onCreated={handleConnectorCreated}
              />
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!selectedWorkspace ? (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <FolderSync className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <CardTitle>Select a Workspace</CardTitle>
              <CardDescription>
                Choose a Premium Org workspace to manage its data connectors.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : connectorsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : connectors.length === 0 ? (
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center">
              <FolderSync className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <CardTitle>No Connectors Yet</CardTitle>
              <CardDescription>
                Set up an On-Prem Folder Sync connector to automatically ingest files
                from your company's NAS or SMB file shares.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <CreateConnectorDialog 
                workspaceId={selectedWorkspace}
                onCreated={handleConnectorCreated}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {newConnectorToken && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Connector Created Successfully
                  </CardTitle>
                  <CardDescription>
                    Your connector "{newConnectorToken.connector.name}" is ready. 
                    Copy and save the agent token below.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TokenDisplay token={newConnectorToken.token} />
                </CardContent>
                <CardFooter>
                  <Button variant="outline" onClick={() => setNewConnectorToken(null)}>
                    Dismiss
                  </Button>
                </CardFooter>
              </Card>
            )}
            
            {connectors.map(connector => (
              <ConnectorCard 
                key={connector.id} 
                connector={connector}
                workspaceId={selectedWorkspace}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
