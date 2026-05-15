import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  LogIn,
  CheckCircle,
  Shield,
  Building2,
  FileText,
  Brain,
  Users,
  Lock,
  Globe,
  Server,
  Cloud,
  HardDrive,
  BarChart3,
  Share2,
  MessageSquare,
  ClipboardCheck,
  Link2,
  Search,
  Bell,
  Eye,
  Zap,
  ChevronRight,
  FileSearch,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { SiSlack, SiConfluence, SiGoogledrive } from "react-icons/si";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function EnterpriseLanding() {
  useDocumentTitle("Evident - Enterprise AI Document Intelligence");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      setLocation("/full");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/">
              <img
                src="/apple-touch-icon.png?v=3"
                alt="Evident"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-lg flex-shrink-0 cursor-pointer"
                data-testid="img-enterprise-logo"
              />
            </Link>
            <div>
              <Link href="/" className="no-underline">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Evident
                </h1>
              </Link>
              <p className="text-xs text-muted-foreground hidden sm:block">Enterprise</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" data-testid="button-pricing-nav" onClick={() => document.getElementById('enterprise-pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              Pricing
            </Button>
            <Button asChild data-testid="button-enterprise-signin">
              <Link href="/auth">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full">
        {/* Hero */}
        <section className="py-16 sm:py-24 px-4 sm:px-6">
          <div className="w-full max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Building2 className="w-4 h-4" />
              Enterprise AI Document Intelligence
            </div>

            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Document.
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                AI Insight.
              </span>
              <br />
              Human Decision.
            </h2>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-4">
              Your team's documents hold the answers. Evident reads them, flags what matters, 
              and routes decisions to the right people — with full citations and audit trail.
            </p>

            <p className="text-sm text-muted-foreground max-w-2xl mx-auto mb-8">
              AI does the heavy lifting. Humans make the final call. 
              No black-box decisions. No automation anxiety.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
              <Button
                size="lg"
                className="font-bold shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-accent"
                onClick={() => setLocation("/auth")}
                data-testid="button-enterprise-start"
              >
                <Zap className="w-5 h-5 mr-2" />
                Start Free Pilot
              </Button>
              <Button size="lg" className="font-bold border-2 border-emerald-500 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 animate-pulse hover:animate-none" onClick={() => setLocation("/demo")} data-testid="button-enterprise-demo">
                <Eye className="w-5 h-5 mr-2" />
                See Live Demo
              </Button>
              <Button size="lg" variant="ghost" onClick={() => document.getElementById('enterprise-pricing')?.scrollIntoView({ behavior: 'smooth' })} data-testid="button-enterprise-pricing">
                View Pricing
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Up to 20 users, 30 days, no credit card required</p>
          </div>
        </section>

        {/* Core Flow */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 bg-muted/30">
          <div className="w-full max-w-5xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-bold text-center mb-3">How Evident Works</h3>
            <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
              Three steps from document to decision. The AI handles the analysis, your team makes the calls.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />
                <CardContent className="p-6 pt-8">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="mb-3">Step 1</Badge>
                  <h4 className="text-lg font-bold mb-2">Document</h4>
                  <p className="text-sm text-muted-foreground">
                    Upload any file type or connect your existing sources — SharePoint, Google Drive, Confluence. 
                    Evident processes everything automatically.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-accent" />
                <CardContent className="p-6 pt-8">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="mb-3">Step 2</Badge>
                  <h4 className="text-lg font-bold mb-2">AI Insight</h4>
                  <p className="text-sm text-muted-foreground">
                    Evident reads your documents, answers questions with citations, flags risks, 
                    spots anomalies, and compares against your existing library.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-accent/50" />
                <CardContent className="p-6 pt-8">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <UserCheck className="w-6 h-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="mb-3">Step 3</Badge>
                  <h4 className="text-lg font-bold mb-2">Human Decision</h4>
                  <p className="text-sm text-muted-foreground">
                    Route insights to the right team. @Legal reviews the risk clause. @Compliance confirms the gap. 
                    Every decision is tracked and auditable.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Proactive AI Insights */}
        <section className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="w-full max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <Badge variant="outline" className="mb-3 text-primary border-primary/30">Proactive Intelligence</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3">AI That Flags What Matters</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Evident doesn't wait for questions. It automatically analyses every document and surfaces what needs attention.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: AlertTriangle, title: "Risk Detection", desc: "Identifies vendor liability, unusual terms, and clauses that differ from your standard agreements" },
                { icon: FileSearch, title: "Missing Sections", desc: "Spots when termination clauses, notice periods, or required sections are absent" },
                { icon: Shield, title: "Policy Deviation", desc: "Compares against your company policy templates and flags non-compliance" },
                { icon: Eye, title: "Anomaly Detection", desc: "Highlights unusual terms like non-compete scopes broader than industry standard" },
                { icon: BarChart3, title: "Version Changes", desc: "Detects when payment terms, SLAs, or key metrics change from previous versions" },
                { icon: Search, title: "Historical Patterns", desc: "Learns from what your teams have previously questioned and proactively flags similar items" },
              ].map((item, i) => (
                <Card key={i} className="border hover:border-primary/30 transition-colors">
                  <CardContent className="p-5">
                    <item.icon className="w-5 h-5 text-primary mb-3" />
                    <h4 className="font-semibold mb-1.5">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 p-5 rounded-xl bg-muted/50 border">
              <p className="text-sm text-center">
                <span className="font-semibold">Example:</span>{" "}
                <span className="text-muted-foreground italic">
                  "Section 12 introduces a vendor liability risk — this differs from your standard vendor agreement"
                </span>
                {" → "}
                <span className="font-medium text-primary">Send to @Legal for review</span>
                {" → "}
                <span className="font-medium text-green-600 dark:text-green-400">Accepted</span>
              </p>
            </div>
          </div>
        </section>

        {/* Core Platform Features */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 bg-muted/30">
          <div className="w-full max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <Badge variant="outline" className="mb-3 text-primary border-primary/30">Platform Capabilities</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3">Everything Your Team Needs</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                From document Q&A to compliance checklists — one platform for all your document intelligence needs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: MessageSquare, title: "AI Q&A with Citations", desc: "Ask questions about your documents and get precise answers with exact source references. Every response is traceable." },
                { icon: ClipboardCheck, title: "Obligation Extraction", desc: "Automatically extracts structured checklists of obligations, deadlines, and requirements from contracts and policies." },
                { icon: BarChart3, title: "Knowledge Health Dashboard", desc: "See which documents are AI-ready, which need attention. Automated quality scoring with actionable improvement steps." },
                { icon: FileText, title: "Any File Type", desc: "PDF, Word, Excel, images (OCR), audio and video (transcription). If it contains information, Evident can process it." },
                { icon: Brain, title: "Smart Document Routing", desc: "Automatically detects document type (contract, policy, report) and routes through the optimal processing pipeline." },
                { icon: Search, title: "Search Learning", desc: "Learns from your organisation's query patterns. Surfaces popular questions and improves suggestions over time." },
                { icon: Zap, title: "Custom AI Modes", desc: "Configure which AI modes are available per organisation — Legal, Compliance, Finance, HR. Tailor Evident to your industry." },
                { icon: FileSearch, title: "Document Preparation", desc: "Automated pipeline: OCR enhancement, table recovery, text cleanup, structure reconstruction, and metadata enrichment." },
                { icon: Shield, title: "Content Protection", desc: "Multi-layer system: content moderation, prompt injection detection, answer quality validation, and source verification." },
              ].map((item, i) => (
                <Card key={i} className="border hover:border-primary/30 transition-colors">
                  <CardContent className="p-5">
                    <item.icon className="w-5 h-5 text-primary mb-3" />
                    <h4 className="font-semibold mb-1.5">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Collaboration Pillars */}
        <section className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="w-full max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <Badge variant="outline" className="mb-3 text-primary border-primary/30">Enterprise Collaboration</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3">Four Pillars of Smart Collaboration</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Evident enhances your document intelligence workflow — without becoming another communication tool.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-500" />
                    </div>
                    <h4 className="text-lg font-bold">Shared Workspaces</h4>
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Team document collections everyone can query
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Role-based access: view, upload, or manage
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Workspace-level AI insights
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-purple-500" />
                    </div>
                    <h4 className="text-lg font-bold">Comments & @Mentions</h4>
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Comment on insights, findings, and answers
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      @mention colleagues for attention
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Threaded replies stay in context
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <ClipboardCheck className="w-5 h-5 text-orange-500" />
                    </div>
                    <h4 className="text-lg font-bold">Assign Actions</h4>
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Route insights to Legal, Compliance, Finance
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Track: Pending → Accepted / Flagged / Escalated
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Full audit trail on every decision
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Share2 className="w-5 h-5 text-green-500" />
                    </div>
                    <h4 className="text-lg font-bold">Deep Shareable Links</h4>
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Unique URL for every insight and finding
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Share directly to Slack, Teams, Email, WhatsApp
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Access-controlled with full context
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="w-full max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <Badge variant="outline" className="mb-3 text-primary border-primary/30">Integrations Included</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3">Connects to Your Existing Tools</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Self-service setup — IT admins connect through a guided wizard. No developer needed.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
              {[
                { icon: SiGoogledrive, name: "Google Drive", color: "text-green-600" },
                { icon: SiConfluence, name: "Confluence", color: "text-blue-600" },
                { icon: SiSlack, name: "Slack", color: "text-[#4A154B]" },
                { icon: Users, name: "Microsoft Teams", color: "text-[#6264A7]" },
              ].map((tool, i) => (
                <div key={i} className="flex items-center gap-2.5 px-5 py-3 rounded-xl border bg-card hover:border-primary/30 transition-colors">
                  <tool.icon className={`w-5 h-5 ${tool.color}`} />
                  <span className="text-sm font-medium">{tool.name}</span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl border bg-card text-center mb-6">
              <p className="text-sm font-semibold mb-1">Self-Service IT Setup</p>
              <p className="text-xs text-muted-foreground">
                Admin Console → Integrations → Click "Connect" → OAuth login → Select folders → Set sync schedule → Done. No developer needed.
              </p>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Can't do direct integrations? No problem.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {["SFTP Drop Folder", "Email Ingestion", "Bulk Upload", "REST API", "CSV Import"].map((method) => (
                  <Badge key={method} variant="secondary" className="text-xs px-3 py-1.5">
                    {method}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 bg-muted/30">
          <div className="w-full max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <Badge variant="outline" className="mb-3 text-primary border-primary/30">Enterprise Security</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3">Your Data, Your Rules</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Choose where your data lives. From our cloud to your own servers — full control at every tier.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {[
                { icon: Lock, title: "AES-256 Encryption", desc: "Data encrypted at rest and in transit with TLS 1.2+" },
                { icon: Shield, title: "AI Privacy", desc: "OpenAI does not train on your data — covered by DPA" },
                { icon: Eye, title: "Full Audit Trail", desc: "Every action logged — immutable records for compliance" },
                { icon: Users, title: "RBAC", desc: "Role-based access control with directory integration" },
                { icon: Bell, title: "Security Alerts", desc: "Configurable alerts for bulk downloads, permission changes" },
                { icon: Globe, title: "Data Residency", desc: "Choose your region — EU, US, Asia, or on-premise" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl border bg-card">
                  <item.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm">{item.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Deployment Options */}
        <section id="enterprise-pricing" className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="w-full max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <Badge variant="outline" className="mb-3 text-primary border-primary/30">Flexible Deployment</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3">Deploy Your Way</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                From instant cloud setup to fully air-gapped on-premise — pick what fits your security requirements.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="p-5">
                  <Cloud className="w-6 h-6 text-primary mb-3" />
                  <h4 className="font-bold mb-1">Evident Cloud</h4>
                  <p className="text-2xl font-bold text-primary mb-2">$2.99<span className="text-xs font-normal text-muted-foreground">/user/mo</span></p>
                  <ul className="space-y-1.5">
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Zero setup, instant start
                    </li>
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      All features included
                    </li>
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      100 free AI queries/mo
                    </li>
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Automatic updates
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="p-5">
                  <HardDrive className="w-6 h-6 text-primary mb-3" />
                  <h4 className="font-bold mb-1">Custom Storage</h4>
                  <p className="text-2xl font-bold text-primary mb-2">$7.99<span className="text-xs font-normal text-muted-foreground">/user/mo</span></p>
                  <ul className="space-y-1.5">
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Your own S3/Azure/GCS
                    </li>
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Choose data region
                    </li>
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Self-service config
                    </li>
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Everything in Cloud
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary/30 hover:border-primary/50 transition-colors relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-[10px]">Popular</Badge>
                </div>
                <CardContent className="p-5">
                  <Server className="w-6 h-6 text-primary mb-3" />
                  <h4 className="font-bold mb-1">Private Cloud</h4>
                  <p className="text-2xl font-bold text-primary mb-2">$14.99<span className="text-xs font-normal text-muted-foreground">/user/mo</span></p>
                  <ul className="space-y-1.5">
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Dedicated instance
                    </li>
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Your cloud account
                    </li>
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Full network isolation
                    </li>
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Priority SLA included
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="p-5">
                  <Building2 className="w-6 h-6 text-primary mb-3" />
                  <h4 className="font-bold mb-1">On-Premise</h4>
                  <p className="text-2xl font-bold text-primary mb-2">Custom<span className="text-xs font-normal text-muted-foreground block">quote-based</span></p>
                  <ul className="space-y-1.5">
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Your own servers
                    </li>
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Air-gapped option
                    </li>
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Local AI models
                    </li>
                    <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Nothing leaves your network
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-6">
              All tiers include external integrations, 100 free AI queries/user/month, and the full feature set.
              <br />
              The only difference is where your data lives.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              {["10% off for 100+ users", "15% off for 500+ users", "20% off for 1,000+ users", "Extra 10% for annual plans"].map((discount) => (
                <Badge key={discount} variant="outline" className="text-xs px-3 py-1.5 border-primary/20 text-primary">
                  {discount}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        {/* Usage Pricing */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 bg-muted/30">
          <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <Badge variant="outline" className="mb-3 text-primary border-primary/30">Transparent Pricing</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3">Pay Only for What You Use</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                100 free AI queries per user per month included. After that, simple per-query pricing.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "AI Query", price: "$0.015", desc: "per question" },
                { label: "Doc Processing", price: "$0.02", desc: "per document" },
                { label: "Deep Scan", price: "$0.03", desc: "per document" },
                { label: "Report Gen", price: "$0.05", desc: "per generation" },
              ].map((item, i) => (
                <div key={i} className="text-center p-4 rounded-xl border bg-card">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-xl font-bold text-primary">{item.price}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>

            <Card className="border">
              <CardContent className="p-5">
                <p className="text-sm font-semibold mb-2">Example: Team of 50 users</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Base cost</p>
                    <p className="text-lg font-bold">$149.50<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                    <p className="text-[10px] text-muted-foreground">50 users x $2.99</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Free queries included</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">5,000</p>
                    <p className="text-[10px] text-muted-foreground">100/user x 50 users</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Overage (if 150 avg)</p>
                    <p className="text-lg font-bold">$37.50<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                    <p className="text-[10px] text-muted-foreground">2,500 extra x $0.015</p>
                  </div>
                </div>
                <p className="text-center text-sm font-semibold mt-3">
                  Total: <span className="text-primary">$187.00/month</span> <span className="text-muted-foreground font-normal">($3.74/user effective)</span>
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Audit Trail */}
        <section className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="w-full max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <Badge variant="outline" className="mb-3 text-primary border-primary/30">Compliance Ready</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3">Full Audit Trail</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Every action logged. Searchable, exportable, immutable. Designed for enterprise compliance requirements.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Documents", desc: "Upload, delete, share, download" },
                { label: "AI Queries", desc: "Every question and response" },
                { label: "Insights", desc: "Generated, reviewed, shared" },
                { label: "User Activity", desc: "Logins, roles, permissions" },
                { label: "Workspaces", desc: "Created, membership changes" },
                { label: "Admin Actions", desc: "Settings, integrations, bulk ops" },
                { label: "Data Ingestion", desc: "Sync events, import status" },
                { label: "Sharing", desc: "Links, external shares, access" },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-xl border bg-card text-center">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              {["Searchable & Filterable", "CSV/PDF Export", "Immutable Records", "API Access", "Configurable Alerts"].map((feat) => (
                <Badge key={feat} variant="secondary" className="text-xs px-3 py-1.5 gap-1.5">
                  <CheckCircle className="w-3 h-3" />
                  {feat}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gradient-to-b from-muted/30 to-background">
          <div className="w-full max-w-3xl mx-auto text-center">
            <h3 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to See Evident in Action?
            </h3>
            <p className="text-muted-foreground mb-2 max-w-xl mx-auto">
              Start a free pilot with up to 20 users. No credit card required. 
              Full feature access for 30 days.
            </p>
            <p className="text-sm font-medium mb-8">
              Time to value: <span className="text-primary">under 48 hours.</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <Button
                size="lg"
                className="font-bold shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-accent"
                onClick={() => setLocation("/auth")}
                data-testid="button-enterprise-cta-bottom"
              >
                <Zap className="w-5 h-5 mr-2" />
                Start Free Pilot
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLocation("/demo")} data-testid="button-enterprise-contact">
                <Eye className="w-4 h-4 mr-2" />
                See Live Demo
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Use the Feedback option in-app to reach our team directly.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t py-8 px-4 sm:px-6">
          <div className="w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/apple-touch-icon.png?v=3" alt="Evident" className="w-6 h-6 rounded-lg" />
              <span className="text-sm font-semibold">Evident</span>
              <span className="text-xs text-muted-foreground">Enterprise AI Document Intelligence</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
              <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
