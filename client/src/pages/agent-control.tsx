import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot, FileText, MessageSquare, Shield, TrendingUp, Zap, Clock,
  CheckCircle, AlertCircle, ArrowLeft, Activity, BarChart3, Key, RefreshCw
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

interface AgentStats {
  totalActivities: number;
  documentsAssessed: number;
  chatsAnswered: number;
  policyCitations: number;
  totalTokens: number;
  avgLatencyMs: number;
  successRate: number;
  activeAgents: number;
}

interface TrendData {
  date: string;
  chats: number;
  ingestions: number;
  documents: number;
}

interface AgentKeyStats {
  apiKeyId: string;
  keyName: string;
  chats: number;
  ingestions: number;
  documents: number;
  tokens: number;
  successRate: number;
}

interface AgentActivity {
  id: string;
  apiKeyId: string | null;
  workspaceId: string | null;
  activityType: string;
  endpoint: string;
  question: string | null;
  answer: string | null;
  tokensUsed: number;
  latencyMs: number;
  status: string;
  createdAt: string;
}

export default function AgentControlPage() {
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery<{ stats: AgentStats }>({
    queryKey: ["/api/agent-control/stats"],
  });

  const { data: trendData, isLoading: trendLoading } = useQuery<{ trend: TrendData[] }>({
    queryKey: ["/api/agent-control/trend"],
  });

  const { data: agentsData, isLoading: agentsLoading } = useQuery<{ agents: AgentKeyStats[] }>({
    queryKey: ["/api/agent-control/agents"],
  });

  const { data: activityData, isLoading: activityLoading } = useQuery<{ activities: AgentActivity[] }>({
    queryKey: ["/api/agent-control/activity"],
  });

  const stats = statsData?.stats || {
    totalActivities: 0,
    documentsAssessed: 0,
    chatsAnswered: 0,
    policyCitations: 0,
    totalTokens: 0,
    avgLatencyMs: 0,
    successRate: 100,
    activeAgents: 0
  };

  const trend = trendData?.trend || [];
  const agents = agentsData?.agents || [];
  const activities = activityData?.activities || [];

  const kpiCards = [
    {
      title: "Active Agents",
      value: stats.activeAgents,
      icon: Bot,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      description: "Last 7 days"
    },
    {
      title: "Documents Assessed",
      value: stats.documentsAssessed,
      icon: FileText,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      description: "Referenced in queries"
    },
    {
      title: "Chats Answered",
      value: stats.chatsAnswered,
      icon: MessageSquare,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      description: "Agent conversations"
    },
    {
      title: "Policy Citations",
      value: stats.policyCitations,
      icon: Shield,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      description: "Policy-governed answers"
    },
    {
      title: "Success Rate",
      value: `${stats.successRate}%`,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      description: "Request success"
    },
    {
      title: "Avg Latency",
      value: `${stats.avgLatencyMs}ms`,
      icon: Clock,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      description: "Response time"
    }
  ];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-workspace">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go to Workspace
              </Button>
            </Link>
            <Badge variant="outline" className="border-blue-500 text-blue-500">
              <Bot className="w-3 h-3 mr-1" />
              Agent Control Centre
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStats()}
            data-testid="button-refresh-stats"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <section className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Agent Activity Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor external AI agent interactions, document assessments, and policy compliance.
          </p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {kpiCards.map((kpi) => (
            <Card key={kpi.title} data-testid={`kpi-${kpi.title.toLowerCase().replace(/\s/g, "-")}`}>
              <CardContent className="pt-4">
                <div className={`w-8 h-8 rounded-lg ${kpi.bgColor} flex items-center justify-center mb-2`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{kpi.title}</p>
                <p className="text-xs text-muted-foreground/70">{kpi.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="agents" data-testid="tab-agents">
              <Key className="w-4 h-4 mr-2" />
              Agents
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">
              <Activity className="w-4 h-4 mr-2" />
              Activity Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Activity Trend (30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {trendLoading ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Loading trend data...
                    </div>
                  ) : trend.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                      <Activity className="w-12 h-12 mb-4 opacity-50" />
                      <p>No agent activity recorded yet</p>
                      <p className="text-xs">Activity will appear here when agents start using the API</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={trend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Area type="monotone" dataKey="chats" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} name="Chats" />
                        <Area type="monotone" dataKey="ingestions" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Ingestions" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-500" />
                    Documents Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {trendLoading ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Loading document data...
                    </div>
                  ) : trend.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="w-12 h-12 mb-4 opacity-50" />
                      <p>No documents assessed yet</p>
                      <p className="text-xs">Document assessments will be tracked here</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={trend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Line type="monotone" dataKey="documents" stroke="#10b981" strokeWidth={2} dot={false} name="Documents" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How Agent Tracking Works</CardTitle>
                <CardDescription>
                  Every API call from external agents is logged and aggregated for reporting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                      <span className="text-blue-500 font-semibold text-sm">1</span>
                    </div>
                    <p className="font-medium text-sm">Agent Authenticates</p>
                    <p className="text-xs text-muted-foreground">Via API key or bearer token</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
                      <span className="text-purple-500 font-semibold text-sm">2</span>
                    </div>
                    <p className="font-medium text-sm">Request Logged</p>
                    <p className="text-xs text-muted-foreground">Activity, documents, tokens tracked</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                      <span className="text-emerald-500 font-semibold text-sm">3</span>
                    </div>
                    <p className="font-medium text-sm">Rollups Updated</p>
                    <p className="text-xs text-muted-foreground">Real-time aggregation per day</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center mb-2">
                      <span className="text-amber-500 font-semibold text-sm">4</span>
                    </div>
                    <p className="font-medium text-sm">Dashboard Updated</p>
                    <p className="text-xs text-muted-foreground">Stats visible in Control Centre</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  Registered API Keys
                </CardTitle>
                <CardDescription>
                  Activity breakdown by agent API key
                </CardDescription>
              </CardHeader>
              <CardContent>
                {agentsLoading ? (
                  <div className="py-8 text-center text-muted-foreground">Loading agents...</div>
                ) : agents.length === 0 ? (
                  <div className="py-12 text-center">
                    <Key className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="font-medium">No Agent API Keys Active</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create API keys in Settings to enable agent integrations
                    </p>
                    <Link href="/settings">
                      <Button variant="outline" size="sm">
                        <Zap className="w-4 h-4 mr-2" />
                        Go to Settings
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">API Key</th>
                          <th className="text-right py-3 px-2 font-medium">Chats</th>
                          <th className="text-right py-3 px-2 font-medium">Ingestions</th>
                          <th className="text-right py-3 px-2 font-medium">Documents</th>
                          <th className="text-right py-3 px-2 font-medium">Tokens</th>
                          <th className="text-right py-3 px-2 font-medium">Success</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agents.map((agent) => (
                          <tr key={agent.apiKeyId} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <Bot className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{agent.keyName}</span>
                              </div>
                            </td>
                            <td className="text-right py-3 px-2">{agent.chats}</td>
                            <td className="text-right py-3 px-2">{agent.ingestions}</td>
                            <td className="text-right py-3 px-2">{agent.documents}</td>
                            <td className="text-right py-3 px-2">{agent.tokens.toLocaleString()}</td>
                            <td className="text-right py-3 px-2">
                              <Badge variant={agent.successRate >= 95 ? "default" : agent.successRate >= 80 ? "secondary" : "destructive"}>
                                {agent.successRate}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Recent Agent Activity
                </CardTitle>
                <CardDescription>
                  Real-time log of agent interactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="py-8 text-center text-muted-foreground">Loading activity...</div>
                ) : activities.length === 0 ? (
                  <div className="py-12 text-center">
                    <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="font-medium">No Activity Recorded</p>
                    <p className="text-sm text-muted-foreground">
                      Agent interactions will appear here as they occur
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {activities.map((activity) => (
                        <div
                          key={activity.id}
                          className="p-3 rounded-lg bg-muted/30 border"
                          data-testid={`activity-${activity.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={activity.activityType === "chat" ? "default" : "secondary"}>
                                {activity.activityType}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{activity.endpoint}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {activity.status === "SUCCESS" ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatTime(activity.createdAt)}
                              </span>
                            </div>
                          </div>
                          {activity.question && (
                            <p className="text-sm mb-1">
                              <span className="font-medium">Q:</span> {activity.question.slice(0, 100)}
                              {activity.question.length > 100 && "..."}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{activity.tokensUsed} tokens</span>
                            <span>{activity.latencyMs}ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
