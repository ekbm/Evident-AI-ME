import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppContext, type AppMode } from "@/contexts/app-context";
import { ArrowLeft, Upload, Building2, Settings as SettingsIcon, Key, Copy, Trash2, Plus, Eye, EyeOff, CheckCircle2, Shield, Globe, Info, Lock, UserX, Rocket, HardDrive, FileUp, Sparkles, MessageSquare, Loader2, ChevronRight, Sun, Moon, Monitor } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { isFeatureEnabled, setFeatureFlag } from "@/lib/feature-flags";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  rateLimitRpm: number;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface NewApiKey extends ApiKeyInfo {
  key: string;
  message: string;
}

function VersionInfo() {
  const { data: versionData } = useQuery<{ version: string; buildDate: string; environment: string }>({
    queryKey: ["/api/version"],
  });
  
  return (
    <div className="text-xs text-muted-foreground pt-2">
      <p>Version {versionData?.version || "..."} {versionData?.environment === "production" ? "" : `(${versionData?.environment || "dev"})`}</p>
      <p className="mt-0.5">Build: {versionData?.buildDate || "..."}</p>
      <p className="mt-1">© 2026 Evident. All rights reserved.</p>
    </div>
  );
}

export default function SettingsPage() {
  const [, navigate] = useLocation();
  const { appMode, setAppMode, clearOnboarding } = useAppContext();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<NewApiKey | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [pilotModeEnabled, setPilotModeEnabled] = useState(() => isFeatureEnabled("PILOT_MODE_ENABLED"));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [helperDisabled, setHelperDisabled] = useState(() => {
    return localStorage.getItem("evident_helper_disabled") === "true";
  });
  const [defaultMode, setDefaultMode] = useState<string>(() => {
    return localStorage.getItem("evidentIntentMode") || "general";
  });
  const [themeMode, setThemeMode] = useState<"auto" | "light" | "dark">(() => {
    return (localStorage.getItem("evidentTheme") as "auto" | "light" | "dark") || "auto";
  });

  // Handle theme change
  const handleThemeChange = (mode: "auto" | "light" | "dark") => {
    setThemeMode(mode);
    localStorage.setItem("evidentTheme", mode);
    
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else if (mode === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      // Auto mode - dark on desktop, light on mobile; also check system preference and time
      const isDesktop = window.innerWidth >= 1024;
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const hour = new Date().getHours();
      const isNightTime = hour >= 19 || hour < 7;
      if (isDesktop || prefersDark || isNightTime) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    
    toast({ 
      title: "Theme updated", 
      description: mode === "auto" ? "Using automatic theme" : `Switched to ${mode} mode` 
    });
  };

  // Handle default mode change
  const handleDefaultModeChange = (mode: string) => {
    setDefaultMode(mode);
    localStorage.setItem("evidentIntentMode", mode);
    toast({ title: "Default mode updated", description: `Your default mode is now "${mode.charAt(0).toUpperCase() + mode.slice(1)}"` });
  };

  const { data: passwordStatus, isLoading: passwordStatusLoading } = useQuery<{ hasPassword: boolean; authProvider: string }>({
    queryKey: ["/api/auth/password-status"],
  });

  // Admin check - always refetch to ensure fresh data after login
  const { data: adminData, isLoading: adminLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    staleTime: 0, // Always consider data stale
    refetchOnMount: 'always', // Always refetch when component mounts
  });
  const isAdmin = adminData?.isAdmin ?? false;
  console.log("[Settings] adminData:", adminData, "isAdmin:", isAdmin, "loading:", adminLoading);

  const { data: keysData, isLoading: keysLoading } = useQuery({
    queryKey: ["/api/keys"],
    enabled: isAdmin,
  });

  // Enterprise Mode query
  const { data: enterpriseModeData, isLoading: enterpriseModeLoading } = useQuery<{ enabled: boolean; maxFileSizeMB: number; features: string[] }>({
    queryKey: ["/api/enterprise-mode"],
    enabled: isAdmin,
  });

  // Enterprise Mode toggle mutation
  const toggleEnterpriseMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/enterprise-mode", { enabled });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise-mode"] });
      toast({ 
        title: data.enabled ? "Enterprise Mode Enabled" : "Enterprise Mode Disabled",
        description: data.message
      });
    },
    onError: (error: any) => {
      toast({ title: "Failed to toggle Enterprise Mode", description: error.message, variant: "destructive" });
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/set-password", { 
        password: newPassword,
        currentPassword: passwordStatus?.hasPassword ? currentPassword : undefined
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password updated successfully" });
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/password-status"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to set password", description: error.message, variant: "destructive" });
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/keys", { name, scopes: "read,chat" });
      return res.json() as Promise<NewApiKey>;
    },
    onSuccess: (data) => {
      setNewlyCreatedKey(data);
      setNewKeyName("");
      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      toast({ title: "API key created", description: "Store this key securely. It won't be shown again." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create key", description: error.message, variant: "destructive" });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      toast({ title: "API key deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete key", description: error.message, variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (confirmEmail: string) => {
      const res = await apiRequest("DELETE", "/api/auth/delete-account", { confirmEmail });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Account deleted", description: "Your account has been permanently deleted." });
      setIsDeleteDialogOpen(false);
      window.location.href = "/";
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete account", description: error.message, variant: "destructive" });
    },
  });

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copied to clipboard" });
  };

  const handleChangeMode = () => {
    clearOnboarding();
    navigate("/onboarding");
  };

  const handleSwitchMode = (mode: AppMode) => {
    setAppMode(mode);
    toast({ 
      title: `Switched to ${mode === "WORKSPACE" ? "Workspace" : "Pilot"} mode`,
      description: mode === "PILOT" 
        ? "Enterprise features are now enabled" 
        : "Personal workspace mode activated"
    });
  };

  const getModeLabel = () => {
    if (appMode === "WORKSPACE") return "Personal Workspace";
    if (appMode === "PILOT") return "Pilot Mode";
    return "Not set";
  };

  const getModeIcon = () => {
    if (appMode === "WORKSPACE") return <Upload className="w-4 h-4" />;
    if (appMode === "PILOT") return <Building2 className="w-4 h-4" />;
    return <SettingsIcon className="w-4 h-4" />;
  };

  const handleTogglePilotMode = (enabled: boolean) => {
    setFeatureFlag("PILOT_MODE_ENABLED", enabled);
    setPilotModeEnabled(enabled);
    toast({
      title: enabled ? "Pilot Mode Enabled" : "Pilot Mode Disabled",
      description: enabled 
        ? "Enterprise pilot features are now available to users"
        : "Pilot mode is hidden from public users"
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="self-start" data-testid="button-workspace">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Workspace
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage your preferences</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usage Mode</CardTitle>
            <CardDescription>
              {isFeatureEnabled("PILOT_MODE_ENABLED") 
                ? "Switch between personal workspace and enterprise pilot mode"
                : "Your current usage mode"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`grid gap-4 ${isFeatureEnabled("PILOT_MODE_ENABLED") ? "grid-cols-2" : "grid-cols-1"}`}>
              <button
                onClick={() => handleSwitchMode("WORKSPACE")}
                className={`relative p-4 rounded-lg border-2 text-left transition-all hover-elevate ${
                  appMode === "WORKSPACE" 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                }`}
                data-testid="button-mode-workspace"
              >
                {appMode === "WORKSPACE" && (
                  <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-primary" />
                )}
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-3">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <p className="font-medium">Workspace</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Personal document analysis
                </p>
              </button>

              {isFeatureEnabled("PILOT_MODE_ENABLED") && (
                <button
                  onClick={() => handleSwitchMode("PILOT")}
                  className={`relative p-4 rounded-lg border-2 text-left transition-all hover-elevate ${
                    appMode === "PILOT" 
                      ? "border-accent bg-accent/5" 
                      : "border-border hover:border-accent/50"
                  }`}
                  data-testid="button-mode-pilot"
                >
                  {appMode === "PILOT" && (
                    <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-accent" />
                  )}
                  <div className="w-10 h-10 rounded-md bg-accent/10 flex items-center justify-center mb-3">
                    <Building2 className="w-5 h-5 text-accent" />
                  </div>
                  <p className="font-medium">Pilot Mode</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enterprise features enabled
                  </p>
                </button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Current: <span className="font-medium">{getModeLabel()}</span>
            </p>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Subscription</CardTitle>
            <CardDescription>
              Your current plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary">Free</Badge>
                <span className="text-sm text-muted-foreground">Basic features included</span>
              </div>
              <Button variant="outline" asChild data-testid="button-view-plans">
                <Link href="/pricing">Plans and Pricing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Default Mode
            </CardTitle>
            <CardDescription>
              Choose which mode to use by default when you open the app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label htmlFor="defaultMode">Default Intent Mode</Label>
              <Select value={defaultMode} onValueChange={handleDefaultModeChange}>
                <SelectTrigger className="w-full max-w-xs" data-testid="select-default-mode">
                  <SelectValue placeholder="Select default mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General - Everyday document tasks</SelectItem>
                  <SelectItem value="personal">Personal - Life documents (medical, legal, financial)</SelectItem>
                  <SelectItem value="study">Study - Learning and education</SelectItem>
                  <SelectItem value="research">Research - Academic and research work</SelectItem>
                  <SelectItem value="finance">Finance - Financial analysis and SEC data</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This determines which set of tools appears when you select a document.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Password Settings
            </CardTitle>
            <CardDescription>
              {passwordStatus?.hasPassword 
                ? "Update your password for email login" 
                : "Set a password to enable email login"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {passwordStatusLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <>
                {passwordStatus?.authProvider === "replit" && !passwordStatus?.hasPassword && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      You're signed in with Replit. Set a password to also enable email login.
                    </p>
                  </div>
                )}
                
                {passwordStatus?.hasPassword && (
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        data-testid="input-current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        data-testid="button-toggle-current-password"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 6 characters)"
                      data-testid="input-new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      data-testid="button-toggle-new-password"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      data-testid="input-confirm-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      data-testid="button-toggle-confirm-password"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-sm text-destructive">Passwords do not match</p>
                )}
                
                <Button
                  onClick={() => setPasswordMutation.mutate()}
                  disabled={
                    setPasswordMutation.isPending ||
                    !newPassword ||
                    newPassword.length < 6 ||
                    newPassword !== confirmPassword ||
                    (passwordStatus?.hasPassword && !currentPassword)
                  }
                  data-testid="button-save-password"
                >
                  {setPasswordMutation.isPending ? "Saving..." : passwordStatus?.hasPassword ? "Update Password" : "Set Password"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Moon className="w-5 h-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Choose your preferred theme
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant={themeMode === "auto" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => handleThemeChange("auto")}
                data-testid="button-theme-auto"
              >
                <Monitor className="w-4 h-4" />
                Auto
              </Button>
              <Button
                variant={themeMode === "light" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => handleThemeChange("light")}
                data-testid="button-theme-light"
              >
                <Sun className="w-4 h-4" />
                Light
              </Button>
              <Button
                variant={themeMode === "dark" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => handleThemeChange("dark")}
                data-testid="button-theme-dark"
              >
                <Moon className="w-4 h-4" />
                Dark
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {themeMode === "auto" 
                ? "Dark mode on desktop, light on mobile. Also adapts to time of day and device settings"
                : themeMode === "dark"
                ? "Always use dark mode"
                : "Always use light mode"}
            </p>
          </CardContent>
        </Card>

        {isAdmin && (
          <>
        <Separator className="my-6" />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="w-5 h-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Generate keys for external integrations and AI agents
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-create-api-key">
                  <Plus className="w-4 h-4 mr-1" />
                  Create key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Create a new API key for external integrations. The key will only be shown once.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Key name</Label>
                    <Input
                      id="key-name"
                      placeholder="e.g., Production Integration"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      data-testid="input-key-name"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createKeyMutation.mutate(newKeyName)}
                    disabled={!newKeyName.trim() || createKeyMutation.isPending}
                    data-testid="button-confirm-create-key"
                  >
                    {createKeyMutation.isPending ? "Creating..." : "Create key"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {newlyCreatedKey && (
              <div className="mb-4 p-4 rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                  New API Key Created
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mb-3">
                  Copy this key now. You won't be able to see it again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded bg-white dark:bg-black/20 text-sm font-mono overflow-hidden">
                    {showKey ? newlyCreatedKey.key : "•".repeat(40)}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowKey(!showKey)}
                    data-testid="button-toggle-show-key"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCopyKey(newlyCreatedKey.key)}
                    data-testid="button-copy-new-key"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setNewlyCreatedKey(null)}
                  data-testid="button-dismiss-new-key"
                >
                  Dismiss
                </Button>
              </div>
            )}

            {keysLoading ? (
              <p className="text-sm text-muted-foreground">Loading keys...</p>
            ) : (keysData as { keys: ApiKeyInfo[] } | undefined)?.keys && (keysData as { keys: ApiKeyInfo[] }).keys.length > 0 ? (
              <div className="space-y-3">
                {(keysData as { keys: ApiKeyInfo[] }).keys.map((key: ApiKeyInfo) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-md border"
                    data-testid={`api-key-row-${key.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{key.name}</p>
                        <Badge variant={key.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">
                          {key.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {key.prefix}••••••••
                        {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          data-testid={`button-delete-key-${key.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{key.name}"? Any integrations using this key will stop working.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteKeyMutation.mutate(key.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Key className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No API keys yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a key to allow external AI agents to access your documents
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Preferences
            </CardTitle>
            <CardDescription>
              Customize your app experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-4 rounded-lg border">
              <div className="flex-1">
                <p className="font-medium">AI Helper Tips</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Show the floating helper avatar with contextual tips while using the app
                </p>
              </div>
              <Switch
                checked={!helperDisabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    localStorage.removeItem("evident_helper_disabled");
                  } else {
                    localStorage.setItem("evident_helper_disabled", "true");
                  }
                  setHelperDisabled(!checked);
                }}
                data-testid="switch-helper-tips"
              />
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <Card className="border-accent/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              Admin Settings
            </CardTitle>
            <CardDescription>
              Control feature availability for your instance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-4 rounded-lg border">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-accent" />
                  <p className="font-medium">Pilot Mode</p>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Enable enterprise pilot features for public users. When OFF, only Workspace mode is available during onboarding.
                </p>
              </div>
              <Switch
                checked={pilotModeEnabled}
                onCheckedChange={handleTogglePilotMode}
                data-testid="switch-pilot-mode"
              />
            </div>

            {isAdmin && (
              <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <p className="font-medium">Enterprise Mode</p>
                    {enterpriseModeData?.enabled && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px]">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enable 200MB file uploads for large technical documents (manuals, specs, data sheets).
                  </p>
                  {enterpriseModeData?.enabled && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                      <FileUp className="w-3 h-3" />
                      <span>Max file size: {enterpriseModeData.maxFileSizeMB}MB</span>
                    </div>
                  )}
                </div>
                <Switch
                  checked={enterpriseModeData?.enabled ?? false}
                  onCheckedChange={(enabled) => toggleEnterpriseMutation.mutate(enabled)}
                  disabled={enterpriseModeLoading || toggleEnterpriseMutation.isPending}
                  data-testid="switch-enterprise-mode"
                />
              </div>
            )}

            {isAdmin && (
              <Link href="/admin/prompt-templates">
                <div className="flex items-center justify-between gap-4 p-4 rounded-lg border hover-elevate cursor-pointer">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <p className="font-medium">Prompt Templates</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Customize quick prompts for each intent mode (Study, Analyst, Research, Engineering).
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </Link>
            )}
            
            <p className="text-xs text-muted-foreground">
              Changes take effect immediately. Existing users who selected Pilot mode will retain their selection.
            </p>
          </CardContent>
        </Card>
          </>
        )}

        <Separator className="my-6" />

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <UserX className="w-5 h-5" />
              Delete Account
            </CardTitle>
            <CardDescription>
              Permanently delete your account and all associated data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <p className="text-sm text-muted-foreground mb-3">
                This action is irreversible. All your documents, chat history, and settings will be permanently deleted.
              </p>
              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-delete-account">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete My Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-destructive">Delete Account</DialogTitle>
                    <DialogDescription>
                      This will permanently delete your account and all data. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="confirm-email">Type your email to confirm</Label>
                      <Input
                        id="confirm-email"
                        placeholder="your@email.com"
                        value={deleteConfirmEmail}
                        onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                        data-testid="input-confirm-delete-email"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsDeleteDialogOpen(false);
                        setDeleteConfirmEmail("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => deleteAccountMutation.mutate(deleteConfirmEmail)}
                      disabled={!deleteConfirmEmail || deleteAccountMutation.isPending}
                      data-testid="button-confirm-delete-account"
                    >
                      {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              About Evident
            </CardTitle>
            <CardDescription>
              Information about this application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Evident is your evidence-based AI assistant. Upload documents, ask questions, and get reliable answers with citations you can trust.
              </p>
              
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                <Globe className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">Web App Available</p>
                  <p className="text-xs text-muted-foreground">
                    Access Evident from any browser at{" "}
                    <a 
                      href="https://evident-ai.net" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      data-testid="link-web-app-settings"
                    >
                      evident-ai.net
                    </a>
                  </p>
                </div>
              </div>

              <VersionInfo />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
