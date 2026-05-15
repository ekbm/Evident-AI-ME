import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Building2, Edit, AlertTriangle, LogIn, Scale, Calculator, UserCheck, ShoppingCart, HardHat, ClipboardCheck, Plus, Activity, CheckCircle2, XCircle, Clock, Cpu, Database, ArrowLeft, Gift, Percent, Upload, Settings, Server, ListTodo, Sparkles, MessageSquare, DollarSign, Star, BarChart3, Mail, FileCheck, Globe, TrendingUp, HelpCircle, HeartPulse, GraduationCap } from "lucide-react";
import { Link } from "wouter";

interface UserWithDetails {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  authProvider: string | null;
  userGroup: string | null;
  signupSource: string | null;
  createdAt: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  entitlement: {
    planKey: string;
    deviceLimit: number;
    maxIndexedGb: number | null;
    hasLegalPack: number;
    hasFinancePack: number;
    hasHrPack: number;
    hasProcurementPack: number;
    hasConstructionPack: number;
    hasCompliancePack: number;
  } | null;
  subscription: {
    status: string;
    planKey: string;
  } | null;
  organization: {
    orgId: string;
    orgName: string;
    orgPlan: string;
    role: string;
  } | null;
  healthAccess: boolean | null;
}

interface OrgWithDetails {
  id: string;
  name: string;
  plan: string;
  planDeviceLimit: number;
  createdAt: string | null;
  memberCount: number;
}

interface RequestLogEntry {
  path: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: number;
  datetime: string;
}

interface ProcessingLogEntry {
  type: string;
  duration: number;
  success: boolean;
  fileSize?: number;
  error?: string;
  timestamp: number;
  datetime: string;
}

interface SystemMetrics {
  health: 'healthy' | 'warning' | 'critical';
  warnings: string[];
  uptime: number;
  serverStartTime?: string;
  requests: {
    lastMinute: number;
    avgResponseTime: number;
    slowRequests: number;
    criticalSlowRequests: number;
    errorRate: string;
    recentLog?: RequestLogEntry[];
  };
  processing: {
    lastFiveMinutes: number;
    avgProcessingTime: number;
    errorRate: string;
    byType: {
      document: number;
      embedding: number;
      chat: number;
      vision: number;
      transcription: number;
    };
    recentLog?: ProcessingLogEntry[];
  };
  errors: {
    lastFiveMinutes: number;
    rateLimitErrors: number;
    recent: Array<{
      message: string;
      type: string;
      ago: string;
      timestamp?: number;
      datetime?: string;
    }>;
  };
  memory: {
    usedMB: number;
    totalMB: number;
    rssMB?: number;
    percentage: number;
    explanation?: string;
  };
  capacity?: {
    peakMemoryMB: number;
    peakRequestsPerMinute: number;
    peakResponseTimeMs: number;
    estimatedMaxConcurrent: number;
    containerLimitMB: number;
    utilizationPercent: number;
  };
  pythonService?: {
    isConfigured: boolean;
    isHealthy: boolean;
    serviceUrl: string;
    totalCalls: number;
    recentCalls: number;
    successCount: number;
    failedCount: number;
    successRate: string;
    avgResponseTime: number;
    forcePythonService: boolean;
    forcePythonServiceEnabledAt: string | null;
    forcePythonServiceEnabledBy: string | null;
    byEndpoint: Record<string, { total: number; success: number; failed: number; avgTime: number }>;
    byDocumentType: Record<string, { count: number; avgTime: number; errors: number }>;
    recentErrors: Array<{
      endpoint: string;
      error: string;
      ago: string;
      statusCode?: number;
    }>;
  };
  apiCosts?: {
    breakdown: {
      embeddings: { count: number; cost: number };
      chat: { count: number; cost: number };
      vision: { count: number; cost: number };
      transcription: { minutes: number; cost: number };
      perplexity: { requests: number; cost: number };
    };
    totalSinceStart: number;
    projectedMonthly: number;
    uptimeDays: number;
    rates: Record<string, number>;
  };
}

interface AbuseUserStats {
  userId: string;
  documentsCount: number;
  questionsTotal: number;
  questionsHourCount: number;
  totalUploads: number;
  last24hUploads: number;
  lastHourUploads: number;
  duplicateAttempts: number;
  flags: string[];
  isFlagged: boolean;
  createdAt: string | null;
}

interface AbuseMonitoringData {
  summary: {
    totalUsers: number;
    flaggedUsers: number;
    totalUploads24h: number;
    totalQuestions: number;
    lastUpdated: string;
  };
  flaggedUsers: AbuseUserStats[];
  allUsers: AbuseUserStats[];
}

interface ErrorRewardStats {
  total: number;
  claimed: number;
  bonusUploads: number;
  discountCodes: number;
  byErrorType: { errorType: string; count: number }[];
}

interface ProcessingStats {
  total: number;
  pending: number;
  processing: number;
  success: number;
  failed: number;
  retrying: number;
  byMimeType: Record<string, { total: number; success: number; failed: number }>;
  byErrorCode: Record<string, number>;
  byExtractionMethod: Record<string, number>;
  recentSuccesses: Array<{
    id: string;
    assetId: string;
    filename: string;
    mime: string;
    extractionMethod: string | null;
    textLength: number;
    createdAt: string | null;
  }>;
  recentFailures: Array<{
    id: string;
    assetId: string;
    filename: string;
    mime: string;
    errorCode: string | null;
    errorMessage: string | null;
    retryCount: number;
    createdAt: string | null;
  }>;
  autoHealingStats: {
    totalHealed: number;
    healedToday: number;
    pendingRetries: number;
  };
}

const PLAN_OPTIONS = [
  { value: "free", label: "Free", deviceLimit: 0, maxIndexedGb: 0 },
  { value: "starter", label: "Evident Lite", deviceLimit: 1, maxIndexedGb: 1 },
  { value: "scholar", label: "Evident Scholar", deviceLimit: 1, maxIndexedGb: 1 },
  { value: "pro", label: "Evident Advanced", deviceLimit: 1, maxIndexedGb: 1 },
  { value: "pro_plus", label: "Evident Max", deviceLimit: 3, maxIndexedGb: 5 },
];

const PACK_OPTIONS = [
  { id: "legal", label: "Legal Pack", icon: Scale, color: "text-violet-500" },
  { id: "finance", label: "Finance Pack", icon: Calculator, color: "text-emerald-500" },
  { id: "hr", label: "HR Pack", icon: UserCheck, color: "text-blue-500" },
  { id: "procurement", label: "Procurement Pack", icon: ShoppingCart, color: "text-amber-500" },
  { id: "construction", label: "Construction Pack", icon: HardHat, color: "text-orange-500" },
  { id: "compliance", label: "Compliance Pack", icon: ClipboardCheck, color: "text-cyan-500" },
];

function PythonServiceForceToggle({ 
  isForced, 
  enabledAt, 
  enabledBy,
  isConfigured 
}: { 
  isForced: boolean; 
  enabledAt: string | null; 
  enabledBy: string | null;
  isConfigured: boolean;
}) {
  const { toast } = useToast();
  const [isToggling, setIsToggling] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("POST", "/api/admin/python-service/force", { enabled });
    },
    onSuccess: (_, enabled) => {
      toast({ 
        title: enabled ? "Force Python Service Enabled" : "Force Python Service Disabled",
        description: enabled 
          ? "All documents will now be processed through Python service" 
          : "Normal processing resumed"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/metrics"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to toggle Python service", 
        description: error?.message || "An error occurred",
        variant: "destructive" 
      });
    },
    onSettled: () => {
      setIsToggling(false);
    }
  });

  const handleToggle = (checked: boolean) => {
    setIsToggling(true);
    toggleMutation.mutate(checked);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Label htmlFor="force-python" className="text-sm">
          Force Python Processing
        </Label>
        <Switch
          id="force-python"
          checked={isForced}
          onCheckedChange={handleToggle}
          disabled={!isConfigured || isToggling || toggleMutation.isPending}
          data-testid="switch-force-python"
        />
      </div>
      {isForced && enabledAt && (
        <span className="text-xs text-muted-foreground">
          Enabled {new Date(enabledAt).toLocaleTimeString()} by {enabledBy || 'admin'}
        </span>
      )}
    </div>
  );
}

function EditUserDialog({ user, orgs, onClose }: { user: UserWithDetails; orgs: OrgWithDetails[]; onClose: () => void }) {
  const { toast } = useToast();
  const [planKey, setPlanKey] = useState(user.entitlement?.planKey || "free");
  const [deviceLimit, setDeviceLimit] = useState(user.entitlement?.deviceLimit?.toString() || "0");
  const [maxIndexedGb, setMaxIndexedGb] = useState(user.entitlement?.maxIndexedGb?.toString() || "0");
  
  const [hasLegalPack, setHasLegalPack] = useState(!!user.entitlement?.hasLegalPack);
  const [hasFinancePack, setHasFinancePack] = useState(!!user.entitlement?.hasFinancePack);
  const [hasHrPack, setHasHrPack] = useState(!!user.entitlement?.hasHrPack);
  const [hasProcurementPack, setHasProcurementPack] = useState(!!user.entitlement?.hasProcurementPack);
  const [hasConstructionPack, setHasConstructionPack] = useState(!!user.entitlement?.hasConstructionPack);
  const [hasCompliancePack, setHasCompliancePack] = useState(!!user.entitlement?.hasCompliancePack);

  const [selectedOrgId, setSelectedOrgId] = useState<string>(user.organization?.orgId || "none");
  const [selectedRole, setSelectedRole] = useState<string>(user.organization?.role || "MEMBER");
  const [userGroup, setUserGroup] = useState<string>(user.userGroup || "external");

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/admin/users/${user.id}/entitlements`, {
        planKey,
        deviceLimit: parseInt(deviceLimit),
        maxIndexedGb: parseInt(maxIndexedGb),
        hasLegalPack,
        hasFinancePack,
        hasHrPack,
        hasProcurementPack,
        hasConstructionPack,
        hasCompliancePack,
      });
    },
    onSuccess: () => {
      toast({ title: "User entitlements updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: () => {
      toast({ title: "Failed to update entitlements", variant: "destructive" });
    },
  });

  const orgMembershipMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/admin/users/${user.id}/org-membership`, {
        orgId: selectedOrgId === "none" ? null : selectedOrgId,
        role: selectedRole,
      });
    },
    onSuccess: () => {
      toast({ title: "Organization membership updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orgs"] });
    },
    onError: () => {
      toast({ title: "Failed to update org membership", variant: "destructive" });
    },
  });

  const userGroupMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/admin/users/${user.id}/user-group`, {
        userGroup,
      });
    },
    onSuccess: () => {
      toast({ title: "User group updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: () => {
      toast({ title: "Failed to update user group", variant: "destructive" });
    },
  });

  const handleSave = async () => {
    await updateMutation.mutateAsync();
    await orgMembershipMutation.mutateAsync();
    if (userGroup !== (user.userGroup || "external")) {
      await userGroupMutation.mutateAsync();
    }
    onClose();
  };

  const handlePlanChange = (value: string) => {
    setPlanKey(value);
    const plan = PLAN_OPTIONS.find(p => p.value === value);
    if (plan) {
      setDeviceLimit(plan.deviceLimit.toString());
      setMaxIndexedGb(plan.maxIndexedGb.toString());
    }
  };

  const packStates = [
    { id: "legal", value: hasLegalPack, setter: setHasLegalPack },
    { id: "finance", value: hasFinancePack, setter: setHasFinancePack },
    { id: "hr", value: hasHrPack, setter: setHasHrPack },
    { id: "procurement", value: hasProcurementPack, setter: setHasProcurementPack },
    { id: "construction", value: hasConstructionPack, setter: setHasConstructionPack },
    { id: "compliance", value: hasCompliancePack, setter: setHasCompliancePack },
  ];

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Edit User Entitlements</DialogTitle>
        <DialogDescription>
          {user.email} ({user.firstName} {user.lastName})
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="space-y-2">
          <Label>Plan</Label>
          <Select value={planKey} onValueChange={handlePlanChange}>
            <SelectTrigger data-testid="select-plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_OPTIONS.map(plan => (
                <SelectItem key={plan.value} value={plan.value}>
                  {plan.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Device Limit</Label>
          <Input
            type="number"
            value={deviceLimit}
            onChange={(e) => setDeviceLimit(e.target.value)}
            data-testid="input-device-limit"
          />
        </div>
        <div className="space-y-2">
          <Label>Max Indexed Storage (GB)</Label>
          <Input
            type="number"
            value={maxIndexedGb}
            onChange={(e) => setMaxIndexedGb(e.target.value)}
            data-testid="input-max-storage"
          />
        </div>
        
        <div className="border-t pt-4">
          <Label className="text-base font-semibold">Intelligence Packs</Label>
          <p className="text-sm text-muted-foreground mb-3">
            Grant individual pack access (independent of plan)
          </p>
          <div className="space-y-3">
            {PACK_OPTIONS.map((pack) => {
              const state = packStates.find(s => s.id === pack.id);
              const Icon = pack.icon;
              return (
                <div key={pack.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${pack.color}`} />
                    <span className="text-sm">{pack.label}</span>
                  </div>
                  <Switch
                    checked={state?.value || false}
                    onCheckedChange={(checked) => state?.setter(checked)}
                    data-testid={`switch-pack-${pack.id}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t pt-4">
          <Label className="text-base font-semibold">User Group</Label>
          <p className="text-sm text-muted-foreground mb-3">
            External = self-registered, Evident = admin-created/internal
          </p>
          <Select value={userGroup} onValueChange={setUserGroup}>
            <SelectTrigger data-testid="select-user-group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="external">External (self-registered)</SelectItem>
              <SelectItem value="evident">Evident (internal team)</SelectItem>
              <SelectItem value="local">Local (legacy admin-created)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border-t pt-4">
          <Label className="text-base font-semibold">Organization Membership</Label>
          <p className="text-sm text-muted-foreground mb-3">
            Assign user to an organization with a role
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger data-testid="select-org">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Organization</SelectItem>
                  {orgs.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedOrgId !== "none" && (
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OWNER">Owner</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          disabled={updateMutation.isPending || orgMembershipMutation.isPending || userGroupMutation.isPending}
          data-testid="button-save-entitlements"
        >
          Save Changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditOrgDialog({ org, onClose }: { org: OrgWithDetails; onClose: () => void }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState(org.plan);
  const [planDeviceLimit, setPlanDeviceLimit] = useState(org.planDeviceLimit.toString());

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/admin/orgs/${org.id}`, {
        plan,
        planDeviceLimit: parseInt(planDeviceLimit),
      });
    },
    onSuccess: () => {
      toast({ title: "Organization updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orgs"] });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to update organization", variant: "destructive" });
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit Organization</DialogTitle>
        <DialogDescription>{org.name}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Plan</Label>
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger data-testid="select-org-plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="pro_plus">Pro Plus</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Device Limit</Label>
          <Input
            type="number"
            value={planDeviceLimit}
            onChange={(e) => setPlanDeviceLimit(e.target.value)}
            data-testid="input-org-device-limit"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={() => updateMutation.mutate()} 
          disabled={updateMutation.isPending}
          data-testid="button-save-org"
        >
          Save Changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CreateUserDialog({ onClose, orgs }: { onClose: () => void; orgs?: OrgWithDetails[] }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [planKey, setPlanKey] = useState("free");
  const [deviceLimit, setDeviceLimit] = useState("0");
  const [maxIndexedGb, setMaxIndexedGb] = useState("0");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [orgRole, setOrgRole] = useState<string>("MEMBER");
  
  const [hasLegalPack, setHasLegalPack] = useState(false);
  const [hasFinancePack, setHasFinancePack] = useState(false);
  const [hasHrPack, setHasHrPack] = useState(false);
  const [hasProcurementPack, setHasProcurementPack] = useState(false);
  const [hasConstructionPack, setHasConstructionPack] = useState(false);
  const [hasCompliancePack, setHasCompliancePack] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/users", {
        email,
        password,
        firstName,
        lastName,
        planKey,
        deviceLimit: parseInt(deviceLimit),
        maxIndexedGb: parseInt(maxIndexedGb),
        hasLegalPack,
        hasFinancePack,
        hasHrPack,
        hasProcurementPack,
        hasConstructionPack,
        hasCompliancePack,
        orgId: selectedOrgId || undefined,
        orgRole: selectedOrgId ? orgRole : undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "User created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orgs"] });
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create user", 
        description: error?.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  const handlePlanChange = (value: string) => {
    setPlanKey(value);
    const plan = PLAN_OPTIONS.find(p => p.value === value);
    if (plan) {
      setDeviceLimit(plan.deviceLimit.toString());
      setMaxIndexedGb(plan.maxIndexedGb.toString());
    }
  };

  const packStates = [
    { id: "legal", value: hasLegalPack, setter: setHasLegalPack },
    { id: "finance", value: hasFinancePack, setter: setHasFinancePack },
    { id: "hr", value: hasHrPack, setter: setHasHrPack },
    { id: "procurement", value: hasProcurementPack, setter: setHasProcurementPack },
    { id: "construction", value: hasConstructionPack, setter: setHasConstructionPack },
    { id: "compliance", value: hasCompliancePack, setter: setHasCompliancePack },
  ];

  return (
    <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Create New User</DialogTitle>
        <DialogDescription>
          Add a new user with email/password authentication
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4 pr-1">
        <div className="space-y-2">
          <Label>Email *</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            data-testid="input-create-email"
          />
        </div>
        <div className="space-y-2">
          <Label>Password *</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            data-testid="input-create-password"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>First Name</Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              data-testid="input-create-firstname"
            />
          </div>
          <div className="space-y-2">
            <Label>Last Name</Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              data-testid="input-create-lastname"
            />
          </div>
        </div>
        
        <div className="border-t pt-4">
          <Label className="text-base font-semibold">Plan & Limits</Label>
          <div className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={planKey} onValueChange={handlePlanChange}>
                <SelectTrigger data-testid="select-create-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map(plan => (
                    <SelectItem key={plan.value} value={plan.value}>
                      {plan.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Device Limit</Label>
                <Input
                  type="number"
                  value={deviceLimit}
                  onChange={(e) => setDeviceLimit(e.target.value)}
                  data-testid="input-create-device-limit"
                />
              </div>
              <div className="space-y-2">
                <Label>Storage (GB)</Label>
                <Input
                  type="number"
                  value={maxIndexedGb}
                  onChange={(e) => setMaxIndexedGb(e.target.value)}
                  data-testid="input-create-storage"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t pt-4">
          <Label className="text-base font-semibold">Intelligence Packs</Label>
          <p className="text-xs text-muted-foreground mb-2">Add-on packs (independent of plan)</p>
          <div className="grid grid-cols-2 gap-2">
            {PACK_OPTIONS.map((pack) => {
              const state = packStates.find(s => s.id === pack.id);
              const Icon = pack.icon;
              return (
                <label key={pack.id} className="flex items-center gap-2 cursor-pointer p-2 rounded border hover-elevate">
                  <input
                    type="checkbox"
                    checked={state?.value || false}
                    onChange={(e) => state?.setter(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                    data-testid={`checkbox-create-pack-${pack.id}`}
                  />
                  <Icon className={`w-3 h-3 ${pack.color}`} />
                  <span className="text-xs">{pack.label.replace(' Pack', '')}</span>
                </label>
              );
            })}
          </div>
        </div>

        {orgs && orgs.length > 0 && (
          <div className="border-t pt-4">
            <Label className="text-base font-semibold">Organization Assignment</Label>
            <p className="text-xs text-muted-foreground mb-2">Optionally assign user to an organization</p>
            <div className="space-y-3 mt-3">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger data-testid="select-create-org">
                    <SelectValue placeholder="No organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No organization</SelectItem>
                    {orgs.map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedOrgId && (
                <div className="space-y-2">
                  <Label>Role in Organization</Label>
                  <Select value={orgRole} onValueChange={setOrgRole}>
                    <SelectTrigger data-testid="select-create-org-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="OWNER">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={() => createMutation.mutate()} 
          disabled={createMutation.isPending || !email || !password}
          data-testid="button-create-user"
        >
          Create User
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function AdminPage() {
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<UserWithDetails | null>(null);
  const [editingOrg, setEditingOrg] = useState<OrgWithDetails | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [userGroupFilter, setUserGroupFilter] = useState<"all" | "external" | "evident">("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<"all" | "today" | "week" | "month" | "quarter">("all");

  const { data: adminCheck, isLoading: checkingAdmin } = useQuery<{ isLoggedIn: boolean; isSuperAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const { data: usersData, isLoading: loadingUsers } = useQuery<{ users: UserWithDetails[] }>({
    queryKey: ["/api/admin/users"],
    enabled: adminCheck?.isSuperAdmin === true,
  });

  const healthAccessMutation = useMutation({
    mutationFn: ({ userId, enabled }: { userId: string; enabled: boolean }) =>
      apiRequest("PATCH", `/api/admin/users/${userId}/health-access`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Health access updated" });
    },
    onError: () => {
      toast({ title: "Failed to update health access", variant: "destructive" });
    },
  });

  const { data: orgsData, isLoading: loadingOrgs } = useQuery<{ orgs: OrgWithDetails[] }>({
    queryKey: ["/api/admin/orgs"],
    enabled: adminCheck?.isSuperAdmin === true,
  });

  const { data: metricsData, isLoading: loadingMetrics, refetch: refetchMetrics } = useQuery<SystemMetrics>({
    queryKey: ["/api/admin/metrics"],
    enabled: adminCheck?.isSuperAdmin === true,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: rewardStats } = useQuery<ErrorRewardStats>({
    queryKey: ["/api/error-rewards/stats"],
    enabled: adminCheck?.isSuperAdmin === true,
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: abuseData, isLoading: loadingAbuse, refetch: refetchAbuse } = useQuery<AbuseMonitoringData>({
    queryKey: ["/api/admin/abuse-monitoring"],
    enabled: adminCheck?.isSuperAdmin === true,
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: processingStats, isLoading: loadingProcessing, refetch: refetchProcessing } = useQuery<ProcessingStats>({
    queryKey: ["/api/admin/processing-stats"],
    enabled: adminCheck?.isSuperAdmin === true,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate date thresholds for filtering
  const getDateThreshold = (range: string): Date | null => {
    const now = new Date();
    switch (range) {
      case "today":
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case "week":
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return weekAgo;
      case "month":
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return monthAgo;
      case "quarter":
        const quarterAgo = new Date(now);
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        return quarterAgo;
      default:
        return null;
    }
  };

  // Calculate onboarding stats
  const onboardingStats = usersData?.users ? (() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    let today = 0, thisWeek = 0, thisMonth = 0;
    usersData.users.forEach(u => {
      if (!u.createdAt) return;
      const created = new Date(u.createdAt);
      if (created >= todayStart) today++;
      if (created >= weekAgo) thisWeek++;
      if (created >= monthAgo) thisMonth++;
    });
    return { today, thisWeek, thisMonth, total: usersData.users.length };
  })() : { today: 0, thisWeek: 0, thisMonth: 0, total: 0 };

  // Filter users by plan, group, and date
  const filteredUsers = usersData?.users.filter((user: UserWithDetails) => {
    // Filter by user group
    if (userGroupFilter !== "all") {
      const group = user.userGroup || "external";
      // "evident" filter matches both "local" and "evident" in database
      if (userGroupFilter === "evident") {
        if (group !== "local" && group !== "evident") return false;
      } else {
        if (group !== userGroupFilter) return false;
      }
    }
    // Filter by plan
    if (planFilter !== "all") {
      const userPlan = user.entitlement?.planKey || "free";
      if (userPlan !== planFilter) return false;
    }
    // Filter by date range
    if (dateRangeFilter !== "all") {
      const threshold = getDateThreshold(dateRangeFilter);
      if (threshold && user.createdAt) {
        const userDate = new Date(user.createdAt);
        if (userDate < threshold) return false;
      } else if (!user.createdAt) {
        return false; // Exclude users without signup date when date filter is active
      }
    }
    return true;
  }) || [];
  
  // Count users by group (both "local" and "evident" are internal users)
  const externalUsersCount = usersData?.users.filter(u => (u.userGroup || "external") === "external").length || 0;
  const evidentUsersCount = usersData?.users.filter(u => u.userGroup === "local" || u.userGroup === "evident").length || 0;

  if (checkingAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!adminCheck?.isLoggedIn) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <LogIn className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-4">
              Please log in to access the admin panel.
            </p>
            <Link href="/auth">
              <Button data-testid="button-go-login">Log In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!adminCheck?.isSuperAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You don't have permission to access the admin panel.
            </p>
            <Link href="/">
              <Button data-testid="button-go-home">Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">Manage users, plans, and organizations</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/roadmap">
            <Button variant="default" className="gap-2" data-testid="button-roadmap-features">
              <Sparkles className="w-4 h-4" />
              Roadmap Features
            </Button>
          </Link>
          <Link href="/admin/scan-leads">
            <Button variant="secondary" className="gap-2" data-testid="button-scan-leads">
              <Users className="w-4 h-4" />
              Scan Leads
            </Button>
          </Link>
          <Link href="/admin/feedback">
            <Button variant="secondary" className="gap-2" data-testid="button-trial-feedback">
              <MessageSquare className="w-4 h-4" />
              Feedback
            </Button>
          </Link>
          <Link href="/admin/user-surveys">
            <Button variant="secondary" className="gap-2" data-testid="button-user-surveys">
              <Star className="w-4 h-4" />
              User Surveys
            </Button>
          </Link>
          <Link href="/admin/pilot-students">
            <Button variant="secondary" className="gap-2" data-testid="button-pilot-students">
              <GraduationCap className="w-4 h-4" />
              Student Pilot
            </Button>
          </Link>
          <Link href="/admin/queue">
            <Button variant="secondary" className="gap-2" data-testid="button-queue-management">
              <ListTodo className="w-4 h-4" />
              Queue Management
            </Button>
          </Link>
          <Link href="/full">
            <Button variant="outline" className="gap-2" data-testid="button-back-workspace">
              <ArrowLeft className="w-4 h-4" />
              Back to Workspace
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2" data-testid="tab-plans">
            <Settings className="w-4 h-4" />
            Plan Rules
          </TabsTrigger>
          <TabsTrigger value="orgs" className="gap-2" data-testid="tab-orgs">
            <Building2 className="w-4 h-4" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2" data-testid="tab-metrics">
            <Activity className="w-4 h-4" />
            System Health
          </TabsTrigger>
          <TabsTrigger value="abuse" className="gap-2" data-testid="tab-abuse">
            <AlertTriangle className="w-4 h-4" />
            Abuse Monitor
          </TabsTrigger>
          <TabsTrigger value="healing" className="gap-2" data-testid="tab-healing">
            <Server className="w-4 h-4" />
            Self-Healing
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2" data-testid="tab-insights">
            <BarChart3 className="w-4 h-4" />
            User Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6 space-y-4">
          {/* Onboarding Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card 
              className={`p-3 cursor-pointer ${dateRangeFilter === "today" ? "border-primary ring-1 ring-primary" : ""}`}
              onClick={() => setDateRangeFilter(dateRangeFilter === "today" ? "all" : "today")}
              data-testid="card-filter-signups-today"
            >
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{onboardingStats.today}</div>
              <div className="text-xs text-muted-foreground">Signed Up Today</div>
            </Card>
            <Card 
              className={`p-3 cursor-pointer ${dateRangeFilter === "week" ? "border-primary ring-1 ring-primary" : ""}`}
              onClick={() => setDateRangeFilter(dateRangeFilter === "week" ? "all" : "week")}
              data-testid="card-filter-signups-week"
            >
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{onboardingStats.thisWeek}</div>
              <div className="text-xs text-muted-foreground">This Week</div>
            </Card>
            <Card 
              className={`p-3 cursor-pointer ${dateRangeFilter === "month" ? "border-primary ring-1 ring-primary" : ""}`}
              onClick={() => setDateRangeFilter(dateRangeFilter === "month" ? "all" : "month")}
              data-testid="card-filter-signups-month"
            >
              <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{onboardingStats.thisMonth}</div>
              <div className="text-xs text-muted-foreground">This Month</div>
            </Card>
            <Card 
              className={`p-3 cursor-pointer ${dateRangeFilter === "all" ? "border-primary ring-1 ring-primary" : ""}`}
              onClick={() => setDateRangeFilter("all")}
              data-testid="card-filter-signups-all"
            >
              <div className="text-2xl font-bold">{onboardingStats.total}</div>
              <div className="text-xs text-muted-foreground">Total Users</div>
            </Card>
          </div>

          {/* User Group Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={userGroupFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setUserGroupFilter("all")}
              data-testid="button-filter-all-users"
            >
              All Users ({usersData?.users.length || 0})
            </Button>
            <Button
              variant={userGroupFilter === "external" ? "default" : "outline"}
              size="sm"
              onClick={() => setUserGroupFilter("external")}
              data-testid="button-filter-external-users"
            >
              External ({externalUsersCount})
            </Button>
            <Button
              variant={userGroupFilter === "evident" ? "default" : "outline"}
              size="sm"
              onClick={() => setUserGroupFilter("evident")}
              data-testid="button-filter-evident-users"
            >
              Evident Users ({evidentUsersCount})
            </Button>
            <Select value={dateRangeFilter} onValueChange={(v: "all" | "today" | "week" | "month" | "quarter") => setDateRangeFilter(v)}>
              <SelectTrigger className="w-32 text-xs" data-testid="select-date-filter">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="quarter">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Plan Summary Cards */}
          {usersData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {(() => {
                const planCounts: Record<string, number> = {};
                usersData.users.forEach(u => {
                  const plan = u.entitlement?.planKey || "free";
                  planCounts[plan] = (planCounts[plan] || 0) + 1;
                });
                const plans = ["free", "starter", "scholar", "pro", "pro_plus"];
                const planLabels: Record<string, string> = { free: "Free", starter: "Evident Lite", scholar: "Evident Scholar", pro: "Evident Advanced", pro_plus: "Evident Max" };
                return plans.map(plan => (
                  <Card key={plan} className="p-3 cursor-pointer hover:border-primary/50" onClick={() => setPlanFilter(planFilter === plan ? "all" : plan)}>
                    <div className="text-2xl font-bold">{planCounts[plan] || 0}</div>
                    <div className="text-xs text-muted-foreground">{planLabels[plan]}</div>
                  </Card>
                ));
              })()}
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <div className="flex items-center gap-4">
                <div>
                  <CardTitle className="text-lg">
                    {userGroupFilter === "external" ? "External Users" : userGroupFilter === "evident" ? "Evident Users" : "All Users"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {filteredUsers.length} of {usersData?.users.length || 0} users
                    {userGroupFilter === "external" && " (self-registered)"}
                    {userGroupFilter === "evident" && " (admin-created)"}
                  </CardDescription>
                </div>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs" data-testid="select-plan-filter">
                    <SelectValue placeholder="Filter plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Evident Lite</SelectItem>
                    <SelectItem value="scholar">Evident Scholar</SelectItem>
                    <SelectItem value="pro">Evident Advanced</SelectItem>
                    <SelectItem value="pro_plus">Evident Max</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2 h-8" data-testid="button-add-user">
                    <Plus className="w-3 h-3" />
                    Add Evident User
                  </Button>
                </DialogTrigger>
                {showCreateUser && (
                  <CreateUserDialog onClose={() => setShowCreateUser(false)} orgs={orgsData?.orgs} />
                )}
              </Dialog>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingUsers ? (
                <div className="space-y-1">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1">
                    {filteredUsers.map((user) => {
                      const packCount = [
                        user.entitlement?.hasLegalPack,
                        user.entitlement?.hasFinancePack,
                        user.entitlement?.hasHrPack,
                        user.entitlement?.hasProcurementPack,
                        user.entitlement?.hasConstructionPack,
                        user.entitlement?.hasCompliancePack,
                      ].filter(Boolean).length;
                      const userPlanKey = user.entitlement?.planKey || "free";
                      const userPlanLabels: Record<string, string> = { free: "Free", starter: "Evident Lite", scholar: "Evident Scholar", pro: "Evident Advanced", pro_plus: "Evident Max" };
                      const isExternal = (user.userGroup || "external") === "external";
                      const signupDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : null;
                      const location = [user.city, user.region, user.countryCode].filter(Boolean).join(", ");
                      
                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 rounded-md border text-sm"
                          data-testid={`user-row-${user.id}`}
                        >
                          <div className="flex-1 min-w-0 flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">
                                  {user.firstName || user.lastName ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "—"}
                                </span>
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  {isExternal ? "External" : "Evident"}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {user.email || "No email"}
                              </div>
                              {(signupDate || location || user.signupSource) && (
                                <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                                  {signupDate && <span>Signed up: {signupDate}</span>}
                                  {user.lastLoginAt && <span className="ml-1">| Last login: {new Date(user.lastLoginAt).toLocaleDateString()}</span>}
                                  {signupDate && user.signupSource && <span className="mx-1">via</span>}
                                  {user.signupSource && (
                                    <span className={user.signupSource === "ios" ? "text-blue-500" : "text-green-500"}>
                                      {user.signupSource === "ios" ? "iOS" : "Web"}
                                    </span>
                                  )}
                                  {(signupDate || user.signupSource) && location && <span className="mx-1">|</span>}
                                  {location && <span>{location}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {userPlanLabels[userPlanKey] || userPlanKey}
                            </Badge>
                            {packCount > 0 && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-violet-500/20 text-violet-700 dark:text-violet-300">
                                +{packCount}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1" title={user.healthAccess ? "Health tab enabled" : "Health tab disabled"}>
                              <HeartPulse className={`w-3 h-3 ${user.healthAccess ? "text-emerald-500" : "text-muted-foreground/40"}`} />
                              <Switch
                                checked={user.healthAccess ?? false}
                                onCheckedChange={(checked) => healthAccessMutation.mutate({ userId: user.id, enabled: checked })}
                                className="scale-75"
                                data-testid={`switch-health-access-${user.id}`}
                              />
                            </div>
                            <Dialog open={editingUser?.id === user.id} onOpenChange={(open) => !open && setEditingUser(null)}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setEditingUser(user)}
                                  data-testid={`button-edit-user-${user.id}`}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </DialogTrigger>
                              {editingUser?.id === user.id && (
                                <EditUserDialog user={user} orgs={orgsData?.orgs || []} onClose={() => setEditingUser(null)} />
                              )}
                            </Dialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan Selector Settings</CardTitle>
              <CardDescription>
                Control plan selection popup behavior for testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <div className="font-medium">Show Plan Selector for Evident Users</div>
                  <div className="text-sm text-muted-foreground">
                    Enable to test the plan selection popup for admin-created users
                  </div>
                </div>
                <Switch
                  checked={localStorage.getItem("planSelectorForLocalUsers") === "true"}
                  onCheckedChange={(checked) => {
                    localStorage.setItem("planSelectorForLocalUsers", checked ? "true" : "false");
                    toast({ title: checked ? "Plan selector enabled for Evident users" : "Plan selector disabled for Evident users" });
                  }}
                  data-testid="switch-plan-selector-evident"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan Rules & Limits</CardTitle>
              <CardDescription>
                Default permissions and limits for each plan. External users automatically inherit these rules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Plan</th>
                      <th className="text-left py-2 px-2 font-medium">Price</th>
                      <th className="text-left py-2 px-2 font-medium">Storage</th>
                      <th className="text-left py-2 px-2 font-medium">Questions/mo</th>
                      <th className="text-left py-2 px-2 font-medium">Documents</th>
                      <th className="text-left py-2 px-2 font-medium">Max File</th>
                      <th className="text-left py-2 px-2 font-medium">Media</th>
                      <th className="text-left py-2 px-2 font-medium">Features</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: "free", name: "Free", price: "$0", storage: "100MB", queries: "5", docs: "5", maxFile: "5MB", media: "No", features: [] },
                      { key: "starter", name: "Evident Lite", price: "$5/mo", storage: "500MB", queries: "50", docs: "25", maxFile: "10MB", media: "15 min", features: ["Media"] },
                      { key: "scholar", name: "Evident Scholar", price: "$29/mo", storage: "1GB", queries: "200", docs: "100", maxFile: "20MB", media: "No cap", features: ["Media", "Edu Only"] },
                      { key: "pro", name: "Evident Advanced", price: "$39/mo", storage: "2GB", queries: "500", docs: "1,000", maxFile: "25MB", media: "60 min", features: ["External Search", "Excel Reports"] },
                      { key: "pro_plus", name: "Evident Max", price: "$99/mo", storage: "5GB", queries: "2,000", docs: "5,000", maxFile: "50MB", media: "180 min", features: ["All Features", "Workspaces", "Training Export"] },
                    ].map((plan) => (
                      <tr key={plan.key} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2 font-medium">{plan.name}</td>
                        <td className="py-2 px-2">{plan.price}</td>
                        <td className="py-2 px-2">{plan.storage}</td>
                        <td className="py-2 px-2">{plan.queries}</td>
                        <td className="py-2 px-2">{plan.docs}</td>
                        <td className="py-2 px-2">{plan.maxFile}</td>
                        <td className="py-2 px-2">{plan.media}</td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1">
                            {plan.features.map((f) => (
                              <Badge key={f} variant="secondary" className="text-[10px] px-1 py-0">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feature Access by Plan</CardTitle>
              <CardDescription>
                Which features are enabled for each plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Feature</th>
                      <th className="text-center py-2 px-2 font-medium">Free</th>
                      <th className="text-center py-2 px-2 font-medium">Starter</th>
                      <th className="text-center py-2 px-2 font-medium">Scholar</th>
                      <th className="text-center py-2 px-2 font-medium">Pro</th>
                      <th className="text-center py-2 px-2 font-medium">Premium</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: "Document Upload", free: true, starter: true, scholar: true, pro: true, premium: true },
                      { feature: "AI Questions", free: true, starter: true, scholar: true, pro: true, premium: true },
                      { feature: "Media Transcription", free: false, starter: true, scholar: true, pro: true, premium: true },
                      { feature: "External Search", free: false, starter: false, scholar: false, pro: true, premium: true },
                      { feature: "Excel Reports", free: false, starter: false, scholar: false, pro: true, premium: true },
                      { feature: "Workspaces", free: false, starter: false, scholar: false, pro: false, premium: true },
                      { feature: "Scheduled Reports", free: false, starter: false, scholar: false, pro: false, premium: true },
                      { feature: "Training Export", free: false, starter: false, scholar: false, pro: false, premium: true },
                    ].map((row) => (
                      <tr key={row.feature} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2 font-medium">{row.feature}</td>
                        <td className="py-2 px-2 text-center">{row.free ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />}</td>
                        <td className="py-2 px-2 text-center">{row.starter ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />}</td>
                        <td className="py-2 px-2 text-center">{row.scholar ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />}</td>
                        <td className="py-2 px-2 text-center">{row.pro ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />}</td>
                        <td className="py-2 px-2 text-center">{row.premium ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orgs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Organizations</CardTitle>
              <CardDescription>
                {orgsData?.orgs.length || 0} organizations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOrgs ? (
                <div className="space-y-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : (
                <div className="space-y-2">
                  {orgsData?.orgs.map((org) => (
                    <div
                      key={org.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      data-testid={`org-row-${org.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{org.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {org.memberCount} members
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{org.plan}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {org.planDeviceLimit} device limit
                        </span>
                        <Dialog open={editingOrg?.id === org.id} onOpenChange={(open) => !open && setEditingOrg(null)}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingOrg(org)}
                              data-testid={`button-edit-org-${org.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          {editingOrg?.id === org.id && (
                            <EditOrgDialog org={org} onClose={() => setEditingOrg(null)} />
                          )}
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <div className="space-y-6">
            {loadingMetrics ? (
              <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-48" />
              </div>
            ) : metricsData ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {metricsData.health === 'healthy' && (
                      <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Healthy
                      </Badge>
                    )}
                    {metricsData.health === 'warning' && (
                      <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Warning
                      </Badge>
                    )}
                    {metricsData.health === 'critical' && (
                      <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
                        <XCircle className="w-3 h-3 mr-1" />
                        Critical
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      Uptime: {Math.floor(metricsData.uptime / 3600)}h {Math.floor((metricsData.uptime % 3600) / 60)}m
                    </span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchMetrics()}
                    data-testid="button-refresh-metrics"
                  >
                    Refresh
                  </Button>
                </div>

                {metricsData.warnings.length > 0 && (
                  <Card className="border-yellow-500/50 bg-yellow-500/10">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-700 dark:text-yellow-400">Active Warnings</p>
                          <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                            {metricsData.warnings.map((warning, i) => (
                              <li key={i}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        API Requests (1 min)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metricsData.requests.lastMinute}</div>
                      <p className="text-xs text-muted-foreground">
                        Avg: {metricsData.requests.avgResponseTime}ms
                      </p>
                      {metricsData.requests.slowRequests > 0 && (
                        <p className="text-xs text-yellow-500">
                          {metricsData.requests.slowRequests} slow requests
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-muted-foreground" />
                        Processing (5 min)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metricsData.processing.lastFiveMinutes}</div>
                      <p className="text-xs text-muted-foreground">
                        Avg: {metricsData.processing.avgProcessingTime}ms
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Error rate: {metricsData.processing.errorRate}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Database className="w-4 h-4 text-muted-foreground" />
                        Memory
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metricsData.memory.percentage}%</div>
                      <p className="text-xs text-muted-foreground">
                        Heap: {metricsData.memory.usedMB}MB / {metricsData.memory.totalMB}MB
                      </p>
                      {metricsData.memory.rssMB && (
                        <p className="text-xs text-muted-foreground">
                          Process: {metricsData.memory.rssMB}MB
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {metricsData.capacity && (
                  <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-blue-500" />
                        System Capacity & Peak Usage
                      </CardTitle>
                      <CardDescription>
                        {metricsData.memory.explanation || 'Resource utilization and peak metrics since server start'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-500">{metricsData.capacity.utilizationPercent}%</div>
                          <p className="text-xs text-muted-foreground">Container Used</p>
                          <p className="text-xs text-muted-foreground">({metricsData.memory.rssMB || metricsData.memory.usedMB}MB / {metricsData.capacity.containerLimitMB}MB)</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{metricsData.capacity.peakMemoryMB}MB</div>
                          <p className="text-xs text-muted-foreground">Peak Memory</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{metricsData.capacity.peakRequestsPerMinute}</div>
                          <p className="text-xs text-muted-foreground">Peak Requests/min</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{metricsData.capacity.peakResponseTimeMs}ms</div>
                          <p className="text-xs text-muted-foreground">Slowest Response</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Processing by Type</CardTitle>
                    <CardDescription>Operations in the last 5 minutes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">{metricsData.processing.byType.document}</div>
                        <p className="text-xs text-muted-foreground">Documents</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{metricsData.processing.byType.embedding}</div>
                        <p className="text-xs text-muted-foreground">Embeddings</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{metricsData.processing.byType.chat}</div>
                        <p className="text-xs text-muted-foreground">Chat</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{metricsData.processing.byType.vision}</div>
                        <p className="text-xs text-muted-foreground">Vision</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{metricsData.processing.byType.transcription}</div>
                        <p className="text-xs text-muted-foreground">Transcription</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {metricsData.pythonService && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Server className="w-5 h-5 text-primary" />
                        Python Document Service
                      </CardTitle>
                      <CardDescription>
                        Microservice for OCR, PDF extraction, and table detection
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {metricsData.pythonService.isConfigured ? (
                            metricsData.pythonService.isHealthy ? (
                              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Connected
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
                                <XCircle className="w-3 h-3 mr-1" />
                                Unreachable
                              </Badge>
                            )
                          ) : (
                            <Badge variant="secondary">
                              Not Configured
                            </Badge>
                          )}
                          <span className="text-sm text-muted-foreground">
                            {metricsData.pythonService.serviceUrl}
                          </span>
                        </div>
                        <PythonServiceForceToggle 
                          isForced={metricsData.pythonService.forcePythonService}
                          enabledAt={metricsData.pythonService.forcePythonServiceEnabledAt}
                          enabledBy={metricsData.pythonService.forcePythonServiceEnabledBy}
                          isConfigured={metricsData.pythonService.isConfigured}
                        />
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold">{metricsData.pythonService.totalCalls}</div>
                          <p className="text-xs text-muted-foreground">Total (1h)</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{metricsData.pythonService.recentCalls}</div>
                          <p className="text-xs text-muted-foreground">Recent (5m)</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-500">{metricsData.pythonService.successRate}</div>
                          <p className="text-xs text-muted-foreground">Success Rate</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{metricsData.pythonService.avgResponseTime}ms</div>
                          <p className="text-xs text-muted-foreground">Avg Response</p>
                        </div>
                      </div>

                      {Object.keys(metricsData.pythonService.byEndpoint).length > 0 && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-medium mb-2">By Endpoint (5 min)</p>
                          <div className="space-y-2">
                            {Object.entries(metricsData.pythonService.byEndpoint).map(([endpoint, stats]) => (
                              <div key={endpoint} className="flex items-center justify-between text-sm p-2 rounded bg-muted">
                                <span className="font-mono text-xs">{endpoint}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-green-500">{stats.success} ok</span>
                                  {stats.failed > 0 && <span className="text-red-500">{stats.failed} failed</span>}
                                  <span className="text-muted-foreground">{stats.avgTime}ms avg</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {metricsData.pythonService.byDocumentType && Object.keys(metricsData.pythonService.byDocumentType).length > 0 && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-medium mb-2">By Document Type (1 hour)</p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {Object.entries(metricsData.pythonService.byDocumentType).map(([docType, stats]) => (
                              <div key={docType} className="text-sm p-2 rounded bg-muted">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium uppercase text-xs">{docType}</span>
                                  <span className="text-primary font-bold">{stats.count}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                                  <span>{stats.avgTime}ms avg</span>
                                  {stats.errors > 0 && <span className="text-red-400">{stats.errors} errors</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {metricsData.pythonService.recentErrors.length > 0 && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-medium mb-2 text-red-500">Recent Errors</p>
                          <ScrollArea className="h-24">
                            <div className="space-y-2">
                              {metricsData.pythonService.recentErrors.map((error, i) => (
                                <div key={i} className="text-sm p-2 rounded bg-red-500/10">
                                  <span className="text-muted-foreground font-mono text-xs">{error.endpoint}</span>{" "}
                                  <span className="text-red-400">{error.error}</span>
                                  <span className="text-muted-foreground ml-2">{error.ago}</span>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {metricsData.requests.recentLog && metricsData.requests.recentLog.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ListTodo className="w-5 h-5 text-primary" />
                        API Request Log
                      </CardTitle>
                      <CardDescription>
                        Recent API requests with timestamps and processing times (last 50)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64">
                        <div className="space-y-1">
                          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2 py-1 border-b sticky top-0 bg-background">
                            <div className="col-span-3">Time</div>
                            <div className="col-span-1">Method</div>
                            <div className="col-span-5">Path</div>
                            <div className="col-span-1">Status</div>
                            <div className="col-span-2 text-right">Duration</div>
                          </div>
                          {metricsData.requests.recentLog.map((req, i) => (
                            <div 
                              key={i} 
                              className={`grid grid-cols-12 gap-2 text-xs px-2 py-1.5 rounded ${
                                req.statusCode >= 500 ? 'bg-red-500/10' : 
                                req.statusCode >= 400 ? 'bg-amber-500/10' : 
                                req.duration > 3000 ? 'bg-amber-500/10' : 'bg-muted/50'
                              }`}
                            >
                              <div className="col-span-3 font-mono text-muted-foreground">
                                {new Date(req.timestamp).toLocaleTimeString()}
                              </div>
                              <div className="col-span-1">
                                <Badge variant="outline" className="text-[10px] px-1">
                                  {req.method}
                                </Badge>
                              </div>
                              <div className="col-span-5 font-mono truncate" title={req.path}>
                                {req.path}
                              </div>
                              <div className="col-span-1">
                                <Badge 
                                  variant={req.statusCode >= 500 ? 'destructive' : req.statusCode >= 400 ? 'secondary' : 'outline'}
                                  className="text-[10px] px-1"
                                >
                                  {req.statusCode}
                                </Badge>
                              </div>
                              <div className={`col-span-2 text-right font-mono ${
                                req.duration > 10000 ? 'text-red-500' : 
                                req.duration > 3000 ? 'text-amber-500' : ''
                              }`}>
                                {req.duration}ms
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {metricsData.processing.recentLog && metricsData.processing.recentLog.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-green-500" />
                        Processing Log
                      </CardTitle>
                      <CardDescription>
                        Recent document/AI processing with timestamps (last 30)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-48">
                        <div className="space-y-1">
                          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2 py-1 border-b sticky top-0 bg-background">
                            <div className="col-span-3">Time</div>
                            <div className="col-span-2">Type</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Size</div>
                            <div className="col-span-3 text-right">Duration</div>
                          </div>
                          {metricsData.processing.recentLog.map((proc, i) => (
                            <div 
                              key={i} 
                              className={`grid grid-cols-12 gap-2 text-xs px-2 py-1.5 rounded ${
                                !proc.success ? 'bg-red-500/10' : 'bg-muted/50'
                              }`}
                            >
                              <div className="col-span-3 font-mono text-muted-foreground">
                                {new Date(proc.timestamp).toLocaleTimeString()}
                              </div>
                              <div className="col-span-2">
                                <Badge variant="outline" className="text-[10px] px-1">
                                  {proc.type}
                                </Badge>
                              </div>
                              <div className="col-span-2">
                                {proc.success ? (
                                  <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 text-[10px] px-1">
                                    <CheckCircle2 className="w-2 h-2 mr-0.5" />
                                    OK
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 text-[10px] px-1">
                                    <XCircle className="w-2 h-2 mr-0.5" />
                                    Failed
                                  </Badge>
                                )}
                              </div>
                              <div className="col-span-2 text-muted-foreground">
                                {proc.fileSize ? `${Math.round(proc.fileSize / 1024)}KB` : '-'}
                              </div>
                              <div className={`col-span-3 text-right font-mono ${
                                proc.duration > 30000 ? 'text-amber-500' : ''
                              }`}>
                                {proc.duration > 1000 ? `${(proc.duration / 1000).toFixed(1)}s` : `${proc.duration}ms`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {metricsData.errors.lastFiveMinutes > 0 && (
                  <Card className="border-red-500/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-500">
                        <XCircle className="w-5 h-5" />
                        Recent Errors ({metricsData.errors.lastFiveMinutes})
                      </CardTitle>
                      {metricsData.errors.rateLimitErrors > 0 && (
                        <CardDescription className="text-red-400">
                          {metricsData.errors.rateLimitErrors} rate limit errors in last minute
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-32">
                        <div className="space-y-2">
                          {metricsData.errors.recent.map((error, i) => (
                            <div key={i} className="text-sm p-2 rounded bg-muted">
                              <span className="text-muted-foreground">[{error.type}]</span>{" "}
                              <span>{error.message}</span>
                              <span className="text-muted-foreground ml-2">{error.ago}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {metricsData.apiCosts && (
                  <Card className="border-green-500/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-500">
                        <DollarSign className="w-5 h-5" />
                        API Cost Estimator
                      </CardTitle>
                      <CardDescription>
                        Estimated costs since server start ({metricsData.apiCosts.uptimeDays} days)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 rounded-lg bg-muted text-center">
                          <div className="text-2xl font-bold text-green-500">
                            ${metricsData.apiCosts.totalSinceStart.toFixed(4)}
                          </div>
                          <p className="text-xs text-muted-foreground">Total So Far</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted text-center">
                          <div className="text-2xl font-bold text-primary">
                            ${metricsData.apiCosts.projectedMonthly.toFixed(2)}
                          </div>
                          <p className="text-xs text-muted-foreground">Projected Monthly</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted text-center">
                          <div className="text-lg font-bold">
                            {metricsData.apiCosts.uptimeDays.toFixed(2)}
                          </div>
                          <p className="text-xs text-muted-foreground">Days Running</p>
                        </div>
                      </div>
                      
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium mb-3">Cost Breakdown:</p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex justify-between p-2 rounded bg-background">
                            <span>Embeddings ({metricsData.apiCosts.breakdown.embeddings.count})</span>
                            <span className="font-mono">${metricsData.apiCosts.breakdown.embeddings.cost.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-background">
                            <span>Chat ({metricsData.apiCosts.breakdown.chat.count})</span>
                            <span className="font-mono">${metricsData.apiCosts.breakdown.chat.cost.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-background">
                            <span>Vision ({metricsData.apiCosts.breakdown.vision.count})</span>
                            <span className="font-mono">${metricsData.apiCosts.breakdown.vision.cost.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-background">
                            <span>Transcription ({metricsData.apiCosts.breakdown.transcription.minutes}m)</span>
                            <span className="font-mono">${metricsData.apiCosts.breakdown.transcription.cost.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-background col-span-2 border border-primary/20">
                            <span className="text-primary">Perplexity ({metricsData.apiCosts.breakdown.perplexity.requests} requests)</span>
                            <span className="font-mono text-primary">${metricsData.apiCosts.breakdown.perplexity.cost.toFixed(4)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        Note: Costs are estimated based on average token usage. Actual costs may vary. 
                        Check OpenAI and Perplexity dashboards for exact billing.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {rewardStats && rewardStats.total > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Gift className="w-5 h-5 text-primary" />
                        Error Rewards
                      </CardTitle>
                      <CardDescription>
                        Rewards given to users when errors occur - fix common errors to reduce costs
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold">{rewardStats.total}</div>
                          <p className="text-xs text-muted-foreground">Total Rewards</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-500">
                            {rewardStats.total > 0 
                              ? Math.round((rewardStats.claimed / rewardStats.total) * 100) 
                              : 0}%
                          </div>
                          <p className="text-xs text-muted-foreground">Claimed</p>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <Upload className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="text-xl font-bold">{rewardStats.bonusUploads}</div>
                            <p className="text-xs text-muted-foreground">Bonus Uploads</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <Percent className="w-4 h-4 text-violet-500" />
                          <div>
                            <div className="text-xl font-bold">{rewardStats.discountCodes}</div>
                            <p className="text-xs text-muted-foreground">Discount Codes</p>
                          </div>
                        </div>
                      </div>

                      {rewardStats.byErrorType.length > 0 && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-medium mb-2">Rewards by Error Type</p>
                          <div className="space-y-2">
                            {rewardStats.byErrorType.slice(0, 5).map((item) => (
                              <div key={item.errorType} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{item.errorType}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">{item.count}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({Math.round((item.count / rewardStats.total) * 100)}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-3">
                            Fix the top error types to reduce reward costs
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No metrics available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="abuse" className="mt-6">
          <div className="space-y-6">
            {loadingAbuse ? (
              <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-48" />
              </div>
            ) : abuseData ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Abuse Monitoring Dashboard</h2>
                    <p className="text-sm text-muted-foreground">
                      Last updated: {new Date(abuseData.summary.lastUpdated).toLocaleString()}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchAbuse()}
                    data-testid="button-refresh-abuse"
                  >
                    Refresh
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{abuseData.summary.totalUsers}</div>
                      <p className="text-xs text-muted-foreground">Total Users</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-orange-500">
                        {abuseData.summary.flaggedUsers}
                      </div>
                      <p className="text-xs text-muted-foreground">Flagged Users</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{abuseData.summary.totalUploads24h}</div>
                      <p className="text-xs text-muted-foreground">Uploads (24h)</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{abuseData.summary.totalQuestions}</div>
                      <p className="text-xs text-muted-foreground">Total Questions</p>
                    </CardContent>
                  </Card>
                </div>

                {abuseData.flaggedUsers.length > 0 && (
                  <Card className="border-orange-500/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-orange-500">
                        <AlertTriangle className="w-5 h-5" />
                        Flagged Users ({abuseData.flaggedUsers.length})
                      </CardTitle>
                      <CardDescription>Users with suspicious activity patterns</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-80">
                        <div className="space-y-3">
                          {abuseData.flaggedUsers.map((user) => (
                            <div 
                              key={user.userId} 
                              className="p-3 border rounded-lg space-y-2"
                              data-testid={`flagged-user-${user.userId}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                  {user.userId.slice(0, 8)}...
                                </code>
                                <Badge variant="destructive">{user.flags.length} flags</Badge>
                              </div>
                              <div className="grid grid-cols-4 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Docs:</span> {user.documentsCount}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Questions:</span> {user.questionsTotal}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">24h uploads:</span> {user.last24hUploads}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Duplicates:</span> {user.duplicateAttempts}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {user.flags.map((flag, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {flag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>All User Activity</CardTitle>
                    <CardDescription>Top 100 users by activity (sorted by flags)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <div className="space-y-2">
                        {abuseData.allUsers.map((user) => (
                          <div 
                            key={user.userId}
                            className={`flex items-center justify-between p-3 border rounded-lg ${
                              user.isFlagged ? 'border-orange-500/50 bg-orange-500/5' : ''
                            }`}
                            data-testid={`user-activity-${user.userId}`}
                          >
                            <div className="flex items-center gap-3">
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                {user.userId.slice(0, 8)}...
                              </code>
                              {user.isFlagged && (
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Docs: {user.documentsCount}</span>
                              <span>Questions: {user.questionsTotal}</span>
                              <span>24h: {user.last24hUploads}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No abuse monitoring data available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="healing" className="mt-6">
          <div className="space-y-6">
            {/* Summary Cards */}
            {processingStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{processingStats.total}</div>
                    <div className="text-sm text-muted-foreground">Total Processed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-green-600">{processingStats.success}</div>
                    <div className="text-sm text-muted-foreground">Successful</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-red-600">{processingStats.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-amber-600">{processingStats.retrying}</div>
                    <div className="text-sm text-muted-foreground">Retrying</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-blue-600">{processingStats.autoHealingStats.totalHealed}</div>
                    <div className="text-sm text-muted-foreground">Auto-Healed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-purple-600">{processingStats.autoHealingStats.pendingRetries}</div>
                    <div className="text-sm text-muted-foreground">Pending Retries</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={() => refetchProcessing()}
                data-testid="button-refresh-processing"
              >
                Refresh Stats
              </Button>
              <Button 
                variant="default"
                onClick={async () => {
                  try {
                    const result = await apiRequest("POST", "/api/admin/run-self-healing");
                    const data = await result.json();
                    toast({
                      title: "Self-healing cycle completed",
                      description: `Checked: ${data.checked}, Retried: ${data.retried}`,
                    });
                    refetchProcessing();
                  } catch (e) {
                    toast({
                      title: "Self-healing failed",
                      variant: "destructive",
                    });
                  }
                }}
                data-testid="button-run-self-healing"
              >
                Run Self-Healing Now
              </Button>
            </div>

            {loadingProcessing ? (
              <Skeleton className="h-64" />
            ) : processingStats ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Failure by Error Code */}
                <Card>
                  <CardHeader>
                    <CardTitle>Failures by Error Type</CardTitle>
                    <CardDescription>Distribution of processing failures</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {Object.entries(processingStats.byErrorCode).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(processingStats.byErrorCode).map(([code, count]) => (
                          <div key={code} className="flex items-center justify-between p-2 border rounded">
                            <Badge variant="outline">{code}</Badge>
                            <span className="font-mono text-sm">{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No failures recorded</p>
                    )}
                  </CardContent>
                </Card>

                {/* Failure by MIME Type */}
                <Card>
                  <CardHeader>
                    <CardTitle>Processing by File Type</CardTitle>
                    <CardDescription>Success rate by file type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {Object.entries(processingStats.byMimeType).map(([mime, stats]) => {
                          const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
                          return (
                            <div key={mime} className="flex items-center justify-between p-2 border rounded gap-2">
                              <span className="text-sm truncate flex-1">{mime}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600 text-xs">{stats.success}</span>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-red-600 text-xs">{stats.failed}</span>
                                <Badge variant={successRate >= 80 ? "default" : successRate >= 50 ? "secondary" : "destructive"}>
                                  {successRate}%
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Extraction Methods - Intelligent Strategy */}
                <Card>
                  <CardHeader>
                    <CardTitle>Extraction Methods Used</CardTitle>
                    <CardDescription>Intelligent strategy auto-selects optimal method</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {processingStats.byExtractionMethod && Object.entries(processingStats.byExtractionMethod).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(processingStats.byExtractionMethod).map(([method, count]) => (
                          <div key={method} className="flex items-center justify-between p-2 border rounded">
                            <Badge variant={method === 'pymupdf' ? 'default' : method === 'pdf-parse' ? 'secondary' : 'outline'}>
                              {method === 'pymupdf' ? 'Python PyMuPDF' : 
                               method === 'pdf-parse' ? 'Node pdf-parse' : 
                               method === 'ocr' ? 'OCR (Scanned)' : method}
                            </Badge>
                            <span className="font-mono text-sm">{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No extraction data yet</p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Successes with Extraction Method */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Successes</CardTitle>
                    <CardDescription>Latest successfully processed documents</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {processingStats.recentSuccesses && processingStats.recentSuccesses.length > 0 ? (
                          processingStats.recentSuccesses.slice(0, 10).map((success) => (
                            <div 
                              key={success.id} 
                              className="flex items-center justify-between p-2 border rounded gap-2"
                              data-testid={`success-${success.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{success.filename}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                                  {success.extractionMethod && (
                                    <Badge variant="outline" className="text-xs">
                                      {success.extractionMethod === 'pymupdf' ? 'PyMuPDF' : 
                                       success.extractionMethod === 'pdf-parse' ? 'pdf-parse' : 
                                       success.extractionMethod}
                                    </Badge>
                                  )}
                                  <span>{Math.round(success.textLength / 1024)}KB</span>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-muted-foreground text-center py-4">No recent successes</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Recent Failures */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Recent Failures</CardTitle>
                    <CardDescription>Latest failed document processing attempts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-80">
                      <div className="space-y-2">
                        {processingStats.recentFailures.length > 0 ? (
                          processingStats.recentFailures.map((failure) => (
                            <div 
                              key={failure.id} 
                              className="flex items-center justify-between p-3 border rounded-lg gap-4"
                              data-testid={`failure-${failure.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{failure.filename}</div>
                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{failure.mime}</Badge>
                                  {failure.errorCode && (
                                    <Badge variant="destructive" className="text-xs">{failure.errorCode}</Badge>
                                  )}
                                  <span className="text-xs">Retries: {failure.retryCount}</span>
                                </div>
                                {failure.errorMessage && (
                                  <div className="text-xs text-muted-foreground mt-1 truncate">
                                    {failure.errorMessage}
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    await apiRequest("POST", `/api/admin/processing-retry/${failure.assetId}`);
                                    toast({
                                      title: "Retry queued",
                                      description: `${failure.filename} queued for reprocessing`,
                                    });
                                    refetchProcessing();
                                  } catch (e) {
                                    toast({
                                      title: "Retry failed",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                data-testid={`button-retry-${failure.id}`}
                              >
                                Retry
                              </Button>
                            </div>
                          ))
                        ) : (
                          <p className="text-muted-foreground text-center py-4">No recent failures</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No processing stats available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="mt-6 space-y-6">
          <UserInsightsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface InsightUser {
  id: string;
  email: string | null;
  createdAt: string | null;
  signupSource: string | null;
  country: string | null;
  authProvider: string | null;
  welcomeEmailSent: boolean;
  lastLoginAt: string | null;
  uploads: number;
  questions: number;
  storageBytes: number;
  docsTotal: number;
  docsReady: number;
  docsError: number;
}

interface InsightsData {
  overview: {
    totalUsers: number;
    signupsThisWeek: number;
    signupsThisMonth: number;
    welcomeEmailsSent: number;
    welcomeEmailPercent: number;
  };
  funnel: {
    usersWithUploads: number;
    usersWithQuestions: number;
    usersWithReadyDocs: number;
  };
  modeBreakdown: Record<string, number>;
  signupTrend: { date: string; count: number }[];
  users: InsightUser[];
}

const MODE_LABELS: Record<string, string> = {
  general: "Professionals",
  study: "Students & Graduates",
  finance: "Finance",
  legal: "Legal",
  hr: "HR",
  research: "Research",
  personal: "Personal",
  analyst: "Analyst",
};

interface UserQuestion {
  id: number;
  content: string;
  intentMode: string | null;
  documentIds: string[];
  createdAt: string;
  conversationTitle: string | null;
  conversationDocIds: string[];
}

function UserQuestionHistoryDialog({ userId, userEmail, onClose }: { userId: string | null; userEmail: string; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery<{ questions: UserQuestion[] }>({
    queryKey: ["/api/admin/user-questions", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/user-questions/${userId}`);
      return res.json();
    },
    enabled: !!userId,
  });

  const questions = data?.questions || [];

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  };

  const modeColor: Record<string, string> = {
    study: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    finance: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    legal: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    hr: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    research: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
    analyst: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    general: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    personal: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  };

  return (
    <Dialog open={!!userId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Question History
          </DialogTitle>
          <DialogDescription>{userEmail} — last 50 questions</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading questions...</div>
          ) : isError ? (
            <div className="py-8 text-center text-destructive text-sm">Failed to load questions. Please try again.</div>
          ) : questions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">No questions found for this user.</div>
          ) : (
            <div className="space-y-3 pb-4">
              {questions.map((q) => {
                const docCount = (q.documentIds && q.documentIds.length > 0) ? q.documentIds.length : 0;
                const mode = q.intentMode || "general";
                return (
                  <div key={q.id} className="border rounded-lg p-3 space-y-1.5" data-testid={`question-item-${q.id}`}>
                    <p className="text-sm leading-relaxed">{q.content.length > 300 ? q.content.slice(0, 300) + "…" : q.content}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] px-1.5 py-0 ${modeColor[mode] || modeColor.general}`}>
                        {MODE_LABELS[mode] || mode}
                      </Badge>
                      {docCount > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <FileCheck className="w-3 h-3" /> {docCount} doc{docCount > 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">{formatTime(q.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

type TimeFilter = "all" | "today" | "7d" | "30d" | "90d";
type ActivityFilter = "all" | "uploaded" | "asked" | "inactive" | "welcome_missing";

function UserInsightsTab() {
  const { toast } = useToast();
  const [sortField, setSortField] = useState<keyof InsightUser>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [emailSearch, setEmailSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [composeOpen, setComposeOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [questionsUserId, setQuestionsUserId] = useState<string | null>(null);
  const [questionsUserEmail, setQuestionsUserEmail] = useState<string>("");

  const { data, isLoading } = useQuery<InsightsData>({
    queryKey: ["/api/admin/user-insights"],
  });

  const { data: emailLogs } = useQuery<{
    id: string;
    toEmail: string;
    subject: string;
    sentAt: string;
    openedAt: string | null;
    openCount: number;
  }[]>({
    queryKey: ["/api/admin/email-logs"],
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (payload: { to: string[]; subject: string; body: string }) => {
      const res = await apiRequest("POST", "/api/admin/send-email", payload);
      return res.json();
    },
    onSuccess: (data: { sent: number; failed: number }) => {
      toast({
        title: `${data.sent} email${data.sent !== 1 ? "s" : ""} sent`,
        description: data.failed > 0 ? `${data.failed} failed to send.` : "All emails delivered successfully.",
      });
      setComposeOpen(false);
      setEmailSubject("");
      setEmailBody("");
      setSelectedEmails(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-logs"] });
    },
    onError: () => {
      toast({ title: "Failed to send emails", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) return <p className="text-muted-foreground">Failed to load insights.</p>;

  const { overview, funnel, modeBreakdown, signupTrend, users: insightUsers } = data;

  const totalModeMessages = Object.values(modeBreakdown).reduce((a, b) => a + b, 0);
  const maxTrendCount = Math.max(...signupTrend.map(d => d.count), 1);

  const uniqueSources = [...new Set(insightUsers.map(u => u.signupSource).filter(Boolean))] as string[];
  const uniqueCountries = [...new Set(insightUsers.map(u => u.country).filter(Boolean))].sort() as string[];

  const getTimeCutoff = (filter: TimeFilter): Date | null => {
    const now = new Date();
    switch (filter) {
      case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "90d": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default: return null;
    }
  };

  const filteredUsers = insightUsers.filter(u => {
    if (emailSearch && !(u.email || "").toLowerCase().includes(emailSearch.toLowerCase())) return false;

    const cutoff = getTimeCutoff(timeFilter);
    if (cutoff && (!u.createdAt || new Date(u.createdAt) < cutoff)) return false;

    if (sourceFilter !== "all") {
      if (sourceFilter === "none" && u.signupSource) return false;
      if (sourceFilter !== "none" && u.signupSource !== sourceFilter) return false;
    }

    if (countryFilter !== "all" && (u.country || "") !== countryFilter) return false;

    switch (activityFilter) {
      case "uploaded": if (u.uploads === 0) return false; break;
      case "asked": if (u.questions === 0) return false; break;
      case "inactive": if (u.uploads > 0 || u.questions > 0) return false; break;
      case "welcome_missing": if (u.welcomeEmailSent) return false; break;
    }

    return true;
  });

  const toggleSort = (field: keyof InsightUser) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const av = a[sortField];
    const bv = b[sortField];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const hasActiveFilters = emailSearch || timeFilter !== "all" || activityFilter !== "all" || sourceFilter !== "all" || countryFilter !== "all";
  const clearFilters = () => {
    setEmailSearch("");
    setTimeFilter("all");
    setActivityFilter("all");
    setSourceFilter("all");
    setCountryFilter("all");
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const SortHeader = ({ field, children }: { field: keyof InsightUser; children: React.ReactNode }) => (
    <th
      className="text-left p-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => toggleSort(field)}
      data-testid={`sort-${String(field)}`}
    >
      {children} {sortField === field ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card data-testid="stat-total-users">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Users className="w-4 h-4" /> Total Users</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{overview.totalUsers}</p>
            <p className="text-xs text-muted-foreground mt-1">
              +{overview.signupsThisWeek} this week · +{overview.signupsThisMonth} this month
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-uploads">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Upload className="w-4 h-4" /> Uploaded Docs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{funnel.usersWithUploads}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {overview.totalUsers > 0 ? Math.round((funnel.usersWithUploads / overview.totalUsers) * 100) : 0}% of users uploaded
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-questions">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><HelpCircle className="w-4 h-4" /> Asked Questions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{funnel.usersWithQuestions}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {overview.totalUsers > 0 ? Math.round((funnel.usersWithQuestions / overview.totalUsers) * 100) : 0}% of users engaged
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-welcome-emails">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Mail className="w-4 h-4" /> Welcome Emails</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{overview.welcomeEmailsSent}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {overview.welcomeEmailPercent}% of users received
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-mode-breakdown">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Mode Usage</CardTitle>
            <CardDescription>Which modes users are asking questions in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(modeBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([mode, count]) => (
                <div key={mode} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{MODE_LABELS[mode] || mode}</span>
                    <span className="text-muted-foreground">{count} messages ({totalModeMessages > 0 ? Math.round((count / totalModeMessages) * 100) : 0}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${totalModeMessages > 0 ? (count / totalModeMessages) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            {Object.keys(modeBreakdown).length === 0 && (
              <p className="text-sm text-muted-foreground">No mode usage data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-signup-trend">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Signup Trend (30 days)</CardTitle>
            <CardDescription>Daily new signups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[2px] h-32">
              {signupTrend.map((day) => (
                <div
                  key={day.date}
                  className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors relative group"
                  style={{ height: `${Math.max((day.count / maxTrendCount) * 100, day.count > 0 ? 8 : 2)}%` }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover border rounded px-2 py-1 text-xs shadow-md whitespace-nowrap z-10">
                    {day.date}: {day.count} signup{day.count !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{signupTrend[0]?.date.slice(5)}</span>
              <span>{signupTrend[signupTrend.length - 1]?.date.slice(5)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-engagement-funnel">
        <CardHeader>
          <CardTitle className="text-base">Engagement Funnel</CardTitle>
          <CardDescription>How users progress from signup to active use</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            {[
              { label: "Signed Up", value: overview.totalUsers, icon: Users },
              { label: "Uploaded", value: funnel.usersWithUploads, icon: Upload },
              { label: "Asked Questions", value: funnel.usersWithQuestions, icon: MessageSquare },
              { label: "Docs Processed", value: funnel.usersWithReadyDocs, icon: FileCheck },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1 min-w-[80px]">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-lg font-bold">{step.value}</span>
                  <span className="text-xs text-muted-foreground text-center">{step.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className="text-muted-foreground text-xs whitespace-nowrap">
                    → {step.value > 0 ? Math.round((arr[i + 1].value / step.value) * 100) : 0}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-user-table">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">All Users</CardTitle>
              <CardDescription>
                {selectedEmails.size > 0
                  ? `${selectedEmails.size} user${selectedEmails.size !== 1 ? "s" : ""} selected`
                  : hasActiveFilters
                    ? `Showing ${filteredUsers.length} of ${insightUsers.length} users`
                    : `${insightUsers.length} users · Click column headers to sort`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedEmails.size > 0 && (
                <Button size="sm" onClick={() => setComposeOpen(true)} data-testid="btn-compose-email">
                  <Mail className="w-3 h-3 mr-1" /> Email Selected ({selectedEmails.size})
                </Button>
              )}
              {filteredUsers.filter(u => u.email).length > 0 && selectedEmails.size === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const emails = new Set(filteredUsers.filter(u => u.email).map(u => u.email!));
                    setSelectedEmails(emails);
                  }}
                  data-testid="btn-select-all"
                >
                  Select All ({filteredUsers.filter(u => u.email).length})
                </Button>
              )}
              {selectedEmails.size > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedEmails(new Set())} data-testid="btn-deselect-all">
                  Deselect
                </Button>
              )}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="btn-clear-filters">
                  <XCircle className="w-3 h-3 mr-1" /> Clear filters
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            <div className="flex-1 min-w-[180px]">
              <Input
                placeholder="Search by email..."
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-email-search"
              />
            </div>
            <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
              <SelectTrigger className="w-[130px] h-8 text-sm" data-testid="select-time-filter">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={activityFilter} onValueChange={(v) => setActivityFilter(v as ActivityFilter)}>
              <SelectTrigger className="w-[150px] h-8 text-sm" data-testid="select-activity-filter">
                <SelectValue placeholder="Activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activity</SelectItem>
                <SelectItem value="uploaded">Has uploads</SelectItem>
                <SelectItem value="asked">Asked questions</SelectItem>
                <SelectItem value="inactive">No activity</SelectItem>
                <SelectItem value="welcome_missing">No welcome email</SelectItem>
              </SelectContent>
            </Select>
            {uniqueCountries.length > 0 && (
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[130px] h-8 text-sm" data-testid="select-country-filter">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All countries</SelectItem>
                  {uniqueCountries.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {uniqueSources.length > 0 && (
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[120px] h-8 text-sm" data-testid="select-source-filter">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {uniqueSources.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                  <SelectItem value="none">No source</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 w-8">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={sortedUsers.filter(u => u.email).length > 0 && sortedUsers.filter(u => u.email).every(u => selectedEmails.has(u.email!))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newSet = new Set(selectedEmails);
                          sortedUsers.forEach(u => { if (u.email) newSet.add(u.email); });
                          setSelectedEmails(newSet);
                        } else {
                          setSelectedEmails(new Set());
                        }
                      }}
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <SortHeader field="email">Email</SortHeader>
                  <SortHeader field="createdAt">Signed Up</SortHeader>
                  <SortHeader field="lastLoginAt">Last Login</SortHeader>
                  <SortHeader field="signupSource">Source</SortHeader>
                  <SortHeader field="country">Country</SortHeader>
                  <SortHeader field="uploads">Uploads</SortHeader>
                  <SortHeader field="questions">Questions</SortHeader>
                  <SortHeader field="docsReady">Docs Ready</SortHeader>
                  <SortHeader field="storageBytes">Storage</SortHeader>
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground whitespace-nowrap">Welcome Email</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-muted-foreground">
                      No users match the current filters.
                    </td>
                  </tr>
                )}
                {sortedUsers.map((u) => (
                  <tr key={u.id} className={`border-b last:border-0 hover:bg-muted/50 ${u.email && selectedEmails.has(u.email) ? "bg-primary/5" : ""}`} data-testid={`row-user-${u.id}`}>
                    <td className="p-2">
                      {u.email ? (
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedEmails.has(u.email)}
                          onChange={(e) => {
                            const newSet = new Set(selectedEmails);
                            if (e.target.checked) newSet.add(u.email!);
                            else newSet.delete(u.email!);
                            setSelectedEmails(newSet);
                          }}
                          data-testid={`checkbox-user-${u.id}`}
                        />
                      ) : null}
                    </td>
                    <td className="p-2 font-medium max-w-[200px] truncate">{u.email || "—"}</td>
                    <td className="p-2 text-muted-foreground whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="p-2 text-muted-foreground whitespace-nowrap">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "—"}</td>
                    <td className="p-2">
                      {u.signupSource ? (
                        <Badge variant="secondary" className="text-xs">{u.signupSource}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      {u.country ? (
                        <span className="flex items-center gap-1 text-xs">
                          <Globe className="w-3 h-3" /> {u.country}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-2 text-center">{u.uploads}</td>
                    <td className="p-2 text-center">
                      {u.questions > 0 ? (
                        <button
                          className="text-primary underline underline-offset-2 font-medium text-sm"
                          onClick={() => { setQuestionsUserId(u.id); setQuestionsUserEmail(u.email || "Unknown"); }}
                          data-testid={`btn-view-questions-${u.id}`}
                        >
                          {u.questions}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {u.docsReady > 0 ? (
                        <Badge variant="default" className="text-xs">{u.docsReady}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                      {u.docsError > 0 && (
                        <Badge variant="destructive" className="text-xs ml-1">{u.docsError} err</Badge>
                      )}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{formatBytes(u.storageBytes)}</td>
                    <td className="p-2 text-center">
                      {u.welcomeEmailSent ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 inline" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {emailLogs && emailLogs.length > 0 && (
        <Card data-testid="card-email-history">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" /> Sent Emails</CardTitle>
            <CardDescription>Track which emails have been opened</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">To</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Subject</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Sent</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-email-${log.id}`}>
                      <td className="p-2 font-medium">{log.toEmail}</td>
                      <td className="p-2 text-muted-foreground max-w-[200px] truncate">{log.subject}</td>
                      <td className="p-2 text-muted-foreground whitespace-nowrap">{formatDate(log.sentAt)}</td>
                      <td className="p-2">
                        {log.openedAt ? (
                          <Badge variant="default" className="text-xs gap-1 bg-green-600">
                            <CheckCircle2 className="w-3 h-3" /> Opened{log.openCount > 1 ? ` (${log.openCount}x)` : ""}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Clock className="w-3 h-3" /> Not opened
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <UserQuestionHistoryDialog
        userId={questionsUserId}
        userEmail={questionsUserEmail}
        onClose={() => setQuestionsUserId(null)}
      />

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Compose Email</DialogTitle>
            <DialogDescription>
              Sending from moses@evident-ai.net to {selectedEmails.size} user{selectedEmails.size !== 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-2 bg-muted rounded text-xs">
                {[...selectedEmails].map(email => (
                  <Badge key={email} variant="secondary" className="text-xs gap-1">
                    {email}
                    <button
                      onClick={() => {
                        const newSet = new Set(selectedEmails);
                        newSet.delete(email);
                        setSelectedEmails(newSet);
                        if (newSet.size === 0) setComposeOpen(false);
                      }}
                      className="ml-1 hover:text-destructive"
                      data-testid={`remove-recipient-${email}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                placeholder="e.g. Thank you for trying Evident!"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                data-testid="input-email-subject"
              />
            </div>
            <div>
              <Label htmlFor="email-body">Message</Label>
              <textarea
                id="email-body"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[160px] resize-y"
                placeholder="Write your message here..."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                data-testid="input-email-body"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)} data-testid="btn-cancel-email">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!emailSubject.trim() || !emailBody.trim()) {
                  toast({ title: "Please fill in subject and message", variant: "destructive" });
                  return;
                }
                sendEmailMutation.mutate({
                  to: [...selectedEmails],
                  subject: emailSubject,
                  body: emailBody,
                });
              }}
              disabled={sendEmailMutation.isPending || !emailSubject.trim() || !emailBody.trim() || selectedEmails.size === 0}
              data-testid="btn-send-email"
            >
              {sendEmailMutation.isPending ? "Sending..." : `Send to ${selectedEmails.size} user${selectedEmails.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
