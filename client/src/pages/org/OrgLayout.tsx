import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { 
  Monitor, 
  FileText, 
  Shield, 
  Settings, 
  Building2, 
  ArrowLeft, 
  AlertCircle,
  Users,
  Download,
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Moon, Sun } from "lucide-react";

interface OrgContextData {
  hasOrg: boolean;
  org: {
    id: string;
    name: string;
    plan: string;
    planDeviceLimit: number;
  } | null;
  role: string | null;
  capabilities: Record<string, boolean> | null;
}

export function useOrgContext() {
  return useQuery<OrgContextData>({
    queryKey: ["/api/me/org"],
  });
}

function OrgSidebar() {
  const [location] = useLocation();
  const { data: orgContext } = useOrgContext();

  const navItems = [
    {
      title: "Fleet",
      url: "/org/agents",
      icon: Monitor,
      requiresCap: "can_view_all_devices",
    },
    {
      title: "Policies",
      url: "/org/policies",
      icon: FileText,
      requiresCap: null,
    },
    {
      title: "Audit Logs",
      url: "/org/audit",
      icon: Shield,
      requiresCap: "can_view_audit",
    },
    {
      title: "Invites",
      url: "/org/invites",
      icon: Mail,
      requiresCap: null,
    },
    {
      title: "Settings",
      url: "/org/settings",
      icon: Settings,
      requiresCap: null,
    },
  ];

  const filteredItems = navItems.filter(item => {
    if (!item.requiresCap) return true;
    return orgContext?.capabilities?.[item.requiresCap];
  });

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4 border-b">
        <Link href="/org/agents">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-foreground truncate max-w-[160px]">
                {orgContext?.org?.name || "Organization"}
              </span>
              <span className="text-xs text-muted-foreground">
                {orgContext?.role && (
                  <Badge variant="outline" className="text-xs py-0 px-1">
                    {orgContext.role}
                  </Badge>
                )}
              </span>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin Console</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => {
                const isActive = location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase()}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {orgContext?.capabilities?.can_download_agent && (
          <SidebarGroup>
            <SidebarGroupLabel>Downloads</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild data-active={location === "/org/settings/agents"}>
                    <Link href="/org/settings/agents" data-testid="nav-downloads">
                      <Download className="w-4 h-4" />
                      <span>Agent Downloads</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-workspace">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go to Workspace
            </Button>
          </Link>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

interface OrgLayoutProps {
  children: React.ReactNode;
}

export function OrgLayout({ children }: OrgLayoutProps) {
  const { data: orgContext, isLoading, error } = useOrgContext();

  const bootstrapMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/org/bootstrap");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/org"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (error || !orgContext?.hasOrg) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <Building2 className="w-12 h-12 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Organization Access</h1>
          <p className="text-muted-foreground">
            You're not currently a member of any organization. 
            Click below to set up your organization and access the admin console.
          </p>
          <div className="flex gap-2">
            <Button 
              onClick={() => bootstrapMutation.mutate()}
              disabled={bootstrapMutation.isPending}
              data-testid="button-join-org"
            >
              {bootstrapMutation.isPending ? "Setting up..." : "Set Up Organization"}
            </Button>
            <Link href="/">
              <Button variant="outline" data-testid="button-return-home">Return Home</Button>
            </Link>
          </div>
          {bootstrapMutation.isError && (
            <p className="text-sm text-destructive">
              Failed to set up organization. Please try again.
            </p>
          )}
        </div>
      </div>
    );
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <OrgSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <span className="text-sm font-medium text-muted-foreground">
                Org Admin Console
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {orgContext.org?.plan || "Enterprise"}
              </Badge>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default OrgLayout;
