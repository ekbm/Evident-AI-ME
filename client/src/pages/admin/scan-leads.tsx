import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Building2, User, Clock, FileText, CheckCircle2, Eye } from "lucide-react";
import { format } from "date-fns";

interface ScanLead {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  scanScore: number | null;
  totalFiles: number | null;
  readyCount: number | null;
  needsPrepCount: number | null;
  manualCount: number | null;
  topIssuesJson: string | null;
  reportToken: string;
  reportAccessedAt: string | null;
  source: string;
  createdAt: string;
}

export default function AdminScanLeadsPage() {
  const { data: leads = [], isLoading, error } = useQuery<ScanLead[]>({
    queryKey: ["/api/admin/scan-leads"],
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
      const date = new Date(l.createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    }).length,
    accessed: leads.filter((l) => l.reportAccessedAt !== null).length,
    withScore: leads.filter((l) => l.scanScore !== null).length,
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
              <h1 className="text-lg sm:text-xl font-semibold">Scan Report Leads</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Leads from AI Readiness Scan email capture
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
              <div className="text-2xl font-bold text-green-600" data-testid="text-accessed">{stats.accessed}</div>
              <div className="text-sm text-muted-foreground">Viewed Report</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-cyan-600" data-testid="text-with-score">{stats.withScore}</div>
              <div className="text-sm text-muted-foreground">With Score</div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading leads...</div>
        ) : leads.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No scan leads yet. They'll appear here when users submit their email on the scan page.
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
                        {lead.name && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{lead.name}</span>
                          </div>
                        )}
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
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        {lead.scanScore !== null && (
                          <Badge variant={lead.scanScore >= 70 ? "default" : lead.scanScore >= 40 ? "secondary" : "destructive"}>
                            Score: {Math.round(lead.scanScore)}%
                          </Badge>
                        )}
                        {lead.totalFiles !== null && (
                          <Badge variant="outline">
                            <FileText className="h-3 w-3 mr-1" />
                            {lead.totalFiles} files
                          </Badge>
                        )}
                        {lead.readyCount !== null && lead.readyCount > 0 && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {lead.readyCount} ready
                          </Badge>
                        )}
                        {lead.reportAccessedAt && (
                          <Badge variant="outline" className="text-blue-600 border-blue-600">
                            <Eye className="h-3 w-3 mr-1" />
                            Viewed
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(lead.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        {lead.reportAccessedAt && (
                          <span className="ml-2">
                            (Viewed: {format(new Date(lead.reportAccessedAt), "MMM d, h:mm a")})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <Link href={`/scan/report/${lead.reportToken}`}>
                        <Button size="sm" variant="outline" data-testid={`button-view-report-${lead.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Report
                        </Button>
                      </Link>
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
