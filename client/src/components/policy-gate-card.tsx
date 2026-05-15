import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldOff, ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface PolicyGateCardProps {
  workspaceId: string;
  reason: 'POLICY_REQUIRED' | 'POLICY_DISABLED';
  workspaceName?: string;
  isAdmin?: boolean;
}

export function PolicyGateCard({ workspaceId, reason, workspaceName, isAdmin }: PolicyGateCardProps) {
  const isPending = reason === 'POLICY_REQUIRED';

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          ) : (
            <div className="p-2 rounded-full bg-muted">
              <ShieldOff className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
              {isPending ? 'Policy Setup Required' : 'AI Answers Disabled'}
              {workspaceName && (
                <Badge variant="outline" className="font-normal" data-testid="badge-workspace-name">
                  {workspaceName}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isPending 
                ? 'This workspace requires policy configuration before AI features can be used.'
                : 'An administrator has disabled AI answers for this workspace.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground space-y-2">
          {isPending ? (
            <>
              <p>
                Organization workspaces require explicit policy activation to ensure responsible use of AI features.
              </p>
              <p>
                <strong>What this means:</strong> Questions about documents in this workspace cannot be answered until 
                an admin configures and activates the policy.
              </p>
            </>
          ) : (
            <p>
              To re-enable AI answers, a workspace administrator must activate the policy in the policy settings.
            </p>
          )}
        </div>
      </CardContent>
      {isAdmin && (
        <CardFooter className="border-t pt-4">
          <Link href={`/policy/${workspaceId}`}>
            <Button data-testid="button-configure-policy">
              Configure Policy
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

interface PolicyGateBannerProps {
  workspaceId: string;
  reason: 'POLICY_REQUIRED' | 'POLICY_DISABLED';
  className?: string;
}

export function PolicyGateBanner({ workspaceId, reason, className }: PolicyGateBannerProps) {
  const isPending = reason === 'POLICY_REQUIRED';

  return (
    <div className={`flex items-center justify-between gap-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 ${className || ''}`}>
      <div className="flex items-center gap-3">
        {isPending ? (
          <Shield className="h-5 w-5 text-amber-500" />
        ) : (
          <ShieldOff className="h-5 w-5 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">
          {isPending 
            ? 'AI answers blocked - policy setup required'
            : 'AI answers disabled by administrator'}
        </span>
      </div>
      <Link href={`/policy/${workspaceId}`}>
        <Button size="sm" variant="outline" data-testid="button-setup-policy">
          {isPending ? 'Setup Policy' : 'View Policy'}
        </Button>
      </Link>
    </div>
  );
}
