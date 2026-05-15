import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldOff, ArrowRight, ArrowLeft, Loader2, FolderOpen } from "lucide-react";
import { Link } from "wouter";

interface Workspace {
  id: string;
  name: string;
  workspaceType: string;
  policyStatus: string;
  policyVersionActive: number | null;
}

export default function PolicyOverview() {
  const [, navigate] = useLocation();

  const { data: workspacesData, isLoading } = useQuery<{ workspaces: Workspace[] }>({
    queryKey: ["/api/premium/workspaces"],
  });

  const workspaces = workspacesData?.workspaces || [];

  const getStatusBadge = (status: string, type: string) => {
    if (type === 'PERSONAL') {
      return <Badge className="bg-emerald-500" data-testid="badge-status-active">Safe Policy</Badge>;
    }
    switch (status) {
      case 'policy_active':
        return <Badge className="bg-emerald-500" data-testid="badge-status-active">Active</Badge>;
      case 'policy_required':
        return <Badge variant="outline" className="text-amber-600 border-amber-600" data-testid="badge-status-pending">Setup Required</Badge>;
      case 'policy_disabled':
        return <Badge variant="secondary" data-testid="badge-status-disabled">Disabled</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-status-unknown">Unknown</Badge>;
    }
  };

  const getStatusIcon = (status: string, type: string) => {
    if (type === 'PERSONAL' || status === 'policy_active') {
      return <ShieldCheck className="h-5 w-5 text-emerald-500" />;
    }
    if (status === 'policy_required') {
      return <Shield className="h-5 w-5 text-amber-500" />;
    }
    return <ShieldOff className="h-5 w-5 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="sm" asChild className="self-start" data-testid="button-back">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
              Policy Settings
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Manage AI answering policies for your workspaces
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="self-start" data-testid="button-go-to-workspace">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go to Workspace
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace Policies</CardTitle>
          <CardDescription>
            Configure how AI responds to questions in each workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspaces.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No workspaces found</p>
              <p className="text-sm text-muted-foreground mt-1">Create a workspace to configure policies</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate"
                  data-testid={`workspace-policy-${ws.id}`}
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(ws.policyStatus, ws.workspaceType)}
                    <div>
                      <p className="font-medium">{ws.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {ws.workspaceType === 'PERSONAL' ? 'Personal workspace' : 'Organization workspace'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(ws.policyStatus, ws.workspaceType)}
                    <Link href={`/policy/${ws.id}`}>
                      <Button variant="ghost" size="sm" data-testid={`button-configure-${ws.id}`}>
                        Configure
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About Workspace Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <p className="font-medium text-foreground">Personal Workspaces</p>
              <p>Automatically have a safe policy applied with citations required, minimum sources, and PII protection.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-medium text-foreground">Organization Workspaces</p>
              <p>Require explicit policy configuration by an admin before AI answers are enabled.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
