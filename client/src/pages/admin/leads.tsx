import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Building2, User, Briefcase, Clock, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface AgentLead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  interest: string;
  message: string | null;
  consent: number;
  source: string;
  scan_score: number | null;
  scan_data_json: string | null;
  created_at: string;
}

const interestLabels: Record<string, string> = {
  ongoing_readiness: "Ongoing AI readiness monitoring",
  auto_tagging: "Auto-tagging & metadata",
  duplication_cleanup: "Duplication cleanup",
  knowledge_sync: "Knowledge sync",
  not_sure: "Not sure yet",
};

export default function AdminLeadsPage() {
  const { data: leads = [], isLoading, error } = useQuery<AgentLead[]>({
    queryKey: ["/api/admin/agent-leads"],
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

  const stats = {
    total: leads.length,
    thisWeek: leads.filter((l) => {
      const date = new Date(l.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    }).length,
    withScore: leads.filter((l) => l.scan_score !== null).length,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="self-start" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">Agent Leads</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                View leads from Evident Live contact form
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold" data-testid="text-total-leads">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Leads</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600" data-testid="text-week-leads">{stats.thisWeek}</div>
              <div className="text-sm text-muted-foreground">This Week</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600" data-testid="text-with-score">{stats.withScore}</div>
              <div className="text-sm text-muted-foreground">With Scan Score</div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading leads...</div>
        ) : leads.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No leads yet. They'll appear here when users submit the contact form.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <Card key={lead.id} data-testid={`card-lead-${lead.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{lead.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                            {lead.email}
                          </a>
                        </div>
                        {lead.company && (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.company}</span>
                          </div>
                        )}
                        {lead.role && (
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.role}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">
                          {interestLabels[lead.interest] || lead.interest}
                        </Badge>
                        {lead.scan_score !== null && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600">
                            Score: {lead.scan_score}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-muted-foreground">
                          {lead.source}
                        </Badge>
                      </div>

                      {lead.message && (
                        <div className="flex items-start gap-2 mt-2 p-2 bg-muted/50 rounded text-sm">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <span>{lead.message}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right text-sm text-muted-foreground shrink-0">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(lead.created_at), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs">
                        {format(new Date(lead.created_at), "h:mm a")}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
