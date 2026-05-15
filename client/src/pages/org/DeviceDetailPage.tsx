import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft,
  Monitor, 
  Folder,
  Ban, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Pause,
  Terminal,
  Activity,
  Settings,
  Search,
  FileText,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface DeviceFolder {
  id: string;
  deviceId: string;
  folderPath: string;
  fileCount: number;
  totalBytes: number;
  lastIndexedAt: string | null;
}

interface DeviceEvent {
  id: string;
  deviceId: string;
  type: string;
  message: string;
  payloadJson: any;
  createdAt: string;
}

interface DeviceCommand {
  id: string;
  deviceId: string;
  commandType: string;
  payloadJson: any;
  status: string;
  createdAt: string;
  executedAt: string | null;
  resultJson: any;
}

interface DeviceDetail {
  device: {
    id: string;
    orgId: string;
    name: string;
    os: string;
    version: string;
    installMode: string;
    statusOverride: string;
    lastSeenAt: string | null;
    lastState: string;
    queueDepth: number;
    computedStatus: string;
    appliedPolicyVersion: number | null;
    lastErrorCode: string | null;
  };
  folders: DeviceFolder[];
  events: DeviceEvent[];
  commands: DeviceCommand[];
  currentPolicyVersion: number;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any; label: string }> = {
    online: { variant: "default", icon: CheckCircle2, label: "Online" },
    offline: { variant: "secondary", icon: XCircle, label: "Offline" },
    paused: { variant: "outline", icon: Pause, label: "Paused" },
    error: { variant: "destructive", icon: AlertTriangle, label: "Error" },
    stalled: { variant: "secondary", icon: Clock, label: "Stalled" },
    revoked: { variant: "destructive", icon: Ban, label: "Revoked" },
  };

  const config = variants[status] || variants.offline;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface SearchResult {
  id: string;
  name: string;
  path: string;
  extension: string;
  sizeMB: number;
  lastModified: string;
  preview?: string;
}

interface SearchResponse {
  commandId: string;
  status: string;
  searchTimeMs?: number;
  resultCount?: number;
  results?: SearchResult[];
}

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: orgContext } = useOrgContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);

  const { data, isLoading, refetch } = useQuery<DeviceDetail>({
    queryKey: ["/api/org/devices", id],
    enabled: !!id,
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/org/devices/${id}/revoke`);
    },
    onSuccess: () => {
      toast({ title: "Device revoked successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/devices", id] });
    },
    onError: () => {
      toast({ title: "Failed to revoke device", variant: "destructive" });
    },
  });

  const sendCommandMutation = useMutation({
    mutationFn: async (commandType: string) => {
      return apiRequest("POST", `/api/org/devices/${id}/commands`, { commandType });
    },
    onSuccess: () => {
      toast({ title: "Command sent successfully" });
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to send command", variant: "destructive" });
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", `/api/org/devices/${id}/search`, { query });
      return res.json();
    },
    onSuccess: (data) => {
      setSearchResults(data);
      if (data.status === "demo") {
        toast({ title: `Demo search: Found ${data.resultCount || 0} results in ${data.searchTimeMs}ms` });
      } else {
        toast({ title: "Search command sent to device" });
      }
    },
    onError: () => {
      toast({ title: "Failed to execute search", variant: "destructive" });
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    searchMutation.mutate(searchQuery);
  };

  const canManageDevices = orgContext?.capabilities?.can_manage_devices;
  const device = data?.device;

  if (isLoading) {
    return (
      <OrgLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </OrgLayout>
    );
  }

  if (!device) {
    return (
      <OrgLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Device Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This device may have been removed or you don't have access.
          </p>
          <Link href="/org/agents">
            <Button data-testid="button-back-fleet">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Fleet
            </Button>
          </Link>
        </div>
      </OrgLayout>
    );
  }

  return (
    <OrgLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/org/agents">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{device.name}</h1>
              <StatusBadge status={device.computedStatus} />
            </div>
            <p className="text-muted-foreground">
              {device.os} - Version {device.version}
            </p>
          </div>
          {canManageDevices && device.computedStatus !== "revoked" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => sendCommandMutation.mutate("resync")}
                disabled={sendCommandMutation.isPending}
                data-testid="button-resync"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Force Re-sync
              </Button>
              <Button
                variant="destructive"
                onClick={() => revokeMutation.mutate()}
                disabled={revokeMutation.isPending}
                data-testid="button-revoke"
              >
                <Ban className="w-4 h-4 mr-2" />
                Revoke
              </Button>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Monitor className="w-4 h-4" />
                <span className="text-sm">Install Mode</span>
              </div>
              <div className="font-medium capitalize">{device.installMode}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Last Seen</span>
              </div>
              <div className="font-medium">
                {device.lastSeenAt
                  ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true })
                  : "Never"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-sm">State</span>
              </div>
              <div className="font-medium capitalize">{device.lastState || "idle"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Settings className="w-4 h-4" />
                <span className="text-sm">Policy Version</span>
              </div>
              <div className="font-medium">
                v{device.appliedPolicyVersion || 0}
                {device.appliedPolicyVersion !== data?.currentPolicyVersion && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Update pending
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {device.lastErrorCode && (
          <Card className="border-destructive">
            <CardHeader className="pb-2">
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <code className="text-sm font-mono">{device.lastErrorCode}</code>
            </CardContent>
          </Card>
        )}

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Remote Search
            </CardTitle>
            <CardDescription>
              Search documents on this device to test response time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search for files (e.g., contract, invoice, report)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
                data-testid="input-remote-search"
              />
              <Button
                onClick={handleSearch}
                disabled={searchMutation.isPending || !searchQuery.trim()}
                data-testid="button-remote-search"
              >
                {searchMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Search
              </Button>
            </div>

            {searchResults && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">
                      {searchResults.resultCount || 0} results
                    </Badge>
                    {searchResults.searchTimeMs && (
                      <span className="text-sm text-muted-foreground">
                        Response time: <span className="font-mono font-medium text-primary">{searchResults.searchTimeMs}ms</span>
                      </span>
                    )}
                  </div>
                  <Badge variant={searchResults.status === "demo" ? "outline" : "default"}>
                    {searchResults.status === "demo" ? "Demo Mode" : searchResults.status}
                  </Badge>
                </div>

                {searchResults.results && searchResults.results.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.results.slice(0, 10).map((result, index) => (
                      <div
                        key={result.id || index}
                        className="flex items-start gap-3 p-3 rounded-lg border"
                        data-testid={`search-result-${index}`}
                      >
                        <FileText className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{result.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{result.path}</div>
                          {result.preview && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {result.preview}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          {result.sizeMB} MB
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Note: Demo mode simulates search. Real agent search requires the device to be online with indexed files.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5" />
              Watched Folders
            </CardTitle>
            <CardDescription>
              {data?.folders.length || 0} folders being monitored
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.folders.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No folders configured yet
              </p>
            ) : (
              <div className="space-y-3">
                {data?.folders.map((folder) => (
                  <div 
                    key={folder.id} 
                    className="flex items-center justify-between p-3 rounded-md border"
                    data-testid={`folder-${folder.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{folder.folderPath}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{folder.fileCount} files</span>
                      <span>{formatBytes(folder.totalBytes)}</span>
                      {folder.lastIndexedAt && (
                        <span>
                          Indexed {formatDistanceToNow(new Date(folder.lastIndexedAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Commands
              </CardTitle>
              <CardDescription>
                Recent commands sent to this device
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.commands.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No commands yet
                </p>
              ) : (
                <div className="space-y-2">
                  {data?.commands.map((cmd) => (
                    <div 
                      key={cmd.id} 
                      className="flex items-center justify-between p-2 rounded border text-sm"
                      data-testid={`command-${cmd.id}`}
                    >
                      <div>
                        <span className="font-mono">{cmd.commandType}</span>
                        <span className="text-muted-foreground ml-2">
                          {format(new Date(cmd.createdAt), "MMM d, HH:mm")}
                        </span>
                      </div>
                      <Badge 
                        variant={
                          cmd.status === "succeeded" ? "default" : 
                          cmd.status === "failed" ? "destructive" : 
                          "secondary"
                        }
                      >
                        {cmd.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Events
              </CardTitle>
              <CardDescription>
                Activity log from this device
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.events.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No events yet
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data?.events.slice(0, 10).map((event) => (
                    <div 
                      key={event.id} 
                      className="p-2 rounded border text-sm"
                      data-testid={`event-${event.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {event.type}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(event.createdAt), "MMM d, HH:mm:ss")}
                        </span>
                      </div>
                      {event.message && (
                        <p className="text-muted-foreground mt-1">{event.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </OrgLayout>
  );
}
