import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Building2, CheckCircle, XCircle, Clock, LogIn, Loader2 } from "lucide-react";

interface InviteValidation {
  valid: boolean;
  email?: string;
  orgName?: string;
  expiresAt?: string;
  error?: string;
}

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: inviteData, isLoading: validating, error: validateError } = useQuery<InviteValidation>({
    queryKey: ["/api/invites/validate", token],
    queryFn: async () => {
      const response = await fetch(`/api/invites/validate/${token}`);
      return response.json();
    },
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to accept invite");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Welcome!", 
        description: `You're now the owner of ${data.orgName}` 
      });
      setLocation("/org/agents");
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  if (authLoading || validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Validating invite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteData?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>Invalid Invite</CardTitle>
            <CardDescription>
              {inviteData?.error || "This invite link is not valid."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setLocation("/")} data-testid="button-go-home">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>You're Invited!</CardTitle>
            <CardDescription>
              You've been invited to create <strong>{inviteData.orgName}</strong> on Evident.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground mb-1">This invite is for:</p>
              <p className="font-medium">{inviteData.email}</p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Please sign in with the email address above to accept this invite.
            </p>
            <Button asChild className="w-full" data-testid="button-sign-in">
              <a href="/auth">
                <LogIn className="w-4 h-4 mr-2" />
                Sign in to Accept
              </a>
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
              <Clock className="w-3 h-3" />
              <span>Expires {new Date(inviteData.expiresAt!).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emailMatches = user?.email?.toLowerCase() === inviteData.email?.toLowerCase();

  if (!emailMatches) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-amber-500" />
            </div>
            <CardTitle>Email Mismatch</CardTitle>
            <CardDescription>
              This invite was sent to <strong>{inviteData.email}</strong>, but you're signed in as <strong>{user?.email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Please sign out and sign in with the correct email address.
            </p>
            <Button asChild variant="outline" data-testid="button-sign-out">
              <a href="/auth">
                Sign in with different account
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Accept Your Invite</CardTitle>
          <CardDescription>
            You're about to create <strong>{inviteData.orgName}</strong> and become its owner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-medium">{inviteData.orgName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your Role</span>
              <span className="font-medium">Owner</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{inviteData.email}</span>
            </div>
          </div>
          <Button 
            className="w-full" 
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            data-testid="button-accept-invite"
          >
            {acceptMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Organization...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Accept & Create Organization
              </>
            )}
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <Clock className="w-3 h-3" />
            <span>Expires {new Date(inviteData.expiresAt!).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
