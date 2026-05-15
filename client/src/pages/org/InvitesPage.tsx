import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OrgLayout } from "./OrgLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Copy, Trash2, Mail, Building2, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface Invite {
  id: string;
  email: string;
  orgName: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  createdOrgId: string | null;
}

interface CreateInviteResponse {
  success: boolean;
  invite: Invite;
  inviteToken: string;
  inviteUrl: string;
}

export default function InvitesPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [newInviteOrgName, setNewInviteOrgName] = useState("");
  const [lastCreatedInvite, setLastCreatedInvite] = useState<CreateInviteResponse | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: invitesData, isLoading } = useQuery<{ invites: Invite[] }>({
    queryKey: ["/api/admin/invites"],
  });

  const { data: adminCheck } = useQuery<{ isSuperAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const createInviteMutation = useMutation({
    mutationFn: async ({ email, orgName }: { email: string; orgName: string }) => {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orgName }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create invite");
      }
      return response.json();
    },
    onSuccess: (data: CreateInviteResponse) => {
      toast({ title: "Invite created!", description: `Invite sent to ${data.invite.email}` });
      setLastCreatedInvite(data);
      setNewInviteEmail("");
      setNewInviteOrgName("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const response = await fetch(`/api/admin/invites/${inviteId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to revoke invite");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Invite revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case "ACCEPTED":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Accepted</Badge>;
      case "EXPIRED":
        return <Badge variant="outline" className="bg-muted text-muted-foreground"><AlertCircle className="w-3 h-3 mr-1" /> Expired</Badge>;
      case "REVOKED":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!adminCheck?.isSuperAdmin) {
    return (
      <OrgLayout>
        <div className="flex items-center justify-center h-64">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You need super admin privileges to manage enterprise invites.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </OrgLayout>
    );
  }

  const invites = invitesData?.invites || [];

  return (
    <OrgLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Enterprise Invites</h1>
            <p className="text-muted-foreground">
              Invite new organizations to join the platform
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-invite">
                <Plus className="w-4 h-4 mr-2" />
                Create Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Enterprise Invite</DialogTitle>
                <DialogDescription>
                  Send an invite to a new enterprise user. They will be able to create their organization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="admin@company.com"
                    value={newInviteEmail}
                    onChange={(e) => setNewInviteEmail(e.target.value)}
                    data-testid="input-invite-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-org-name">Organization Name</Label>
                  <Input
                    id="invite-org-name"
                    placeholder="Acme Corporation"
                    value={newInviteOrgName}
                    onChange={(e) => setNewInviteOrgName(e.target.value)}
                    data-testid="input-invite-org-name"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createInviteMutation.mutate({ email: newInviteEmail, orgName: newInviteOrgName })}
                  disabled={!newInviteEmail.trim() || !newInviteOrgName.trim() || createInviteMutation.isPending}
                  data-testid="button-send-invite"
                >
                  {createInviteMutation.isPending ? "Creating..." : "Send Invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {lastCreatedInvite && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                Invite Created Successfully
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Share this link with <strong>{lastCreatedInvite.invite.email}</strong> to let them create their organization:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={lastCreatedInvite.inviteUrl}
                  readOnly
                  className="font-mono text-sm"
                  data-testid="input-invite-url"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(lastCreatedInvite.inviteUrl)}
                  data-testid="button-copy-invite-url"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLastCreatedInvite(null)}
              >
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Invites</CardTitle>
            <CardDescription>
              {invites.length} invite{invites.length !== 1 ? "s" : ""} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : invites.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No invites yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    data-testid={`invite-row-${invite.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{invite.email}</span>
                          {getStatusBadge(invite.status)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="w-3 h-3" />
                          <span>{invite.orgName}</span>
                          <span className="text-muted-foreground/50">•</span>
                          <span>
                            {invite.status === "ACCEPTED" && invite.acceptedAt
                              ? `Accepted ${new Date(invite.acceptedAt).toLocaleDateString()}`
                              : `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {invite.status === "PENDING" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => revokeInviteMutation.mutate(invite.id)}
                          disabled={revokeInviteMutation.isPending}
                          data-testid={`button-revoke-${invite.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </OrgLayout>
  );
}
