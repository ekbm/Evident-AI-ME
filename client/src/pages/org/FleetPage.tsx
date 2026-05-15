import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Monitor, 
  MoreVertical, 
  Eye, 
  Ban, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Pause,
  Apple,
  MonitorSmartphone,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Device {
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
}

interface DevicesResponse {
  devices: Device[];
  summary: {
    total: number;
    online: number;
    offline: number;
    paused: number;
    error: number;
    stalled: number;
    revoked: number;
    seatsUsed: number;
    seatLimit: number;
  };
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

function OsIcon({ os }: { os: string }) {
  const lowerOs = (os || "").toLowerCase();
  if (lowerOs.includes("mac") || lowerOs.includes("darwin")) {
    return <Apple className="w-4 h-4 text-muted-foreground" />;
  }
  if (lowerOs.includes("windows")) {
    return <MonitorSmartphone className="w-4 h-4 text-muted-foreground" />;
  }
  return <Monitor className="w-4 h-4 text-muted-foreground" />;
}

function StatCard({ label, value, variant }: { label: string; value: number; variant?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export default function FleetPage() {
  const { toast } = useToast();
  const { data: orgContext } = useOrgContext();

  const { data, isLoading, refetch } = useQuery<DevicesResponse>({
    queryKey: ["/api/org/devices"],
  });

  const revokeMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiRequest("POST", `/api/org/devices/${deviceId}/revoke`);
    },
    onSuccess: () => {
      toast({ title: "Device revoked successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/devices"] });
    },
    onError: () => {
      toast({ title: "Failed to revoke device", variant: "destructive" });
    },
  });

  const sendCommandMutation = useMutation({
    mutationFn: async ({ deviceId, commandType }: { deviceId: string; commandType: string }) => {
      return apiRequest("POST", `/api/org/devices/${deviceId}/commands`, { commandType });
    },
    onSuccess: () => {
      toast({ title: "Command sent successfully" });
    },
    onError: () => {
      toast({ title: "Failed to send command", variant: "destructive" });
    },
  });

  const canManageDevices = orgContext?.capabilities?.can_manage_devices;

  return (
    <OrgLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Device Fleet</h1>
            <p className="text-muted-foreground">
              Manage your organization's enrolled devices
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            data-testid="button-refresh-fleet"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : data?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard label="Total Devices" value={data.summary.total} />
            <StatCard label="Online" value={data.summary.online} />
            <StatCard label="Offline" value={data.summary.offline} />
            <StatCard label="Errors" value={data.summary.error} />
            <StatCard 
              label="Seats Used" 
              value={data.summary.seatsUsed} 
            />
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {data.summary.seatsUsed} / {data.summary.seatLimit}
                </div>
                <div className="text-sm text-muted-foreground">Seat Usage</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Devices</CardTitle>
            <CardDescription>
              {data?.devices.length || 0} devices enrolled
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : data?.devices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No devices enrolled yet</p>
                <p className="text-sm">
                  Download the agent installer to enroll your first device
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.devices.map((device) => (
                    <TableRow key={device.id} data-testid={`row-device-${device.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <OsIcon os={device.os} />
                          <span className="font-medium">{device.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {device.os || "Unknown"}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {device.version}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={device.computedStatus} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {device.lastSeenAt ? (
                          <span title={format(new Date(device.lastSeenAt), "PPpp")}>
                            {formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true })}
                          </span>
                        ) : (
                          "Never"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {device.lastState || "idle"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              data-testid={`button-device-actions-${device.id}`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Link href={`/org/agents/${device.id}`}>
                              <DropdownMenuItem data-testid={`menu-view-${device.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                            </Link>
                            {canManageDevices && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => sendCommandMutation.mutate({
                                    deviceId: device.id,
                                    commandType: "resync",
                                  })}
                                  data-testid={`menu-resync-${device.id}`}
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Force Re-sync
                                </DropdownMenuItem>
                                {device.computedStatus !== "revoked" && (
                                  <DropdownMenuItem
                                    onClick={() => revokeMutation.mutate(device.id)}
                                    className="text-destructive"
                                    data-testid={`menu-revoke-${device.id}`}
                                  >
                                    <Ban className="w-4 h-4 mr-2" />
                                    Revoke Device
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </OrgLayout>
  );
}
