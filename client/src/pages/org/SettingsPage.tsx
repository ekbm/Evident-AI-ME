import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Download,
  Key,
  Copy,
  Check,
  RefreshCw,
  Shield,
  Monitor,
  AlertTriangle,
  Clock,
  Apple,
  MonitorSmartphone,
  FileArchive,
  FileText,
  Users,
  UserPlus,
  Trash2,
  Crown,
  ShieldCheck,
  User,
  Pencil,
  X,
  Scale,
  Calculator,
  UserCheck,
  ShoppingCart,
  HardHat,
  ClipboardCheck,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface AgentArtifact {
  id: string;
  name: string;
  filename: string;
}

interface AgentSettingsResponse {
  canDownload: boolean;
  message?: string;
  agentVersion: string;
  seatsUsed: number;
  seatLimit: number;
  recentEvents: any[];
  artifacts: AgentArtifact[];
}

interface OrgMember {
  userId: string;
  role: string;
  createdAt: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  planKey: string | null;
  hasLegalPack?: number | null;
  hasFinancePack?: number | null;
  hasHrPack?: number | null;
  hasProcurementPack?: number | null;
  hasConstructionPack?: number | null;
  hasCompliancePack?: number | null;
}

const PLAN_OPTIONS = [
  { key: "free", label: "Free", description: "0 devices" },
  { key: "pro", label: "Pro", description: "1 device, 500MB" },
  { key: "plus", label: "Plus", description: "3 devices, 2GB" },
  { key: "premium_org", label: "Premium Org", description: "10 devices, 10GB" },
];

const PACK_OPTIONS = [
  { id: "legal", label: "Legal", icon: Scale, color: "text-violet-500" },
  { id: "finance", label: "Finance", icon: Calculator, color: "text-emerald-500" },
  { id: "hr", label: "HR", icon: UserCheck, color: "text-blue-500" },
  { id: "procurement", label: "Procurement", icon: ShoppingCart, color: "text-amber-500" },
  { id: "construction", label: "Construction", icon: HardHat, color: "text-orange-500" },
  { id: "compliance", label: "Compliance", icon: ClipboardCheck, color: "text-cyan-500" },
];

// Normalize legacy plan keys to canonical values
function normalizePlanKey(planKey: string | null | undefined): string {
  if (!planKey) return "free";
  if (planKey === "pro_plus") return "plus";
  return planKey;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleCopy}
      data-testid={`button-copy-${label}`}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 mr-2" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-4 h-4 mr-2" />
          Copy
        </>
      )}
    </Button>
  );
}

function ArtifactIcon({ id }: { id: string }) {
  if (id.includes("windows")) return <MonitorSmartphone className="w-5 h-5" />;
  if (id.includes("macos")) return <Apple className="w-5 h-5" />;
  if (id.includes("it_pack")) return <FileArchive className="w-5 h-5" />;
  return <FileText className="w-5 h-5" />;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: orgContext } = useOrgContext();
  const canGenerate = orgContext?.capabilities?.can_generate_tokens;
  const canDownload = orgContext?.capabilities?.can_download_agent;
  const isOwner = orgContext?.role === "OWNER";

  const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("MEMBER");
  
  // Local user creation state
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserRole, setNewUserRole] = useState("MEMBER");
  const [newUserPlan, setNewUserPlan] = useState("free");
  
  // Intelligence Packs state
  const [hasLegalPack, setHasLegalPack] = useState(false);
  const [hasFinancePack, setHasFinancePack] = useState(false);
  const [hasHrPack, setHasHrPack] = useState(false);
  const [hasProcurementPack, setHasProcurementPack] = useState(false);
  const [hasConstructionPack, setHasConstructionPack] = useState(false);
  const [hasCompliancePack, setHasCompliancePack] = useState(false);
  
  // Member editing state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editedMember, setEditedMember] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    hasLegalPack: boolean;
    hasFinancePack: boolean;
    hasHrPack: boolean;
    hasProcurementPack: boolean;
    hasConstructionPack: boolean;
    hasCompliancePack: boolean;
  } | null>(null);

  const startEditing = (member: OrgMember) => {
    setEditingMemberId(member.userId);
    setEditedMember({
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      email: member.email,
      hasLegalPack: !!member.hasLegalPack,
      hasFinancePack: !!member.hasFinancePack,
      hasHrPack: !!member.hasHrPack,
      hasProcurementPack: !!member.hasProcurementPack,
      hasConstructionPack: !!member.hasConstructionPack,
      hasCompliancePack: !!member.hasCompliancePack,
    });
  };

  const stopEditing = () => {
    setEditingMemberId(null);
    setEditedMember(null);
  };

  const { data: agentSettings, isLoading } = useQuery<AgentSettingsResponse>({
    queryKey: ["/api/org/settings/agents"],
    enabled: !!orgContext?.hasOrg,
  });

  const { data: membersData, isLoading: membersLoading } = useQuery<{ members: OrgMember[] }>({
    queryKey: ["/api/org/members"],
    enabled: !!orgContext?.hasOrg,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const res = await apiRequest("POST", "/api/org/members/invite", { email, role });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message || "Member invited successfully" });
      setInviteEmail("");
      setInviteRole("MEMBER");
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
    },
    onError: async (error: any) => {
      const msg = error?.message || "Failed to invite member";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const createLocalUserMutation = useMutation({
    mutationFn: async (data: { 
      email: string; password: string; firstName: string; lastName: string; role: string; planKey: string;
      hasLegalPack?: boolean; hasFinancePack?: boolean; hasHrPack?: boolean;
      hasProcurementPack?: boolean; hasConstructionPack?: boolean; hasCompliancePack?: boolean;
    }) => {
      const res = await apiRequest("POST", "/api/org/members/local", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message || "User created successfully" });
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserFirstName("");
      setNewUserLastName("");
      setNewUserRole("MEMBER");
      setNewUserPlan("free");
      setHasLegalPack(false);
      setHasFinancePack(false);
      setHasHrPack(false);
      setHasProcurementPack(false);
      setHasConstructionPack(false);
      setHasCompliancePack(false);
      setShowCreateUser(false);
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
    },
    onError: async (error: any) => {
      const msg = error?.message || "Failed to create user";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/org/members/${userId}`, { role });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Role updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
    },
    onError: () => {
      toast({ title: "Failed to update role", variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ userId, planKey }: { userId: string; planKey: string }) => {
      const res = await apiRequest("PATCH", `/api/org/members/${userId}/plan`, { planKey });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Plan updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
    },
    onError: () => {
      toast({ title: "Failed to update plan", variant: "destructive" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ userId, firstName, lastName, email, hasLegalPack, hasFinancePack, hasHrPack, hasProcurementPack, hasConstructionPack, hasCompliancePack }: { 
      userId: string; firstName: string; lastName: string; email: string;
      hasLegalPack?: boolean; hasFinancePack?: boolean; hasHrPack?: boolean;
      hasProcurementPack?: boolean; hasConstructionPack?: boolean; hasCompliancePack?: boolean;
    }) => {
      const res = await apiRequest("PATCH", `/api/org/members/${userId}/profile`, { 
        firstName, lastName, email,
        hasLegalPack, hasFinancePack, hasHrPack, hasProcurementPack, hasConstructionPack, hasCompliancePack 
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile and packs updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packs"] });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/org/members/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Member removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
    },
    onError: () => {
      toast({ title: "Failed to remove member", variant: "destructive" });
    },
  });

  const rotateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/org/enrollment-token");
      return res.json();
    },
    onSuccess: (data) => {
      setEnrollmentToken(data.token);
      toast({ title: "Enrollment token rotated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to rotate token", variant: "destructive" });
    },
  });

  const createPairingCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/org/pairing-code");
      return res.json();
    },
    onSuccess: (data) => {
      setPairingCode({ code: data.code, expiresAt: data.expiresAt });
      toast({ title: "Pairing code created" });
    },
    onError: () => {
      toast({ title: "Failed to create pairing code", variant: "destructive" });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (artifact: string) => {
      const res = await apiRequest("POST", "/api/org/downloads/signed-url", { artifact });
      const data = await res.json();
      window.open(data.url, "_blank");
      return data;
    },
    onError: () => {
      toast({ title: "Failed to generate download link", variant: "destructive" });
    },
  });

  return (
    <OrgLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Organization Settings</h1>
          <p className="text-muted-foreground">
            Manage agent enrollment and downloads
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              Manage who has access to your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isOwner && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Add Team Member</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={showCreateUser ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowCreateUser(true)}
                      data-testid="button-show-create-user"
                    >
                      Create New User
                    </Button>
                    <Button
                      variant={!showCreateUser ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowCreateUser(false)}
                      data-testid="button-show-invite"
                    >
                      Invite Existing
                    </Button>
                  </div>
                </div>

                {showCreateUser ? (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                    <p className="text-sm font-medium">Create a new user with email/password login</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="First name"
                        value={newUserFirstName}
                        onChange={(e) => setNewUserFirstName(e.target.value)}
                        data-testid="input-new-user-firstname"
                      />
                      <Input
                        placeholder="Last name"
                        value={newUserLastName}
                        onChange={(e) => setNewUserLastName(e.target.value)}
                        data-testid="input-new-user-lastname"
                      />
                    </div>
                    <Input
                      placeholder="Email address"
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      data-testid="input-new-user-email"
                    />
                    <Input
                      placeholder="Password (min 6 characters)"
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      data-testid="input-new-user-password"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1">Role</Label>
                        <Select value={newUserRole} onValueChange={setNewUserRole}>
                          <SelectTrigger data-testid="select-new-user-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEMBER">Member</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="OWNER">Owner</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1">Plan</Label>
                        <Select value={newUserPlan} onValueChange={setNewUserPlan}>
                          <SelectTrigger data-testid="select-new-user-plan">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PLAN_OPTIONS.map((plan) => (
                              <SelectItem key={plan.key} value={plan.key}>
                                {plan.label} - {plan.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="border-t pt-3 mt-3">
                      <Label className="text-xs text-muted-foreground mb-2 block">Intelligence Packs</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {PACK_OPTIONS.map((pack) => {
                          const packStates: Record<string, { value: boolean; setter: (v: boolean) => void }> = {
                            legal: { value: hasLegalPack, setter: setHasLegalPack },
                            finance: { value: hasFinancePack, setter: setHasFinancePack },
                            hr: { value: hasHrPack, setter: setHasHrPack },
                            procurement: { value: hasProcurementPack, setter: setHasProcurementPack },
                            construction: { value: hasConstructionPack, setter: setHasConstructionPack },
                            compliance: { value: hasCompliancePack, setter: setHasCompliancePack },
                          };
                          const state = packStates[pack.id];
                          const Icon = pack.icon;
                          return (
                            <label key={pack.id} className="flex items-center gap-2 cursor-pointer p-2 rounded border hover-elevate text-sm">
                              <input
                                type="checkbox"
                                checked={state?.value || false}
                                onChange={(e) => state?.setter(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300"
                                data-testid={`checkbox-pack-${pack.id}`}
                              />
                              <Icon className={`w-3 h-3 ${pack.color}`} />
                              <span className="text-xs">{pack.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    
                    <Button
                      className="w-full"
                      onClick={() => createLocalUserMutation.mutate({
                        email: newUserEmail,
                        password: newUserPassword,
                        firstName: newUserFirstName,
                        lastName: newUserLastName,
                        role: newUserRole,
                        planKey: newUserPlan,
                        hasLegalPack,
                        hasFinancePack,
                        hasHrPack,
                        hasProcurementPack,
                        hasConstructionPack,
                        hasCompliancePack,
                      })}
                      disabled={!newUserEmail || !newUserPassword || newUserPassword.length < 6 || createLocalUserMutation.isPending}
                      data-testid="button-create-user"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      {createLocalUserMutation.isPending ? "Creating..." : "Create User"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Email address"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="flex-1"
                        data-testid="input-invite-email"
                      />
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger className="w-32" data-testid="select-invite-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MEMBER">Member</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="OWNER">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
                        disabled={!inviteEmail || inviteMutation.isPending}
                        data-testid="button-invite-member"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      User must have an account first. They'll get access immediately after being added.
                    </p>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {membersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {membersData?.members.map((member) => (
                  <div
                    key={member.userId}
                    className={`p-3 rounded-lg border ${editingMemberId === member.userId ? 'bg-muted/50' : ''}`}
                    data-testid={`member-${member.userId}`}
                  >
                    {editingMemberId === member.userId && editedMember ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                            {member.role === "OWNER" ? (
                              <Crown className="w-5 h-5 text-amber-500" />
                            ) : member.role === "ADMIN" ? (
                              <ShieldCheck className="w-5 h-5 text-blue-500" />
                            ) : (
                              <User className="w-5 h-5" />
                            )}
                          </div>
                          <span className="text-sm font-medium">Edit Member</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="First Name"
                            value={editedMember.firstName}
                            onChange={(e) => setEditedMember({ ...editedMember, firstName: e.target.value })}
                            data-testid={`input-firstname-${member.userId}`}
                          />
                          <Input
                            placeholder="Last Name"
                            value={editedMember.lastName}
                            onChange={(e) => setEditedMember({ ...editedMember, lastName: e.target.value })}
                            data-testid={`input-lastname-${member.userId}`}
                          />
                        </div>
                        <Input
                          placeholder="Email"
                          type="email"
                          value={editedMember.email}
                          onChange={(e) => setEditedMember({ ...editedMember, email: e.target.value })}
                          data-testid={`input-email-${member.userId}`}
                        />
                        <div className="flex items-center gap-2">
                          <Select
                            value={member.role}
                            onValueChange={(role) => updateRoleMutation.mutate({ userId: member.userId, role })}
                          >
                            <SelectTrigger className="w-28" data-testid={`select-role-${member.userId}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MEMBER">Member</SelectItem>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                              <SelectItem value="OWNER">Owner</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={normalizePlanKey(member.planKey)}
                            onValueChange={(planKey) => updatePlanMutation.mutate({ userId: member.userId, planKey })}
                          >
                            <SelectTrigger className="w-32" data-testid={`select-plan-${member.userId}`}>
                              <SelectValue placeholder="Plan" />
                            </SelectTrigger>
                            <SelectContent>
                              {PLAN_OPTIONS.map((plan) => (
                                <SelectItem key={plan.key} value={plan.key}>
                                  {plan.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Intelligence Packs Section */}
                        <div className="border-t pt-3 mt-2">
                          <Label className="text-sm font-medium mb-2 block">Intelligence Packs</Label>
                          <div className="flex flex-wrap gap-2">
                            {PACK_OPTIONS.map((pack) => {
                              const packKey = `has${pack.id.charAt(0).toUpperCase()}${pack.id.slice(1)}Pack` as keyof typeof editedMember;
                              const isEnabled = editedMember[packKey] as boolean;
                              const Icon = pack.icon;
                              return (
                                <Badge
                                  key={pack.id}
                                  variant={isEnabled ? "default" : "outline"}
                                  className={`cursor-pointer select-none ${isEnabled ? 'bg-primary' : ''}`}
                                  onClick={() => setEditedMember({ ...editedMember, [packKey]: !isEnabled })}
                                  data-testid={`badge-pack-${pack.id}-${member.userId}`}
                                >
                                  <Icon className={`w-3 h-3 mr-1 ${isEnabled ? '' : pack.color}`} />
                                  {pack.label}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              updateProfileMutation.mutate({
                                userId: member.userId,
                                firstName: editedMember.firstName,
                                lastName: editedMember.lastName,
                                email: editedMember.email,
                                hasLegalPack: editedMember.hasLegalPack,
                                hasFinancePack: editedMember.hasFinancePack,
                                hasHrPack: editedMember.hasHrPack,
                                hasProcurementPack: editedMember.hasProcurementPack,
                                hasConstructionPack: editedMember.hasConstructionPack,
                                hasCompliancePack: editedMember.hasCompliancePack,
                              });
                              stopEditing();
                            }}
                            disabled={updateProfileMutation.isPending}
                            data-testid={`button-save-${member.userId}`}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={stopEditing}
                            data-testid={`button-cancel-${member.userId}`}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                            {member.role === "OWNER" ? (
                              <Crown className="w-5 h-5 text-amber-500" />
                            ) : member.role === "ADMIN" ? (
                              <ShieldCheck className="w-5 h-5 text-blue-500" />
                            ) : (
                              <User className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {member.email}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {isOwner ? (
                            <>
                              <Badge variant="secondary">{member.role}</Badge>
                              <Badge variant="outline">
                                {PLAN_OPTIONS.find(p => p.key === normalizePlanKey(member.planKey))?.label || "Free"}
                              </Badge>
                              {/* Show enabled pack badges */}
                              {PACK_OPTIONS.filter(pack => {
                                const packKey = `has${pack.id.charAt(0).toUpperCase()}${pack.id.slice(1)}Pack` as keyof OrgMember;
                                return !!member[packKey];
                              }).map(pack => {
                                const Icon = pack.icon;
                                return (
                                  <Badge key={pack.id} variant="default" className="text-xs">
                                    <Icon className="w-3 h-3 mr-1" />
                                    {pack.label}
                                  </Badge>
                                );
                              })}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEditing(member)}
                                data-testid={`button-edit-${member.userId}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-remove-${member.userId}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {member.email} from the organization. 
                                  They will lose access immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeMemberMutation.mutate(member.userId)}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                              </AlertDialog>
                            </>
                          ) : (
                            <Badge variant="secondary">{member.role}</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Enrollment
              </CardTitle>
              <CardDescription>
                Generate tokens and codes to enroll new devices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Enrollment Token</h3>
                    <p className="text-sm text-muted-foreground">
                      Long-lived token for automated deployments
                    </p>
                  </div>
                  {canGenerate && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          disabled={rotateTokenMutation.isPending}
                          data-testid="button-rotate-token"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Rotate Token
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Rotate Enrollment Token?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will invalidate the current token. Any deployments using the 
                            old token will no longer be able to enroll new devices.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => rotateTokenMutation.mutate()}>
                            Rotate Token
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                {enrollmentToken && (
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs font-mono break-all">
                        {enrollmentToken}
                      </code>
                      <CopyButton value={enrollmentToken} label="enrollment-token" />
                    </div>
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Save this token securely. It will not be shown again.
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Pairing Code</h3>
                    <p className="text-sm text-muted-foreground">
                      One-time code that expires in 10 minutes
                    </p>
                  </div>
                  {canGenerate && (
                    <Button 
                      variant="outline" 
                      onClick={() => createPairingCodeMutation.mutate()}
                      disabled={createPairingCodeMutation.isPending}
                      data-testid="button-create-pairing-code"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Generate Code
                    </Button>
                  )}
                </div>

                {pairingCode && (
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-2xl font-mono font-bold tracking-widest">
                        {pairingCode.code}
                      </code>
                      <CopyButton value={pairingCode.code} label="pairing-code" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires at {new Date(pairingCode.expiresAt).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Seat Usage
              </CardTitle>
              <CardDescription>
                Your organization's device enrollment limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-24" />
              ) : agentSettings && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">
                      {agentSettings.seatsUsed} / {agentSettings.seatLimit}
                    </span>
                    <Badge variant="secondary">
                      {Math.round((agentSettings.seatsUsed / agentSettings.seatLimit) * 100)}% used
                    </Badge>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div 
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ 
                        width: `${Math.min((agentSettings.seatsUsed / agentSettings.seatLimit) * 100, 100)}%` 
                      }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {agentSettings.seatLimit - agentSettings.seatsUsed} seats remaining
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Agent Downloads
            </CardTitle>
            <CardDescription>
              Download installers for Windows and macOS. IT admins install the agent once per machine, 
              but each user's folder access is based on their own permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!canDownload ? (
              <div className="text-center py-6 text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{agentSettings?.message || "Agent downloads are restricted to administrators."}</p>
              </div>
            ) : isLoading ? (
              <div className="grid md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                  <p className="font-medium mb-1">How It Works</p>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    <li>1. IT admin installs the agent with admin privileges</li>
                    <li>2. A background service handles enrollment and server communication</li>
                    <li>3. Each user gets a personal agent that only accesses their allowed folders</li>
                    <li>4. User credentials are stored securely per-user (Keychain/Credential Manager)</li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <MonitorSmartphone className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Windows Demo Agent</div>
                        <div className="text-sm text-muted-foreground">
                          PowerShell script for testing enrollment flow
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => window.open("/downloads/evident-agent-demo.ps1", "_blank")}
                      data-testid="button-download-demo"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Demo
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Run in PowerShell as Administrator. Uses enrollment tokens from the Enrollment section above.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {agentSettings?.artifacts.map((artifact) => (
                    <div 
                      key={artifact.id} 
                      className="flex items-center justify-between p-4 rounded-lg border opacity-60"
                      data-testid={`artifact-${artifact.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                          <ArtifactIcon id={artifact.id} />
                        </div>
                        <div>
                          <div className="font-medium">{artifact.name}</div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {artifact.filename}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary">Coming Soon</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Full MSI/PKG installers are in development. Use the Demo Agent above for testing.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </OrgLayout>
  );
}
