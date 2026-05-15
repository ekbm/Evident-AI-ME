import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileVideo, Clock, User, BarChart3, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface FeatureRequest {
  id: string;
  feature: string;
  details: string | null;
  requestedLimit: string | null;
  userId: string | null;
  userAgent: string | null;
  status: "pending" | "reviewed" | "planned" | "completed";
  createdAt: string;
}

interface FeatureStats {
  feature: string;
  count: number;
}

const featureConfig: Record<string, { icon: typeof FileVideo; label: string; color: string }> = {
  larger_media_upload: { icon: FileVideo, label: "Larger Media Upload", color: "text-purple-500" },
};

const statusConfig = {
  pending: { label: "Pending", variant: "default" as const },
  reviewed: { label: "Reviewed", variant: "secondary" as const },
  planned: { label: "Planned", variant: "outline" as const },
  completed: { label: "Completed", variant: "outline" as const },
};

export default function AdminFeatureRequestsPage() {
  const { toast } = useToast();

  const { data: requests = [], isLoading, error } = useQuery<FeatureRequest[]>({
    queryKey: ["/api/feature-requests"],
  });

  const { data: stats = [] } = useQuery<FeatureStats[]>({
    queryKey: ["/api/feature-requests/stats"],
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/feature-requests/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feature-requests"] });
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

  const summaryStats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    largerMedia: requests.filter((r) => r.feature === "larger_media_upload").length,
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
              <h1 className="text-lg sm:text-xl font-semibold">Feature Requests</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Track user-requested features and improvements
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold" data-testid="text-total-requests">{summaryStats.total}</div>
              <div className="text-sm text-muted-foreground">Total Requests</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600" data-testid="text-pending">{summaryStats.pending}</div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-purple-600" data-testid="text-larger-media">{summaryStats.largerMedia}</div>
              <div className="text-sm text-muted-foreground">Larger Media</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600" data-testid="text-unique-features">{stats.length}</div>
              <div className="text-sm text-muted-foreground">Unique Features</div>
            </CardContent>
          </Card>
        </div>

        {stats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Feature Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.map((stat) => {
                  const config = featureConfig[stat.feature] || { icon: MessageSquare, label: stat.feature, color: "text-muted-foreground" };
                  const Icon = config.icon;
                  return (
                    <div key={stat.feature} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <span className="text-sm font-medium">{config.label}</span>
                      </div>
                      <Badge variant="secondary">{stat.count} requests</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No feature requests yet
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => {
                  const config = featureConfig[request.feature] || { icon: MessageSquare, label: request.feature, color: "text-muted-foreground" };
                  const Icon = config.icon;
                  const statusConf = statusConfig[request.status] || statusConfig.pending;

                  return (
                    <div
                      key={request.id}
                      className="p-4 rounded-lg border bg-card"
                      data-testid={`card-request-${request.id}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Icon className={`h-4 w-4 ${config.color}`} />
                            <span className="font-medium">{config.label}</span>
                            <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
                          </div>

                          {request.details && (
                            <p className="text-sm text-muted-foreground">{request.details}</p>
                          )}

                          {request.requestedLimit && (
                            <div className="text-xs text-muted-foreground">
                              Requested limit: <span className="font-medium">{request.requestedLimit}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(request.createdAt), "MMM d, yyyy h:mm a")}
                            </span>
                            {request.userId && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {request.userId.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          <Select
                            value={request.status}
                            onValueChange={(value) =>
                              updateStatus.mutate({ id: request.id, status: value })
                            }
                          >
                            <SelectTrigger className="w-32" data-testid={`select-status-${request.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="reviewed">Reviewed</SelectItem>
                              <SelectItem value="planned">Planned</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
