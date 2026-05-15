import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Shield,
  Search,
  Filter,
  Download,
  RefreshCw,
  User,
  Monitor,
  FileText,
  Key,
  AlertTriangle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface AuditLog {
  id: string;
  orgId: string;
  userId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: any;
  createdAt: string;
}

interface AuditResponse {
  logs: AuditLog[];
}

const ACTION_ICONS: Record<string, any> = {
  device_enrolled: Monitor,
  device_revoked: Monitor,
  device_command_issued: Monitor,
  policy_created: FileText,
  policy_updated: FileText,
  enrollment_token_rotated: Key,
  pairing_code_created: Key,
  agent_installer_downloaded: Download,
  it_pack_downloaded: Download,
  sha256sums_downloaded: Download,
};

const ACTION_LABELS: Record<string, string> = {
  device_enrolled: "Device Enrolled",
  device_revoked: "Device Revoked",
  device_command_issued: "Command Issued",
  policy_created: "Policy Created",
  policy_updated: "Policy Updated",
  enrollment_token_rotated: "Token Rotated",
  pairing_code_created: "Pairing Code Created",
  agent_installer_downloaded: "Installer Downloaded",
  it_pack_downloaded: "IT Pack Downloaded",
  sha256sums_downloaded: "Checksums Downloaded",
};

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  device_enrolled: "default",
  device_revoked: "destructive",
  device_command_issued: "secondary",
  policy_created: "default",
  policy_updated: "secondary",
  enrollment_token_rotated: "outline",
  pairing_code_created: "outline",
  agent_installer_downloaded: "secondary",
  it_pack_downloaded: "secondary",
  sha256sums_downloaded: "secondary",
};

export default function AuditPage() {
  const { data: orgContext } = useOrgContext();
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, refetch } = useQuery<AuditResponse>({
    queryKey: ["/api/org/audit"],
    enabled: orgContext?.capabilities?.can_view_audit,
  });

  const filteredLogs = (data?.logs || []).filter(log => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        log.action.toLowerCase().includes(searchLower) ||
        log.targetType.toLowerCase().includes(searchLower) ||
        log.targetId.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const uniqueActions = Array.from(new Set(data?.logs.map(l => l.action) || []));

  if (!orgContext?.capabilities?.can_view_audit) {
    return (
      <OrgLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Shield className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have permission to view audit logs.
          </p>
        </div>
      </OrgLayout>
    );
  }

  return (
    <OrgLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Logs</h1>
            <p className="text-muted-foreground">
              Track all administrative actions in your organization
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            data-testid="button-refresh-audit"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>
                  {filteredLogs.length} events
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-full sm:w-64"
                    data-testid="input-search-audit"
                  />
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-full sm:w-48" data-testid="select-action-filter">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {uniqueActions.map(action => (
                      <SelectItem key={action} value={action}>
                        {ACTION_LABELS[action] || action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No audit logs found</p>
                <p className="text-sm">
                  {searchTerm || actionFilter !== "all" 
                    ? "Try adjusting your filters" 
                    : "Activity will appear here as it occurs"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => {
                  const Icon = ACTION_ICONS[log.action] || AlertTriangle;
                  const label = ACTION_LABELS[log.action] || log.action;
                  const variant = ACTION_VARIANTS[log.action] || "secondary";

                  return (
                    <div 
                      key={log.id} 
                      className="flex items-start gap-4 p-4 rounded-lg border hover-elevate"
                      data-testid={`audit-log-${log.id}`}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <Icon className="w-5 h-5 text-secondary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={variant}>{label}</Badge>
                          <span className="text-sm text-muted-foreground">
                            on <span className="font-medium">{log.targetType}</span>
                          </span>
                        </div>
                        <div className="mt-1 text-sm">
                          {log.metadata?.deviceName && (
                            <span className="text-foreground">
                              Device: <span className="font-medium">{log.metadata.deviceName}</span>
                            </span>
                          )}
                          {log.metadata?.commandType && (
                            <span className="text-foreground">
                              Command: <span className="font-mono">{log.metadata.commandType}</span>
                            </span>
                          )}
                          {log.metadata?.version && (
                            <span className="text-foreground">
                              Version: <span className="font-mono">v{log.metadata.version}</span>
                            </span>
                          )}
                          {log.metadata?.filename && (
                            <span className="text-foreground">
                              File: <span className="font-mono">{log.metadata.filename}</span>
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          <span className="font-mono text-xs bg-muted px-1 rounded">
                            {log.targetId.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div 
                          className="text-sm text-muted-foreground"
                          title={format(new Date(log.createdAt), "PPpp")}
                        >
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </div>
                        {log.userId && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <User className="w-3 h-3" />
                            <span className="font-mono">{log.userId.slice(0, 8)}...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </OrgLayout>
  );
}
